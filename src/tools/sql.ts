import { z } from "zod";
import { createErrorResponse, createJsonResponse, createSuccessResponse } from "../utils/mcpResponse";
import { queryAPI } from "@/syapi";
import databaseSchema from "@/../static/database_schema.md";
import { isSelectQuery } from "@/utils/commonCheck";
import { commonPushCheck, debugPush, logPush } from "@/logger";
import { McpToolsProvider } from "./baseToolProvider";
import { lang } from "@/utils/lang";
import { getBlockDBItem } from "@/syapi/custom";
import { filterBlock } from "@/utils/filterCheck";

export class SqlToolProvider extends McpToolsProvider<any> {
    async getTools(): Promise<McpTool<any>[]> {
        return [
            {
                name: "siyuan_database_schema",
                description: "Provides the SiYuan database schema, including table names, field names, and their relationships, to help construct valid SQL queries for retrieving notes or note content. Returns the schema in markdown format.",
                schema: {},
                handler: schemaHandler,
                title: lang("tool_title_database_schema"),
                annotations: {
                    readOnlyHint: true,
                },
            },
            {
                name: "siyuan_query_sql",
                description: `Execute SQL queries to retrieve data (including notes, documents, and their content) from the SiYuan database. This tool is also used when you need to search notes content.
Always use the 'siyuan_database_schema' tool to understand the database schema, including table names, field names, and relationships, before writing your query and use this tool.`,
                schema: {
                    stmt: z.string().describe("A valid SQL SELECT statement to execute"),
                },
                handler: sqlHandler,
                title: lang("tool_title_query_sql"),
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

async function schemaHandler(params, extra) {
    debugPush("schema API被调用");
    return createSuccessResponse(databaseSchema);
}