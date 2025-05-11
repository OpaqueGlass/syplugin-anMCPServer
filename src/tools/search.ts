import {z} from "zod";
import { createJsonResponse, createSuccessResponse } from "../utils/mcpResponse";
import { DEFAULT_FILTER, fullTextSearchBlock } from "@/syapi";
import { McpTool } from "@/types";
import searchSyntax from "@/../static/query_syntax.md"

export const fullTextSearchTool: McpTool<any> = {
    name: "siyuan_search",
    description: "Perform a keyword-based full-text search across blocks in SiYuan, such as paragraphs, optionally including code blocks and database blocks. Results are grouped by their containing documents with limit page size 10.",
    schema: {
        query: z.string().describe("The keyword or phrase to search for across content blocks."),
        page: z.number().default(1).describe("The page number of the search results to return (starting from 1)."),
        includingCodeBlock: z.boolean().describe("Whether to include code blocks in the search results."),
        includingDatabase: z.boolean().describe("Whether to include database blocks in the search results."),
        method: z.number().default(0).describe("Search method: 0 for keyword search, 1 for query syntax (see documentation), 2 for regular expression matching."),
        orderBy: z.number().default(0).describe(`Sorting method for results:
            0: By block type (default)
            1: By creation time (ascending)
            2: By creation time (descending)
            3: By update time (ascending)
            4: By update time (descending)
            5: By content order (only when grouped by document)
            6: By relevance (ascending)
            7: By relevance (descending)
        `),
        groupBy: z.number().default(1).describe(`Grouping method for results:
            0: No grouping - returns individual blocks matching the search criteria
            1: Group by document (default) - returns hits organized by their parent documents
        `),
    },
    handler: searchHandler,
    annotations: {
        readOnlyHint: true,
    }
}

async function searchHandler(params, extra) {
    const {query, page, includingCodeBlock, includingDatabase, method, orderBy, groupBy} = params;
    const queryObj = {
        query,
        page,
        type: DEFAULT_FILTER,
        orderBy,
        method,
        groupBy
    }
    queryObj.type.codeBlock = includingCodeBlock;
    queryObj.type.databaseBlock = includingDatabase;
    const response = await fullTextSearchBlock(queryObj);
    return createJsonResponse(response);
}


export const querySyntaxHelper: McpTool<any> = {
    name: "siyuan_query_syntax",
    description: `Provides detailed documentation about SiYuan's advanced query syntax for searching content blocks. This includes:

* Search method options (keyword, query syntax, regex)
* String and phrase construction rules
* Boolean operators (AND, OR, NOT) and grouping with parentheses
* Special characters handling and escaping rules
* Tokenization behavior for Chinese and English text

The syntax supports complex search patterns across paragraphs, headings, code blocks and database content. Use this reference to construct precise queries for the siyuan_search tool.`,
    schema: {},
    handler: querySyntaxHandler
}

async function querySyntaxHandler(params, extra) {
    return createSuccessResponse(searchSyntax);
}