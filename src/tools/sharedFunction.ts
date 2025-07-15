import { createDocWithPath } from "@/syapi";
import { checkIdValid, getDocDBitem } from "@/syapi/custom";
import { isValidNotebookId, isValidStr } from "@/utils/commonCheck";

export async function createNewDocWithParentId(parentId:string, title:string, markdownContent: string) {
    checkIdValid(parentId);
    // 判断是否是笔记本id
    const notebookIdFlag = isValidNotebookId(parentId);
    const newDocId = window.Lute.NewNodeID();
    const createParams = { 
        "notebook": parentId, 
        "path": `/${newDocId}.sy`, "title": title, "md": markdownContent, "listDocTree": false };
    if (!isValidStr(title)) createParams["title"] = "Untitled";
    if (!notebookIdFlag) {
        // 判断是否是笔记id
        const docInfo = await getDocDBitem(parentId);
        if (docInfo == null) {
            throw new Error("无效的输入参数`parentId`，parentId应当对应笔记本id或文档id，请检查输入的id参数");
        }
        createParams["path"] = docInfo["path"].replace(".sy", "") + createParams["path"];
        createParams["notebook"] = docInfo["box"];
    }
    // 创建
    const result = await createDocWithPath(createParams["notebook"], createParams["path"], createParams["title"], createParams["md"]);
    return {result, newDocId};
}