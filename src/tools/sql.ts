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
                name: "siyuan_query_sql",
                description: 'Executes SQL queries to retrieve data from the SiYuan database. Provide a valid SQL SELECT statement to query the database. Use the "siyuan_database_schema" tool to understand the database schema, including table names, field names, and relationships, before writing your query.',
                schema: {
                    stmt: z.string().describe("A valid SQL SELECT statement to execute"),
                },
                handler: sqlHandler,
                annotations: {
                    readOnlyHint: true,
                },
            },
            {
                name: "siyuan_database_schema",
                description: "Provides the SiYuan database schema, including table names, field names, and their relationships, to help construct valid SQL queries. Return the markdown content.",
                schema: {},
                handler: schemaHandler,
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
    const sqlResult = await queryAPI(stmt);
    return createJsonResponse(sqlResult);
}

async function schemaHandler(params, extra) {
    debugPush("schema API被调用");
    return createSuccessResponse(databaseSchema);
}