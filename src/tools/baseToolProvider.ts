import { McpTool } from "@/types";

export abstract class McpToolsProvider<T> {
    abstract getTools(): Promise<McpTool<T>[]>;
}