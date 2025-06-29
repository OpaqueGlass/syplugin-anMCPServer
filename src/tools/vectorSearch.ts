import { z } from "zod";
import { createErrorResponse, createJsonResponse, createSuccessResponse } from "../utils/mcpResponse";
import { appendBlockAPI } from "@/syapi";
import { checkIdValid, isADocId } from "@/syapi/custom";
import { McpToolsProvider } from "./baseToolProvider";
import { debugPush, logPush } from "@/logger";
import { getIndexer, getProvider } from "@/utils/indexerHelper";

export class DocVectorSearchProvider extends McpToolsProvider<any> {
    async getTools(): Promise<McpTool<any>[]> {
        return [{
            name: "siyuan_generate_answer_with_doc",
            description: '',
            schema: {
                question: z.string().describe("Describe question about note here"),
            },
            handler: answerWithRAG,
            annotations: {
                title: "Answer Question with siyuan document",
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
            }
        }];
    }
}

async function answerWithRAG(params, extra) {
    const { question } = params;
    debugPush("API被调用");
    const provider = getProvider();
    const result = provider.query(question);
    logPush("RAG result", result);
    return createJsonResponse(result);
}