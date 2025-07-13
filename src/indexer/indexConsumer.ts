import { debugPush, logPush } from "@/logger";
import { exportMdContent } from "@/syapi";
import { getSubDocIds } from "@/syapi/custom";
import { isValidStr } from "@/utils/commonCheck";
import { useProvider, useQueue } from "@/utils/indexerHelper";
import { getPluginInstance } from "@/utils/pluginHelper";
import { IEventBusMap } from "siyuan";

export class IndexConsumer {
    _interval;

    start() {
        this._interval = setInterval(this.consume.bind(this), 5000);
    }
    stop() {
        clearInterval(this._interval);
    }
    async consume() {
        debugPush("queue consuming");
        const queue = useQueue();
        // 从队列中取出5个id
        const idItem = await queue.consume(5);
        // 扩充id，部分会提供hasChild选项，这个时候需要获取子文档
        const idList = [];
        for (let item of idItem) {
            idList.push(item["id"]);
            // OLD: 现在禁用了hasChild方式，由eventHandler获取
            // if (item["hasChild"]) {
            //     const subDocIds = await getSubDocIds(item["id"]);
            //     if (subDocIds != null && subDocIds.length > 0) {
            //         idList.push(...subDocIds);
            //     }
            // }
            // if (isValidStr(item["id"])) {
            //     idList.push(item["id"]);
            // }
        }
        // 获取id对应的文档内容
        const contentPromiseList = idList.map(item=>exportMdContent({id: item, refMode: 4, embedMode: 1, yfm: false}));
        const contentList = await Promise.all(contentPromiseList);
        // 发送
        const provider = useProvider();
        for (let i = 0; i < contentList.length; i++) {
            if (!isValidStr(idList[i]) || !isValidStr(contentList[i]["content"])) {
                debugPush("submit ERROR",  idList[i], contentList[i]["content"]);
                continue;
            }
            provider.update(idList[i], contentList[i]["content"]).catch(err=>{
                logPush("RAG提交索引时遇到问题，该提交已被重新暂存！");
            });
        }
    }
}