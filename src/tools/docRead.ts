import {z} from "zod";
import { createErrorResponse, createJsonResponse, createSuccessResponse } from "../utils/mcpResponse";
import { getKramdown } from "@/syapi";
import { McpTool } from "@/types";
export const blockReadTool: McpTool<any> = {
    name: "siyuan_read_doc_content_markdown",
    description: 'Retrieve the content of a document or block by its ID',
    schema: {
        id: z.string().describe("The unique identifier of the document or block")
    },
    handler: blockReadHandler,
    annotations: {
        title: "Read document",
        readOnlyHint: true,
    }
}

async function blockReadHandler(params, extra) {
    const {id} = params;
    const kramdown = await getKramdown(id, true);
    
    return createJsonResponse(kramdown);
}