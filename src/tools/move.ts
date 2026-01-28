import { z } from "zod";
import { createErrorResponse, createJsonResponse, createSuccessResponse } from "../utils/mcpResponse";
import { exportMdContent, foldBlock, getFileAPIv2, getKramdown, moveBlock, moveDocsByID, unfoldBlock } from "@/syapi";
import { McpToolsProvider } from "./baseToolProvider";
import { getBlockAssets, getBlockDBItem, getDocDBitem } from "@/syapi/custom";
import { blobToBase64Object } from "@/utils/common";
import { debugPush, errorPush, logPush } from "@/logger";
import { isContainerBlockType, isNonContainerBlockType, isValidNotebookId, isValidStr } from "@/utils/commonCheck";
import { lang } from "@/utils/lang";
import { filterBlock, filterNotebook } from "@/utils/filterCheck";
import { TASK_STATUS, taskManager } from "@/utils/historyTaskHelper";

export class MoveBlockToolProvider extends McpToolsProvider<any> {
    async getTools(): Promise<McpTool<any>[]> {
        return [{
            name: "siyuan_move_docs_by_ids", // 建议改为复数 docs 以体现批量功能
            description: "批量移动文档到目标位置。可以将一个或多个文档移动到指定的父文档下方，或直接移动到某个笔记本的根目录下。",
            schema: {
                ids: z.array(z.string()).min(1).describe("需要移动的文档 ID 列表。支持同时移动多个文档。"),
                toId: z.string().describe("目标位置 ID。如果该 ID 是文档，则所选文档将移动为它的子文档；如果该 ID 是笔记本 ID，则所选文档将移动到该笔记本的根目录。"),
            },
            handler: moveDocsByIds, // 记得对应修改 handler 以处理数组
            title: lang("tool_title_move_docs"),
            annotations: {
                destructiveHint: true, // 涉及大规模结构变更，保留此提示是合理的
            }
        },
        {
            name: "siyuan_move_block_by_id",
            description: "移动指定类型的块（如段落、标题、超级块、表格等）到目标位置。注意：此工具不支持移动文档块(Document Block)。",
            schema: {
                id: z.string().describe("需要移动的块的唯一 ID。"),
                previousId: z.string().optional().describe("插入位置参考 ID。被移动的块将作为此 ID 对应块的后置兄弟节点。此参数不能传入文档ID。"),
                parentId: z.string().optional().describe("插入位置的目标父块 ID。移动后的块将作为此父块的第一个子块。如果指定了 previousId，则忽略此参数。"),
                moveWithSubBlocks: z.boolean().default(false).describe("移动标题块子块。若设为 true 且 id对应标题块时，则该标题及其下属的所有子块（包括低级别标题和段落）将作为一个整体进行移动。使用此项，将丢失原有的折叠状态，移动后标题块将被展开。"),
            },
            handler: moveBlockById,
            title: lang("tool_title_move_block_by_id"),
            annotations: {
                destructiveHint: true,
            }
        }];
    }
}

async function moveDocsByIds(params, extra) {
    const { ids, toId } = params;
    debugPush("通过ID移动文档");
    // 检查输入
    // TODO: 是笔记本的情况
    if (isValidNotebookId(toId)) {
        if (filterNotebook(toId)) {
            return createErrorResponse("The specified target notebook is excluded by the user settings. So cannot write or read. ");
        }
    } else {
        const toDbItem = await getDocDBitem(toId);
        if (toDbItem == null) {
            return createErrorResponse("Invalid target document or notebook ID. Please check if the ID exists and is related to a document.");
        }
        if (await filterBlock(toId, toDbItem)) {
            return createErrorResponse("The specified target document or block is excluded by the user settings. So cannot write or read. ");
        }
    }
    // 检查文档是否有权限访问
    const recoveryDocIds = [];
    for (let id of ids) {
        const dbItem = await getDocDBitem(id);
        if (dbItem == null) {
            return createErrorResponse(`Invalid document ID: ${id}. Please check if the ID exists and is related to a document.`);
        }
        if (await filterBlock(id, dbItem)) {
            return createErrorResponse("The specified document or block is excluded by the user settings. So cannot write or read. ");
        }
        recoveryDocIds.push({
            id,
            path: dbItem.path
        });
    }
    // 开始移动
    const response = await moveDocsByID(ids, toId);
    
    taskManager.insert(ids, toId, "moveDocsByIds", { recoveryInfo: recoveryDocIds}, TASK_STATUS.APPROVED);
    
    return createSuccessResponse("Move documents successfully.");
}

async function moveBlockById(params, extra) {
    const { id, previousId, parentId, moveWithSubBlocks } = params;
    // 检查输入
    const dbItem = await getBlockDBItem(id);
    if (dbItem == null) {
        return createErrorResponse("Invalid block ID. Please check if the ID exists and is correct.");
    }
    if (dbItem.type === "d") {
        return createErrorResponse("Document blocks cannot be moved using this tool. Please use the document moving tool instead.");
    }
    if (await filterBlock(id, dbItem)) {
        return createErrorResponse("The specified document or block is excluded by the user settings. So cannot write or read. ");
    }
    let moveType = "", moveToId = "";
    if (isValidStr(previousId)) {
        moveType = "previousId";
        moveToId = previousId;
    } else if (isValidStr(parentId)) {
        moveType = "parentId";
        moveToId = parentId;
    } else {
        return createErrorResponse("Either previousId or parentId must be provided to specify the target location for moving the block.");
    }
    
    const moveToIdDbItem = await getBlockDBItem(moveToId);
    if (moveToIdDbItem == null) {
        return createErrorResponse(`Invalid ${moveType}. Please check if the ID exists and is correct.`);
    }
    if (await filterBlock(moveToId, moveToIdDbItem)) {
        return createErrorResponse("The specified document or block is excluded by the user settings. So cannot write or read. ");
    }
    // 避免移动到非容器块
    if (moveType === "parentId" && !isContainerBlockType(moveToIdDbItem.type)) {
        return createErrorResponse("Cannot move block under a non-container block. Please choose a valid container block as the target parent.");
    }
    // 避免非列表项块移动到列表块下
    if (moveType === "parentId" && moveToIdDbItem.type === "l" && dbItem.type !== "i") {
        return createErrorResponse("Can only move list item blocks under a list block. Please choose a valid list item block to move.");
    }
    if (moveType === "previousId" && moveToIdDbItem.type === "d") {
        return createErrorResponse("Cannot move block after a document block. Please choose a valid block as the target previous sibling.");
    }
    // 开始移动
    if (dbItem.type === "h" && moveWithSubBlocks) {
        await foldBlock(id);
    }
    try {
        if (moveType === "parentId") {
            await moveBlock(id, undefined, moveToId);
        } else {
            await moveBlock(id, moveToId, undefined);
        }
    }finally {
        if (dbItem.type === "h" && moveWithSubBlocks) {
            // 取消折叠
            await unfoldBlock(id);
        }
    }
    taskManager.insert(id, { moveType, moveToId }, "moveBlockById", { previousParentId: dbItem.parent_id }, TASK_STATUS.APPROVED);    
    return createSuccessResponse("Move block successfully.");
}
