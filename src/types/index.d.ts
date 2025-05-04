import {z} from "zod";

export type McpTextContent = {
    [x: string]: unknown;
    type: "text";
    text: string;
};

export type McpImageContent = {
    [x: string]: unknown;
    type: "image";
    data: string;
    mimeType: string;
};

export type McpResourceContent = {
    [x: string]: unknown;
    type: "resource";
    resource: {
        [x: string]: unknown;
        text: string;
        uri: string;
        mimeType?: string;
    } | {
        [x: string]: unknown;
        uri: string;
        blob: string;
        mimeType?: string;
    };
};

export type McpContent = McpTextContent | McpImageContent | McpResourceContent;

/**
 * Standard MCP response format
 * Must match the MCP SDK expected format
 */
interface McpResponse {
    [x: string]: unknown;
    content: McpContent[];
    isError?: boolean;
    _meta?: Record<string, unknown>;
}
export interface McpTool<T> {
    /**
     * The name of the tool
     */
    name: string;

    /**
     * The description of the tool
     */
    description: string;

    /**
     * The Zod schema for validating tool arguments
     * This should be a record of Zod validators
     * For tools with no parameters, use {} (empty object)
     */
    schema: Record<string, z.ZodType<any>> | undefined;

    /**
     * The handler function for the tool
     */
    handler: (args: T, extra: any) => Promise<McpResponse>;

    /**
     * The tool annotations
     */
    annotations?: {        // Optional hints about tool behavior
        title?: string;      // Human-readable title for the tool
        readOnlyHint?: boolean;    // If true, the tool does not modify its environment
        destructiveHint?: boolean; // If true, the tool may perform destructive updates
        idempotentHint?: boolean;  // If true, repeated calls with same args have no additional effect
        openWorldHint?: boolean;   // If true, tool interacts with external entities
    }
}