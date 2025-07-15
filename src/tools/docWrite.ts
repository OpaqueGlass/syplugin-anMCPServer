import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "../utils/mcpResponse";
import { appendBlockAPI, createDocWithPath } from "@/syapi";
import { checkIdValid, getDocDBitem, isADocId } from "@/syapi/custom";
import { McpToolsProvider } from "./baseToolProvider";
import { debugPush } from "@/logger";
import { createNewDocWithParentId } from "./sharedFunction";

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
            annotations: {
                title: "Append To Document",
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
            }
        }, {
            name: "siyuan_create_new_note_with_markdown_content",
            description: "Create a new note under a parent document in SiYuan with a specified title and Markdown content.",
            schema: {
                parentId: z.string().describe("The unique identifier (ID) of the parent document or notebook where the new note will be created."),
                title: z.string().describe("The title of the new note to be created."),
                markdownContent: z.string().describe("The Markdown content of the new note."),
            },
            handler: createNewNoteUnder,
            annotations: {
                title: "Create New Note",
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
    const result = await appendBlockAPI(markdownContent, id);
    if (result == null) {
        return createErrorResponse("Failed to append to the document");
    }

    return createSuccessResponse("Successfully appended, the block ID for the new content is " + result.id);
}

async function createNewNoteUnder(params, extra) {
    const { parentId, title, markdownContent } = params;
    debugPush("添加新笔记被调用");
    const {result, newDocId} = await createNewDocWithParentId(parentId, title, markdownContent);
    return result ? createSuccessResponse(`成功创建文档，文档id为：${newDocId}`) : createErrorResponse("An Error Occured");
}