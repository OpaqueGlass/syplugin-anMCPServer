import {z} from "zod";
import { createJsonResponse } from "../utils/mcpResponse";
import { DEFAULT_FILTER, fullTextSearchBlock } from "@/syapi";
import { McpTool } from "@/types";

export const fullTextSearchTool: McpTool<any> = {
    name: "siyuan_search",
    description: "Perform a keyword-based full-text search across blocks in SiYuan, such as paragraphs, optionally including code blocks and database blocks. Results are grouped by their containing documents.",
    schema: {
        query: z.string().describe("The keyword or phrase to search for across content blocks."),
        page: z.number().default(1).describe("The page number of the search results to return (starting from 1)."),
        includingCodeBlock: z.boolean().describe("Whether to include code blocks in the search results."),
        includingDatabase: z.boolean().describe("Whether to include database blocks in the search results.")
    },
    handler: searchHandler,
    annotations: {
        readOnlyHint: true,
    }
}

async function searchHandler(params, extra) {
    const {query, page, includingCodeBlock, includingDatabase} = params;
    const queryObj = {
        query,
        page,
        type: DEFAULT_FILTER
    }
    queryObj.type.codeBlock = includingCodeBlock;
    queryObj.type.databaseBlock = includingDatabase;
    const response = await fullTextSearchBlock(queryObj);
    return createJsonResponse(response);
}
