import { debugPush, errorPush, infoPush, isDebugMode, logPush, warnPush } from "@/logger";
import {type IProtyle, type IEventBusMap, showMessage} from "siyuan";
import * as siyuanAPIs from "siyuan";
import { getAllShowingDocId, getHPathById, isMobile } from "@/syapi";
import { getPluginInstance } from "./pluginHelper";
import { useConsumer, useProvider, useQueue } from "./indexerHelper";
import { getSubDocIds } from "@/syapi/custom";
import { useWsIndexQueue } from "./wsMainHelper";
export default class EventHandler {
    private handlerBindList: Record<string, (arg1: CustomEvent)=>void> = {
        "ws-main": this.wsMainHandler.bind(this),
        "open-menu-doctree": this.openMenuDocTreeHandler.bind(this)
    };
    // 关联的设置项，如果设置项对应为true，则才执行绑定
    private relateGsettingKeyStr: Record<string, string> = {
        "loaded-protyle-static": null, // mutex需要访问EventHandler的属性
        "switch-protyle": null,
        "ws-main": null,
    };

    private simpleMutex: number = 0;
    private docIdMutex: Record<string, number> = {};
    constructor() {
    }

    bindHandler() {
        const plugin = getPluginInstance();
        const g_setting = plugin.mySettings;
        logPush("binding")
        if (!isDebugMode()) {
            logPush("非debug模式，不加入");
            return;
        }
        // const g_setting = getReadOnlyGSettings();
        for (let key in this.handlerBindList) {
            if (this.relateGsettingKeyStr[key] == null || g_setting[this.relateGsettingKeyStr[key]]) {
                plugin.eventBus.on(key, this.handlerBindList[key]);
            }
        }
    }

    unbindHandler() {
        const plugin = getPluginInstance();
        for (let key in this.handlerBindList) {
            plugin.eventBus.off(key, this.handlerBindList[key]);
        }
    }

    async wsMainHandler(detail: CustomEvent<IEventBusMap["ws-main"]>){
        const cmdTypeD = {
            "databaseIndexCommit": ()=>{
                useWsIndexQueue()?.signalOne();
            }
        };
        if (cmdTypeD[detail.detail.cmd]) {
            cmdTypeD[detail.detail.cmd]();
        }
    }
    async openMenuDocTreeHandler(event: CustomEvent<IEventBusMap["open-menu-doctree"]>) {
        logPush("data", event.detail);
        const provider = useProvider();
        if (event.detail.type !== "notebook") {
            if (event.detail.menu.menus && event.detail.menu.menus.length >= 1) {
                event.detail.menu.addSeparator();
            }
            event.detail.menu.addItem({
                "label": "对所选文档进行索引",
                "click": (element, mouseEvent)=>{
                    const idList = [].map.call(event.detail.elements, (item)=>item.getAttribute("data-node-id"));
                    const queue = useQueue();
                    if (queue) {
                        logPush("ids", idList);
                        queue.batchAddToQueue(idList.map(item=>{return {"id": item}})).then(()=>{
                                useConsumer()?.consume();
                        });;
                        logPush("Docs added", idList.length);
                    }
                }
            });
            event.detail.menu.addItem({
                "label": "对所选文档及其下层文档进行索引",
                "click": (element, mouseEvent)=>{
                    let parentIdList = [].map.call(event.detail.elements, (item)=>item.getAttribute("data-node-id"));
                    const resultIds = [];
                    resultIds.push(...parentIdList);
                    const handleSubIds = async (id)=>{
                        try {
                            const subDocIds = await getSubDocIds(id);
                            if (subDocIds != null && subDocIds.length > 0) {
                                resultIds.push(...subDocIds);
                            }
                        } catch (err) {
                            debugPush("无子文档或其他错误", err);
                        }
                    };
                    const idsPromise = parentIdList.map(item=>handleSubIds(item));
                    Promise.all(idsPromise).then((item)=>{
                        const queue = useQueue();
                        if (queue) {
                            logPush("ids", resultIds);
                            queue.batchAddToQueue(resultIds.map(item=>{return {"id": item}})).then(()=>{
                                useConsumer()?.consume();
                            });
                            logPush("Docs added", resultIds.length);
                        }
                    });
                    
                }
            });
            // event.detail.menu.addItem({
            //     "lable": "移除索引",
            //     "click": (e)=>{

            //     }
            // })
        }
    }
}