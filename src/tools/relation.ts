import { z } from "zod";
import { createErrorResponse, createJsonResponse, createSuccessResponse } from "../utils/mcpResponse";
import { getBackLink2T, getChildBlocks, getNodebookList, listDocsByPathT, listDocTree } from "@/syapi";
import { McpToolsProvider } from "./baseToolProvider";
import { debugPush, logPush, warnPush } from "@/logger";
import { getBlockDBItem, getChildDocumentIds, getDocDBitem, getSubDocIds } from "@/syapi/custom";

export class RelationToolProvider extends McpToolsProvider<any> {
    async getTools(): Promise<McpTool<any>[]> {
        return [{
            name: "siyuan_get_doc_backlinks",
            description: "Retrieve all documents or blocks that reference a specified document or block within the workspace. The result includes the referencing document's ID, name, notebook ID, and path. Useful for understanding backlinks and document relationships within the knowledge base.",
            schema: {
                id: z.string().describe("The ID of the target document or block. The notebook where the target resides must be open."),
            },
            handler: getDocBacklink,
            title: "Get Note Relationship",
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: false,
            }
        },{
            "name": "siyuan_list_sub_docs",
            "description": "Retrieve the basic information of sub-documents under a specified document within the SiYuan workspace. Useful for analyzing document structure and hierarchy relationships.",
            "schema": {
                "id": z.string().describe("The ID of the parent document or notebook. The notebook containing this document must be open."),
            },
            "handler": getChildrenDocs,
            "title": "Get Sub-Document Information",
            "annotations": {
                "readOnlyHint": true,
                "destructiveHint": false,
                "idempotentHint": true
            }
        },{
            "name": "siyuan_get_children_blocks",
            "description": "根据父块的 ID，获取其下方的所有子块列表。这包括直接嵌套的块以及标题下方的块。过长的块内容将被省略、仅提供预览。有助于理解块的层级结构和内容组织。",
            "schema": {
                "id": z.string().describe("父块的唯一标识符（ID）。")
            },
            "handler": getChildBlocksTool,
            "title": "获取子块列表",
            "annotations": {
                "readOnlyHint": true,
                "destructiveHint": false,
                "idempotentHint": true
            }
        }]
    }
}

async function getDocBacklink(params, extra) {
    const {id} = params;
    const dbItem = await getBlockDBItem(id);
    if (dbItem == null) {
        return createErrorResponse("Invalid document or block ID. Please check if the ID exists and is correct.");
    }
    const backlinkResponse = await getBackLink2T(id, "3");
    debugPush("backlinkResponse", backlinkResponse);
    if (backlinkResponse.backlinks.length == 0) {
        return createSuccessResponse("No documents or blocks referencing the specified ID were found.");
    }
    const result = [];
    for (let i = 0; i < backlinkResponse.backlinks.length; i++) {
        const oneBacklinkItem = backlinkResponse.backlinks[i];
        if (oneBacklinkItem.nodeType === "NodeDocument") {
            let tempDocItem = {
                "name": oneBacklinkItem.name,
                "id": oneBacklinkItem.id,
                "notebookId": oneBacklinkItem.box,
                "hpath": oneBacklinkItem.hpath,
            };
            result.push(tempDocItem);
        }
    }
    return createJsonResponse(result);
}

async function getChildrenDocs(params, extra) {
    const { id } = params;
    const notebookList = await getNodebookList();
    const notebookIds = notebookList.map(item=>item.id);
    const sqlResult = await getDocDBitem(id);
    let result = null;
    if (sqlResult == null && !notebookIds.includes(id)) {
        return createErrorResponse("所查询的id不存在，或不对应笔记文档与笔记本，请检查输入的id是否正确有效");
    } else if (sqlResult == null) {
        result = await listDocsByPathT({notebook: id, path: "/"});
    } else {
        result = await listDocsByPathT({notebook: sqlResult["box"], path: sqlResult["path"]});
    }
    return createJsonResponse(result);
} 

async function getChildBlocksTool(params, extra) {
    const { id } = params;
    const sqlResult = await getBlockDBItem(id);
    if (sqlResult == null) {
        return createErrorResponse("Invalid document or block ID. Please check if the ID exists and is correct.");
    }
    return createJsonResponse(await getChildBlocks(id));
}