import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "../utils/mcpResponse";
import { appendBlockAPI } from "@/syapi";
import { checkIdValid, isADocId } from "@/syapi/custom";
import { McpToolsProvider } from "./baseToolProvider";
import { debugPush } from "@/logger";

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