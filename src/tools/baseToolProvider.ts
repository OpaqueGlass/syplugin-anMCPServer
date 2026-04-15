import { mcpToolCheckPermissionWrapper } from "@/utils/filterCheck";

export abstract class McpToolsProvider<T> {
    cachedToolHandlers: {[key: string]: (args: any, extra: any) => Promise<any>} = {};
    _getHandler(tool: McpTool<T>): (args: any, extra: any) => Promise<any> {
        let toolName = tool.name || "default";
        if (!this.cachedToolHandlers[toolName]) {
            this.cachedToolHandlers[toolName] = mcpToolCheckPermissionWrapper(tool.handler, tool.annotations);
        }
        return this.cachedToolHandlers[toolName];
    }
    getTools(): Promise<McpTool<T>[]> {
        const tools = this._getTools().then(tools => {
            for (const tool of tools) {
                tool.handler = this._getHandler(tool);
            }
            return tools;
        });
        return tools;
    }
    abstract _getTools(): Promise<McpTool<T>[]>;
}