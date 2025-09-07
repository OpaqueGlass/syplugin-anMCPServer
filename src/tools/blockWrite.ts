import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "../utils/mcpResponse";
import { appendBlockAPI, insertBlockOriginAPI, prependBlockAPI, updateBlockAPI } from "@/syapi";
import { checkIdValid, getBlockDBItem } from "@/syapi/custom";
import { McpToolsProvider } from "./baseToolProvider";
import { debugPush } from "@/logger";

import { lang } from "@/utils/lang";
import { isNonContainerBlockType, isValidNotebookId, isValidStr } from "@/utils/commonCheck";
import { TASK_STATUS, taskManager } from "@/utils/historyTaskHelper";
import { getPluginInstance } from "@/utils/pluginHelper";

export class BlockWriteToolProvider extends McpToolsProvider<any> {
    async getTools(): Promise<McpTool<any>[]> {
        return [{
            name: "siyuan_insert_block",
            description: "在指定位置插入一个新块。插入内容必须是 markdown 格式。插入位置可通过 `nextID` (后一个块ID)、`previousID` (前一个块ID) 或 `parentID` (父块ID) 之一来锚定。`nextID` 的优先级最高。",
            schema: {
                data: z.string().describe("待插入的 markdown 格式的块内容"),
                nextID: z.string().optional().describe("后一个块的ID，用于指定插入位置"),
                previousID: z.string().optional().describe("前一个块的ID，用于指定插入位置"),
                parentID: z.string().optional().describe("父块的ID，用于指定插入位置，父块必须是容器块，例如引述块、文档块等，但不包含标题块")
            },
            handler: insertBlockHandler,
            title: lang("tool_title_insert_block"),
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false
            }
        }, {
            name: "siyuan_prepend_block",
            description: "在指定父块的子块列表最前面插入一个新块，内容为 markdown 格式。",
            schema: {
                data: z.string().describe("待插入的 markdown 格式的块内容"),
                parentID: z.string().describe("父块的ID，父块必须是容器块，例如引述块、文档块等")
            },
            handler: prependBlockHandler,
            title: lang("tool_title_prepend_block"),
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false
            }
        }, {
            name: "siyuan_append_block",
            description: "在指定父块的子块列表最后面插入一个新块，内容为 markdown 格式。",
            schema: {
                data: z.string().describe("待插入的 markdown 格式的块内容"),
                parentID: z.string().describe("父块的ID，父块必须是容器块，例如引述块、文档块等")
            },
            handler: appendBlockHandler,
            title: lang("tool_title_append_block"),
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false
            }
        },{
            name: "siyuan_update_block",
            description: "根据块ID更新现有块的内容，内容应当是 Kramdown 格式。使用markdown格式将丢失块的属性等信息。",
            schema: {
                data: z.string().describe("用于更新块的新内容，为 Kramdown 格式"),
                id: z.string().describe("待更新块的ID")
            },
            handler: updateBlockHandler,
            title: lang("tool_title_update_block"),
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: false
            }
        }];
    }
}

async function insertBlockHandler(params, extra) {
    const { data, nextID, previousID, parentID } = params;
    debugPush("插入内容块API被调用");
    if (isValidNotebookId(nextID) || isValidNotebookId(previousID) || isValidNotebookId(parentID)) {
        return createErrorResponse("nextID, previousID, and parentID must be block IDs, not notebook IDs.");
    }
    if (isValidStr(parentID)) {
        const dbItem = await getBlockDBItem(parentID);
        if (dbItem == null) {
            return createErrorResponse("Invalid parentID: The specified parent block does not exist.");
        }
        if (isNonContainerBlockType(dbItem.type)) {
            return createErrorResponse("Invalid parentID: Cannot insert a block under a non-container block.");
        }
    }
    const response = await insertBlockOriginAPI({data, dataType: "markdown", nextID, previousID, parentID});
    if (response == null) {
        return createErrorResponse("Failed to insert the block");
    }
    taskManager.insert(response[0].doOperations[0].id, data, "insertBlock", { parentID }, TASK_STATUS.APPROVED);
    return createSuccessResponse("Successfully inserted. The first block ID is " + response[0].doOperations[0].id + ". Multiple blocks may have been created depending on the content.");
}

async function prependBlockHandler(params, extra) {
    const { data, parentID } = params;
    debugPush("前置内容块API被调用");
    // 检查块存在
    checkIdValid(parentID);
    if (isValidNotebookId(parentID)) {
        return createErrorResponse("parentID must be a block ID, not a notebook ID.");
    }
    const dbItem = await getBlockDBItem(parentID);
    if (dbItem == null) {
        return createErrorResponse("Invalid parentID: The specified parent block does not exist.");
    }
    if (isNonContainerBlockType(dbItem.type)) {
        return createErrorResponse("Invalid parentID: Cannot insert a block under a non-container block.");
    }
    // 执行
    const response = await prependBlockAPI(data, parentID);
    if (response == null) {
        return createErrorResponse("Failed to prepend the block");
    }
    taskManager.insert(response.id, data, "prependBlock", { parentID }, TASK_STATUS.APPROVED);
    return createSuccessResponse("Successfully prepended. The first block ID is " + response.id + ". Multiple blocks may have been created depending on the content.");
}

async function appendBlockHandler(params, extra) {
    const { data, parentID } = params;
    debugPush("追加内容块API被调用");
    // 需要确认：1) 块存在 2) 块是文档块、不是notebook、不是paragraph
    checkIdValid(parentID);
    if (isValidNotebookId(parentID)) {
        return createErrorResponse("parentID must be a block ID, not a notebook ID.");
    }
    const dbItem = await getBlockDBItem(parentID);
    if (dbItem == null) {
        return createErrorResponse("Invalid parentID: The specified parent block does not exist.");
    }
    if (isNonContainerBlockType(dbItem.type)) {
        return createErrorResponse("Invalid parentID: Cannot insert a block under a non-container block.");
    }
    //执行
    const result = await appendBlockAPI(data, parentID);
    if (result == null) {
        return createErrorResponse("Failed to append to the block");
    }
    taskManager.insert(result.id, data, "appendBlock", { parentID }, TASK_STATUS.APPROVED);
    return createSuccessResponse("Successfully appended. The first block ID is " + result.id + ". Multiple blocks may have been created depending on the content.");
}


async function updateBlockHandler(params, extra) {
    const { data, id } = params;
    // 检查块存在
    checkIdValid(id);
    const blockDbItem = await getBlockDBItem(id);
    if (blockDbItem == null) {
        return createErrorResponse("Invalid block ID. Please check if the ID exists and is correct.");
    }
    if (blockDbItem.type === "av") {
        return createErrorResponse("Cannot update attribute view (i.e. Database) blocks.");
    }
    // 执行
    const plugin = getPluginInstance();
    const autoApproveLocalChange = plugin?.mySettings["autoApproveLocalChange"];
    if (autoApproveLocalChange) {
        const response = await updateBlockAPI(data, id);
        if (response == null) {
            return createErrorResponse("Failed to update the block");
        }
        taskManager.insert(id, data, "updateBlock", {}, TASK_STATUS.APPROVED);
        return createSuccessResponse("Block updated successfully.");
    } else {
        taskManager.insert(id, data, "updateBlock", {}, TASK_STATUS.PENDING);
        return createSuccessResponse("Changes have entered the waiting queue, please remind users to review ");
    }
}
