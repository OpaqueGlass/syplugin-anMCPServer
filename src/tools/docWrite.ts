import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "../utils/mcpResponse";
import { appendBlockAPI, createDocWithPath } from "@/syapi";
import { checkIdValid, getDocDBitem, isADocId } from "@/syapi/custom";
import { McpToolsProvider } from "./baseToolProvider";
import { debugPush } from "@/logger";
import { createNewDocWithParentId } from "./sharedFunction";

import { lang } from "@/utils/lang";
import { TASK_STATUS, taskManager } from "@/utils/historyTaskHelper";
import { filterBlock } from "@/utils/filterCheck";

export class DocWriteToolProvider extends McpToolsProvider<any> {
    async getTools(): Promise<McpTool<any>[]> {
        return [{
            name: "siyuan_append_markdown_to_doc",
            description: 'Append Markdown content to the end of a document in SiYuan by its ID.',
            schema: {
                id: z.string().describe("The unique identifier of the document to which the Markdown content will be appended."),
                markdownContent: z.string().describe("The Markdown-formatted text to append to the end of the specified document."),
            },
            handler: appendBlockHandler,
            title: lang("tool_title_append_markdown_to_doc"),
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
            }
        }, {
            name: "siyuan_create_note_with_md",
            description: "Create a new note under a parent document in SiYuan with a specified title and Markdown content.",
            schema: {
                parentId: z.string().describe("The unique identifier (ID) of the parent document or notebook where the new note will be created."),
                title: z.string().describe("The title of the new note to be created."),
                markdownContent: z.string().describe("The Markdown content of the new note."),
            },
            handler: createNewNoteUnder,
            title: lang("tool_title_create_new_note_with_markdown_content"),
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
            }
        }];
    }
}

async function appendBlockHandler(params, extra) {
    const { id, markdownContent } = params;
    debugPush("追加内容块API被调用");
    checkIdValid(id);
    if (!await isADocId(id)) {
        return createErrorResponse("Failed to append to document: The provided ID is not the document's ID.");
    }
    if (await filterBlock(id, null)) {
        return createErrorResponse("The specified document or block is excluded by the user settings. So cannot write or read. ");
    }
    const result = await appendBlockAPI(markdownContent, id);
    if (result == null) {
        return createErrorResponse("Failed to append to the document");
    }
    taskManager.insert(result.id, markdownContent, "appendToDocEnd", { docId: id}, TASK_STATUS.APPROVED);
    return createSuccessResponse("Successfully appended, the block ID for the new content is " + result.id);
}

async function createNewNoteUnder(params, extra) {
    const { parentId, title, markdownContent } = params;
    if (await filterBlock(parentId, null)) {
        return createErrorResponse("The specified document or block is excluded by the user settings, so cannot create a new note under it.");
    }
    debugPush("添加新笔记被调用");
    const {result, newDocId} = await createNewDocWithParentId(parentId, title, markdownContent);
    if (result) {
        taskManager.insert(newDocId, markdownContent, "createNewNoteUnder", {}, TASK_STATUS.APPROVED);
    }
    return result ? createSuccessResponse(`成功创建文档，文档id为：${newDocId}`) : createErrorResponse("An Error Occured");
}