import { z } from "zod";
import { createErrorResponse, createJsonResponse, createSuccessResponse } from "../utils/mcpResponse";
import { queryAPI } from "@/syapi";
import databaseSchema from "@/../static/database_schema.md";
import { isSelectQuery } from "@/utils/commonCheck";
import { commonPushCheck, debugPush, logPush } from "@/logger";
import { McpToolsProvider } from "./baseToolProvider";

export class SqlToolProvider extends McpToolsProvider<any> {
    async getTools(): Promise<McpTool<any>[]> {
        return [
            {
                name: "siyuan_database_schema",
                description: "Provides the SiYuan database schema, including table names, field names, and their relationships, to help construct valid SQL queries for retrieving notes or note content. Returns the schema in markdown format.",
                schema: {},
                handler: schemaHandler,
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
    return createJsonResponse(sqlResult);
}

async function schemaHandler(params, extra) {
    debugPush("schema API被调用");
    return createSuccessResponse(databaseSchema);
}