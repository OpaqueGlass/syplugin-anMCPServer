import { z } from "zod";
import { createJsonResponse, createSuccessResponse } from "../utils/mcpResponse";
import { DEFAULT_FILTER, fullTextSearchBlock } from "@/syapi";
import searchSyntax from "@/../static/query_syntax.md";
import { McpToolsProvider } from "./baseToolProvider";
import { formatSearchResult } from "@/utils/resultFilter";
import { debugPush, errorPush, isDebugMode, logPush } from "@/logger";
import { showMessage } from "siyuan";

export class SearchToolProvider extends McpToolsProvider<any> {
    async getTools(): Promise<McpTool<any>[]> {
        return [
            {
                name: "siyuan_search",
                description: "Perform a keyword-based full-text search across blocks in SiYuan (e.g., paragraphs, headings). This tool only matches literal text content in document bodies or headings. For dynamic queries (dailynote(i.e. diary), path restrictions, date ranges), use sql with `siyuan_query_sql` tool instead. Results are grouped by their containing documents with limit page size 10.",
                schema: {
                    query: z.string().describe("The keyword or phrase to search for across content blocks."),
                    page: z.number().default(1).describe("The page number of the search results to return (starting from 1)."),
                    includingCodeBlock: z.boolean().describe("Whether to include code blocks in the search results."),
                    includingDatabase: z.boolean().describe("Whether to include database blocks in the search results."),
                    method: z.number().default(0).describe("Search method: 0 for keyword search, 1 for query syntax (see `siyuan_query_syntax`), 2 for regular expression matching."),
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
                },
            },
            {
                name: "siyuan_query_syntax",
                description: `Provides documentation about SiYuan's advanced query syntax for searching content blocks, including boolean operators (AND, OR, NOT).`,
                schema: {},
                handler: querySyntaxHandler,
                annotations: {
                    readOnlyHint: true,
                },
            },
        ];
    }
}

async function searchHandler(params, extra) {
    const { query, page, includingCodeBlock, includingDatabase, method, orderBy, groupBy } = params;
    debugPush("搜索工具被调用", params);
    const queryObj: FullTextSearchQuery = {
        query,
        page,
        types: DEFAULT_FILTER,
        orderBy,
        method,
        groupBy,
    };
    queryObj.types.codeBlock = includingCodeBlock;
    queryObj.types.databaseBlock = includingDatabase;
    const response = await fullTextSearchBlock(queryObj);
    try {
        const result = formatSearchResult(response, queryObj);
        return createSuccessResponse(result);
    } catch (err) {
        errorPush("精简搜索API返回时出现问题", err);
        if (isDebugMode()) {
            showMessage("搜索API处理时出现问题");
        }
        return createJsonResponse(response);
    } finally {
        debugPush("搜索工具调用结束");
    }
}

async function querySyntaxHandler(params, extra) {
    return createSuccessResponse(searchSyntax);
}