import { z } from "zod";
import { createErrorResponse, createJsonResponse, createSuccessResponse } from "../utils/mcpResponse";
import { DEFAULT_FILTER, fullTextSearchBlock, queryAPI } from "@/syapi";
import searchSyntax from "@/../static/query_syntax.md";
import { McpToolsProvider } from "./baseToolProvider";
import { formatSearchResult } from "@/utils/resultFilter";
import { debugPush, errorPush, isDebugMode, logPush } from "@/logger";
import { showMessage } from "siyuan";
import { lang } from "@/utils/lang";
import { isSelectQuery } from "@/utils/commonCheck";
import { getBlockDBItem } from "@/syapi/custom";
import { filterBlock } from "@/utils/filterCheck";
import sqlBlockDatabaseSchemaMD from "@/../static/database_schema.md";

export class SearchToolProvider extends McpToolsProvider<any> {
    async _getTools(): Promise<McpTool<any>[]> {
        return [{
                name: "siyuan_query_sql",
                description: `Execute read-only SQL queries to fetch notes and structured data from SiYuan. 
Mandatory Step: Before writing your SQL, you MUST read the 'sql_contentblock_db_schema' resource (or use the 'siyuan_sql_helpdoc' tool) to verify table names, field types, and JOIN relationships. 
Use this tool for:
1. Complex content searches that simple keyword searches can't handle.
2. Retrieving specific document metadata or block-level content.
Note: Only SELECT statements are supported.`,
                schema: {
                    stmt: z.string().describe("A valid SQL SELECT statement to execute"),
                },
                handler: sqlHandler,
                // title: lang("tool_title_query_sql"),
                annotations: {
                    readOnlyHint: true,
                },
            }, {
                name: "siyuan_sql_helpdoc",
                description: "Provides documentation about the SiYuan content search database schema relevant to content blocks, including table names, field names, and relationships. This information is essential for constructing effective SQL queries when using the `siyuan_query_sql` tool.",
                schema: {},
                handler: async (params, extra) => {
                    return createSuccessResponse(sqlBlockDatabaseSchemaMD);
                },
                annotations: {
                    readOnlyHint: true,
                },
            }
        ];// # 16 删除容易混淆的工具
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
                title: lang("tool_title_search"),
                annotations: {
                    readOnlyHint: true,
                },
            },
            {
                name: "siyuan_query_syntax",
                description: `Provides documentation about SiYuan's advanced query syntax for searching content blocks, including boolean operators (AND, OR, NOT).`,
                schema: {},
                handler: querySyntaxHandler,
                title: lang("tool_title_query_syntax"),
                annotations: {
                    readOnlyHint: true,
                },
            },
        ];
    }
}


async function sqlHandler(params, extra) {
    const { stmt } = params;
    debugPush("SQL API 被调用", stmt);
    if (!isSelectQuery(stmt)) {
        return createErrorResponse("Not a SELECT statement");
    }
    let sqlResult;
    try {
        sqlResult = await queryAPI(stmt);
    } catch (error) {
        return createErrorResponse(error instanceof Error ? error.message : String(error));
    }
    debugPush("SQLAPI返回ing", sqlResult);
    // 如果sql返回字段包括id， 需要筛选id，将被过滤掉的id去除
    if (sqlResult.length > 0 && sqlResult.length < 300 && 'id' in sqlResult[0]) {
        const filteredResult = [];
        for (const row of sqlResult) {
            const id = row['id'];
            const dbItem = await getBlockDBItem(id);
            if (dbItem && await filterBlock(id, dbItem) === false) {
                filteredResult.push(dbItem);
            }
        }
        sqlResult = filteredResult;
    }
    return createJsonResponse(sqlResult);
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