import {z} from "zod";
import { createErrorResponse, createJsonResponse, createSuccessResponse } from "../utils/mcpResponse";
import { appendBlockAPI, getKramdown } from "@/syapi";
import { McpTool } from "@/types";
import { checkIdValid, isADocId } from "@/syapi/custom";
export const appendToDocTool: McpTool<any> = {
    name: "siyuan_append_markdown_to_doc",
    description: 'Append Markdown content to the end of a document in SiYuan by its ID.',
    schema: {
        id: z.string().describe("The unique identifier of the document to which the Markdown content will be appended."),
        markdownContent: z.string().describe("The Markdown-formatted text to append to the end of the specified document."),
    },
    handler: appendBlockHandler,
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
    }
}

async function appendBlockHandler(params, extra) {
    const {id, markdownContent} = params;
    checkIdValid(id);
    if (!await isADocId(id)) {
        return createErrorResponse("Failed to append to document: The provided ID is not the document's ID.");
    }    
    const result = await appendBlockAPI(markdownContent, id);
    if (result == null) {
        return createErrorResponse("Failed to append to the document");
    }
    
    return createSuccessResponse("Successfully appened, the block ID for the new content is " + result.id);
}