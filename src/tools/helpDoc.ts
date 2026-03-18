import databaseSchema from "@/../static/database_schema.md";
import mdSyntax from "@/../static/data_md_syntax_CN.md";
import templateFunction from "@/../static/data_template_action_CN.md";
import { McpToolsProvider } from "./baseToolProvider";
import { createSuccessResponse } from "@/utils/mcpResponse";

export class HelpDocToolProvider extends McpToolsProvider<any> {
    async getTools(): Promise<McpTool<any>[]> {
        return [
            {
                name: "siyuan_markdown_syntax_help",
                description: "Provides help with the Markdown syntax used in SiYuan, including supported formatting options and usage examples.",
                schema: {},
                handler: markdownHelpHandler,
                // title: lang("tool_title_database_schema"),
                annotations: {
                    readOnlyHint: true,
                },
            },
            {
                name: "siyuan_template_function_help",
                description: "Provides help with the template functions available in SiYuan, including their syntax and usage examples.",
                schema: {},
                handler: templateFunctionHelpHandler,
                // title: lang("tool_title_template_function_help"),
                annotations: {
                    readOnlyHint: true,
                },
            },
            
        ];

    }
}

async function markdownHelpHandler(params, extra) {
    return createSuccessResponse(mdSyntax);
}

async function templateFunctionHelpHandler(params, extra) {
    return createSuccessResponse(templateFunction);
}