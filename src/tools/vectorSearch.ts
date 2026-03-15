import { z } from "zod";
import { createErrorResponse, createJsonResponse, createSuccessResponse } from "../utils/mcpResponse";
import { McpToolsProvider } from "./baseToolProvider";
import { debugPush, errorPush, logPush } from "@/logger";
import { useConsumer, useProvider } from "@/utils/indexerHelper";
import { lang } from "@/utils/lang";
import { isPluginExist, showPluginMessage, sleep } from "@/utils/common";

let userAlerted = false;
export class DocVectorSearchProvider extends McpToolsProvider<any> {
    async getTools(): Promise<McpTool<any>[]> {
        if (!window["__opaqueGlassVectorIndexService"]) {
            if (isPluginExist("syplugin-vectorIndexClient")) {
                await sleep(3000);
            }
            if (!window["__opaqueGlassVectorIndexService"]) {
                return [];
            }
        }
        if (window["__opaqueGlassVectorIndexService"]["versionCode"] !== 1) { 
            if (!userAlerted) {
                showPluginMessage("syplugin-vectorIndexClient版本不符，无法启用RAG，请将两插件都升级到最新版。");
            }
            userAlerted = true;
            return [];
        }
        const api = window["__opaqueGlassVectorIndexService"]["api"];
        if (!await api["isAvailable"]()) {
            logPush("RAG工具依赖的向量索引服务不可用，无任一后端处于启用状态，不提供RAG工具");
            return [];
        }
        return [{
            name: "siyuan_get_available_rag_service_type",
            description: '获取思源笔记中当前可用的 RAG（检索增强生成）服务列表及其 ID。在调用 siyuan_rag_query 之前，必须先通过此工具确定有效的 serviceId。',
            schema: {},
            handler: async (params, extra)=>{
                const result = await window["__opaqueGlassVectorIndexService"]["api"]["getAvailableServices"]();
                debugPush("获取可用RAG服务列表", result);
                return createJsonResponse(result);
            },
            // title: lang("tool_title_generate_answer_with_doc"),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: false,
            }
        },
        {
            name: "siyuan_rag_query",
            description: '基于指定的 RAG 服务，在思源笔记本地知识库中检索相关文档。lightRAG为生成回答，而其他为检索文档，只提供相关文档块。调用前请先使用 siyuan_get_available_rag_service_type 工具获取有效的 serviceId。',
            schema: {
                "text": z.string().describe("用户输入的查询文本"),
                "serviceId": z.string().optional().describe("要使用的RAG服务ID，调用siyuan_get_available_rag_service_type接口获取")
            },
            handler: async (params, extra) => {
                const { text, serviceId } = params;
                const result = await window["__opaqueGlassVectorIndexService"]["api"]["query"](text, serviceId);
                const TRIM_SIZE = 5;
                for (const item of result) {
                    if (item.matchedBlocks && item.matchedBlocks.length > TRIM_SIZE) {
                        item.matchedBlocks = item.matchedBlocks.slice(0, TRIM_SIZE);
                    }
                }
                debugPush("RAG查询结果", result);
                return createJsonResponse(result);
            },
            // title: lang("tool_title_generate_answer_with_doc"),
            annotations: {
                readOnlyHint: true,
                destructiveHint: false,
                idempotentHint: false,
            }
        }
        ];
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