import { debugPush, errorPush, infoPush, isDebugMode, logPush, warnPush } from "@/logger";
import {type IProtyle, type IEventBusMap, showMessage} from "siyuan";
import * as siyuanAPIs from "siyuan";
import { getAllShowingDocId, getHPathById, isMobile } from "@/syapi";
import { getPluginInstance } from "./pluginHelper";
export default class EventHandler {
    private handlerBindList: Record<string, (arg1: CustomEvent)=>void> = {
        // "ws-main": this.wsMainHandler.bind(this),
        "open-menu-doctree": this.openMenuDocTreeHandler.bind(this)
    };
    // 关联的设置项，如果设置项对应为true，则才执行绑定
    private relateGsettingKeyStr: Record<string, string> = {
        "loaded-protyle-static": null, // mutex需要访问EventHandler的属性
        "switch-protyle": null,
        "ws-main": "immediatelyUpdate",
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
        const cmdType = ["moveDoc", "rename", "removeDoc"];
        if (cmdType.indexOf(detail.detail.cmd) != -1) {
            try {
                debugPush("检查刷新中（由重命名、删除或移动触发）");
                if (siyuanAPIs.getAllEditor == null) {
                    warnPush("不支持的思源版本，请关闭 及时更新 设置项! This version of SiYuan is not supported, please disable the 'immediatelyUpdate' setting!");
                    return;
                }
                const allEditor = siyuanAPIs.getAllEditor();
                const ids = getAllShowingDocId();
                if (ids != null && ids.length > 0) {
                    for (let editor of allEditor) {
                        if (ids.includes(editor.protyle.block.rootID)) {
                            debugPush("由重命名、删除或移动触发");
                            const hello = new CustomEvent("loaded-protyle-static", {
                                detail: { protyle: editor.protyle }
                            });

                            // dosth
                        }
                    }
                }
            }catch(err) {
                errorPush(err);
            }
        }
    }
    async openMenuDocTreeHandler(event: CustomEvent<IEventBusMap["open-menu-doctree"]>) {
        logPush("data", event.detail);
        if (event.detail.type !== "notebook") {
            // 获取所有id
            event.detail.menu.addItem({
                "label": "添加到索引范围",
                "click": (element, mouseEvent)=>{
                    const idList = [].map.call(event.detail.elements, (item)=>item.getAttribute("data-node-id"));
                    logPush("ids", idList);
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