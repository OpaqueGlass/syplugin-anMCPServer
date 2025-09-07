import { z } from "zod";
import { createErrorResponse, createJsonResponse, createSuccessResponse } from "../utils/mcpResponse";
import { McpToolsProvider } from "./baseToolProvider";
import { debugPush, errorPush, logPush } from "@/logger";
import { useConsumer, useProvider } from "@/utils/indexerHelper";
import { lang } from "@/utils/lang";

export class DocVectorSearchProvider extends McpToolsProvider<any> {
    async getTools(): Promise<McpTool<any>[]> {
        const indexProvider = useProvider();
        const healthResult = await indexProvider.health();
        if (healthResult == null) {
            logPush("Connection with RAG backend ERROR: (RAG Tool will not be load to MCP server)", healthResult);
            return [];
        }
        const EXPORT_API = async (question)=>{
            const provider = useProvider();
            return await provider.query(question)
        };
        if (window["OpaqueGlassAPI"]) {
            window["OpaqueGlassAPI"]["ragQuery"] = EXPORT_API;
        } else {
            window["OpaqueGlassAPI"] = {
                "ragQuery": EXPORT_API 
            }
        }
        window["OpaqueGlassAPI"][""]
        return [{
            name: "siyuan_generate_answer_with_doc",
            description: 'This tool provides a Retrieval-Augmented Generation (RAG) based Q&A capability. It generates context-aware answers using only the notes that the user has explicitly indexed from their siyuan-notes. Please note: the tool does not access or use all documents—only those that have been indexed by the user. ',
            schema: {
                question: z.string().describe("Describe question about note here"),
            },
            handler: answerWithRAG,
            title: lang("tool_title_generate_answer_with_doc"),
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
            }
        }];
    }
}

async function answerWithRAG(params, extra) {
    const { question } = params;
    debugPush("API被调用：RAG");
    const provider = useProvider();
    let progressInterval;
    let timeoutId;
    let finished = false;
    const progressToken = extra?._meta?.progressToken;
    let currentProgress = 0;
    const maxDuration = 120 * 1000; // 120秒
    const updateInterval = 3000; // 3秒
    const progressIncrement = updateInterval / maxDuration;

    if (progressToken) {
        progressInterval = setInterval(() => {
            currentProgress += progressIncrement;
            if (currentProgress < 0.95) {
                extra.sendNotification && extra.sendNotification({
                    method: "notifications/progress",
                    params: { progress: currentProgress, progressToken }
                });
            }
        }, updateInterval);
        timeoutId = setTimeout(() => {
            if (!finished) {
                finished = true;
                clearInterval(progressInterval);
                extra.sendNotification && extra.sendNotification({
                    method: "notifications/progress",
                    params: { progress: 1, progressToken }
                });
            }
        }, maxDuration);
    }
    try {
        const resultPromise = provider.query(question);
        const result = await Promise.race([
            resultPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error("RAG query timeout (120s)")), maxDuration))
        ]);
        finished = true;
        if (progressInterval) clearInterval(progressInterval);
        if (timeoutId) clearTimeout(timeoutId);
        if (progressToken) {
            extra.sendNotification && extra.sendNotification({
                method: "notifications/progress",
                params: { progress: 1, progressToken }
            });
        }
        logPush("RAG result", result);
        return createJsonResponse(result);
    } catch (err) {
        finished = true;
        if (progressInterval) clearInterval(progressInterval);
        if (timeoutId) clearTimeout(timeoutId);
        if (progressToken) {
            extra.sendNotification && extra.sendNotification({
                method: "notifications/progress",
                params: { progress: 1, progressToken }
            });
        }
        errorPush("RAG API error", err);
        return createErrorResponse("The tool call failed. " + (err?.message || "There was a problem with the connection to the RAG service. Please remind the user to troubleshoot the problem."));
    }
}