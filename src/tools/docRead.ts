import { z } from "zod";
import { createJsonResponse, createSuccessResponse } from "../utils/mcpResponse";
import { exportMdContent, getKramdown } from "@/syapi";
import { McpToolsProvider } from "./baseToolProvider";

export class DocReadToolProvider extends McpToolsProvider<any> {
    async getTools(): Promise<McpTool<any>[]> {
        return [{
            name: "siyuan_read_doc_content_markdown",
            description: 'Retrieve the content of a document or block by its ID',
            schema: {
                id: z.string().describe("The unique identifier of the document or block"),
                offset: z.number().default(0).describe("The starting character offset for partial content reading (for pagination/large docs)"),
                limit: z.number().default(10000).describe("The maximum number of characters to return in this request"),
            },
            handler: blockReadHandler,
            annotations: {
                title: "Read document",
                readOnlyHint: true,
            }
        }];
    }
}

async function blockReadHandler(params, extra) {
    const { id, offset = 0, limit = 10000 } = params;
    const markdown = await exportMdContent({id, refMode: 4, embedMode: 1, yfm: false});
    const content = markdown["content"] || "";
    const sliced = content.slice(offset, offset + limit);
    const hasMore = offset + limit < content.length;
    return createJsonResponse({
        content: sliced,
        offset,
        limit,
        "hasMore": hasMore,
        "totalLength": content.length
    });
}