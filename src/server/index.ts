import { debugPush, errorPush, logPush } from '../logger';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Request, Response } from "express";
import * as express from "express";
import { DailyNoteToolProvider} from '@/tools/dailynote';
import { getPluginInstance } from '@/utils/pluginHelper';
import { CONSTANTS } from '@/constants';
import { showMessage } from 'siyuan';
import { lang } from '@/utils/lang';
import { DocWriteToolProvider } from '@/tools/docWrite';
import { SearchToolProvider } from '@/tools/search';
import { SqlToolProvider } from '@/tools/sql';
import { DocReadToolProvider } from '@/tools/docRead';
import { isValidStr } from '@/utils/commonCheck';
import { isAuthTokenValid } from '@/utils/crypto';
import { RelationToolProvider } from '@/tools/relation';
import { DocVectorSearchProvider } from '@/tools/vectorSearch';
import { FlashcardToolProvider } from '@/tools/flashCard';
import promptCreateCardsSystemCN from '@/../static/prompt_create_cards_system_CN.md';
import promptQuerySystemCN from '@/../static/prompt_dynamic_query_system_CN.md';
import { AttributeToolProvider } from '@/tools/attributes';
import { BlockWriteToolProvider } from '@/tools/blockWrite';
import {
    isCloudflareAccessConfigured,
    extractCloudflareAccessToken,
    validateCloudflareAccessToken
} from '@/utils/cloudflareAccess';

const http = require("http");

/**
 * Validates authentication for incoming requests.
 * Supports both Bearer token and Cloudflare Access JWT authentication.
 * @returns true if authenticated, false otherwise
 */
async function validateAuthentication(req: Request): Promise<{ authenticated: boolean; method?: string; error?: string }> {
    const plugin = getPluginInstance();
    const authToken = plugin?.mySettings["authCode"];
    const hasBearerAuth = isValidStr(authToken) && authToken !== CONSTANTS.CODE_UNSET;
    const hasCfAccessAuth = isCloudflareAccessConfigured();

    // If no authentication is configured, allow access
    if (!hasBearerAuth && !hasCfAccessAuth) {
        return { authenticated: true, method: "none" };
    }

    // Try Cloudflare Access authentication first (if configured)
    if (hasCfAccessAuth) {
        const cfToken = extractCloudflareAccessToken(req.headers as Record<string, string | string[] | undefined>);
        if (cfToken) {
            const payload = await validateCloudflareAccessToken(cfToken);
            if (payload) {
                logPush("Authenticated via Cloudflare Access:", payload.email || payload.sub);
                return { authenticated: true, method: "cloudflare-access" };
            }
            // If CF token present but invalid, don't fall back to bearer token
            return { authenticated: false, error: "Invalid Cloudflare Access token" };
        }
    }

    // Try Bearer token authentication (if configured)
    if (hasBearerAuth) {
        const authHeader = req.headers["authorization"];
        const token = authHeader?.replace("Bearer ", "");
        logPush("auth", authHeader);
        if (await isAuthTokenValid(token)) {
            return { authenticated: true, method: "bearer-token" };
        }
        if (authHeader) {
            return { authenticated: false, error: "Invalid Bearer token" };
        }
    }

    // No valid authentication provided
    return { authenticated: false, error: "Authentication required" };
}

export default class MyMCPServer {
    runningFlag: boolean = false;
    httpServer: any = null;
    mcpServer: McpServer = null;
    expressApp: express.Application = null;
    sseTransports: { [id: string]: SSEServerTransport } = {};
    transports: { [id: string]: StreamableHTTPServerTransport } = {};
    workingPort: number = -1;
    constructor() {
        this.mcpServer = new McpServer({
            "name": "siyuan",
            "version": "0.6.0"
        }, {
            "capabilities": {
                "tools": {},
                "prompts": {},
            }
        });
    }
    cleanTransport(transport) {
        if (transport == null) {
            return;
        }
        transport.close();
        // this.transports[transport.sessionId]?.close();
        // delete this.transports[transport.sessionId];
    }
    initialize() {
        logPush("hello mcp server");
        this.expressApp = express();
        this.expressApp.get('/health', (_, res) => {
            res.status(200).send("ok");
        });
        
        /* SSE Deprecated */
        this.expressApp.get("/sse", async (req: Request, res: Response) => {
            const authResult = await validateAuthentication(req);
            if (!authResult.authenticated) {
                res.status(403).send(authResult.error || "Authentication required. 鉴权失败");
                return;
            }
            showMessage(lang("sse_warning"), 7000);
            const transport = new SSEServerTransport(
                "/messages",
                res,
            );
            logPush("新SSE连接", transport.sessionId, req);

            this.sseTransports[transport.sessionId] = transport;
            res.on("close", () => {
                logPush("SSE连接断开", transport.sessionId);
                this.sseTransports[transport.sessionId].close();
                delete this.sseTransports[transport.sessionId];
            });
            res.on("error", (e)=>{
                logPush("SSE连接断开", transport.sessionId, e.message);
                this.sseTransports[transport.sessionId].close();
                delete this.sseTransports[transport.sessionId];
            });
            await this.mcpServer.connect(transport);
        });

        this.expressApp.post("/messages", async (req: Request, res: Response) => {
            const sessionId = req.query.sessionId as string;
            if (!this.sseTransports[sessionId]) {
                res.status(400).send(`No transport found for sessionId ${sessionId}`);
                return;
            }
            logPush("SSE-messages", sessionId);
            await this.sseTransports[sessionId].handlePostMessage(req, res);
        });
        /* New Way */
        this.expressApp.post("/mcp", async (req: Request, res: Response) => {
            const authResult = await validateAuthentication(req);
            if (!authResult.authenticated) {
                res.status(403).send(authResult.error || "Authentication required. 鉴权失败");
                return;
            }
            try {
                const transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: undefined,
                });
                logPush("New Connection", transport.sessionId);
                // this.transports[transport.sessionId] = transport;
                res.on('close', ()=>{
                    logPush("Session Close", transport.sessionId);
                    this.cleanTransport(transport);
                });
                res.on('error', (e)=>{
                    errorPush("An Error Occured: ", e);
                    this.cleanTransport(transport);
                })
                await this.mcpServer.connect(transport);
                await transport.handleRequest(req, res, req.body);
            } catch (error) {
                errorPush("Error handling MCP start request: ", error);
                if (!res.headersSent) {
                    res.status(500).json({
                        jsonrpc: '2.0',
                        error: {
                        code: -32603,
                        message: 'Internal server error',
                        },
                        id: null,
                    });
                }
            }
            
        });
        this.expressApp.get('/mcp', async (req: Request, res: Response) => {
            logPush('Received GET MCP request');
            res.writeHead(405).end(JSON.stringify({
                jsonrpc: "2.0",
                error: {
                code: -32000,
                message: "Method not allowed."
                },
                id: null
            }));
        });

        this.expressApp.delete('/mcp', async (req: Request, res: Response) => {
            logPush('Received DELETE MCP request');
            res.writeHead(405).end(JSON.stringify({
                jsonrpc: "2.0",
                error: {
                code: -32000,
                message: "Method not allowed."
                },
                id: null
            }));
        });

    }
    async loadPrompts() {
        this.mcpServer.registerPrompt(
            "create_flashcards_system_cn",
            {
                title: lang("prompt_flashcards"),
                description: "create flash cards",
            },
            ({  }) => ({
                messages: [{
                    role: "user",
                    content: {
                        type: "text",
                        text: promptCreateCardsSystemCN
                    }
                }]
            })
        );
        this.mcpServer.registerPrompt(
            "sql_query_prompt_cn",
            {
                title: lang("prompt_sql"),
                description: "Sql Query System Prompt",
            },
            ({  }) => ({
                messages: [{
                    role: "assistant",
                    content: {
                        type: "text",
                        text: promptQuerySystemCN
                    }
                }]
            })
        );

    }
    async loadTools() {
        const plugin = getPluginInstance();
        const readOnlyMode = plugin?.mySettings["readOnly"] || "allow_all";

        // 工具提供者列表
        const toolProviders = [
            new DailyNoteToolProvider(),
            new DocWriteToolProvider(),
            new SearchToolProvider(),
            new SqlToolProvider(),
            new DocReadToolProvider(),
            new RelationToolProvider(),
            new DocVectorSearchProvider(),
            new FlashcardToolProvider(),
            new AttributeToolProvider(),
            new BlockWriteToolProvider(),
        ];

        for (const provider of toolProviders) {
            const tools = await provider.getTools();
            for (const tool of tools) {
                if (readOnlyMode === "deny_all" && (tool.annotations?.readOnlyHint === false || tool.annotations?.destructiveHint === true)) {
                    logPush(`Skipping tool in read-only mode (deny_all): ${tool.name}`);
                    continue;
                }
                if (readOnlyMode === "allow_non_destructive" && tool.annotations?.destructiveHint === true) {
                    logPush(`Skipping destructive tool in non-destructive mode: ${tool.name}`);
                    continue;
                }
                logPush("启用工具中", tool.name, tool.title);
                this.mcpServer.registerTool(
                    tool.name,
                    {
                        "title": tool.title,
                        "description": tool.description,
                        "inputSchema": tool.schema,
                        "annotations": tool.annotations,
                    }, tool.handler
                );
            }
        }
        await this.loadPrompts();
    }
    start() {
        let port = 16806;
        try {
            const plugin = getPluginInstance();
            let newPort = plugin?.mySettings["port"];
            if (newPort) {
                newPort = parseInt(newPort);
                if (port >= 0 && port <= 65535) {
                    port = newPort;
                }
            }
        } catch (err) {
            errorPush(err);
        }
        try {
            logPush("启动服务中");
            const httpServer = http.createServer(this.expressApp);
            const bindAddress = "127.0.0.1";
            if (bindAddress !== "127.0.0.1") {
                throw new Error("Please set an authentication code (authCode) for security reasons");
            }
            httpServer.listen(port, bindAddress, () => {
                logPush("服务运行在端口：", port);
                showMessage(lang("server_running_on") + port);
                this.runningFlag = true;
                this.httpServer = httpServer;
                this.workingPort = port;
            });
            httpServer.on('error', (err : Error) => {
                errorPush("http server ERROR: ", err);
                if (err.message.includes("EADDRINUSE")) {
                    showMessage(`${lang("port_error")} ${err} [${lang("plugin_name")}]`, 10000, "error")
                } else {
                    showMessage(`${lang("start_error")} ${err} [${lang("plugin_name")}]`, 10000, "error");
                }
                this.runningFlag = false;
                this.workingPort = -1;
            });
        } catch (err) {
            errorPush("创建http server ERROR: ", err);
            showMessage(`${lang("start_error")} ${err} [${lang("plugin_name")}]`, 10000, "error");
            this.runningFlag = false;
            this.workingPort = -1;
        }
    }
    stop() {
        if (!this.runningFlag) {
            return;
        }
        try {
            Object.values(this.sseTransports).forEach(ts => ts.close());
            if (this.httpServer) {
                this.httpServer.close();
            }
            if (this.mcpServer) {
                this.mcpServer.close();
            }
            this.runningFlag = false;
            this.workingPort = -1;
            logPush("MCP服务关闭");
        } catch (err) {
            showMessage(`${lang("server_stop_error")} ${err.message} ${lang("plugin_name")}`);
            errorPush("MCP服务关闭时出错", err);
        }
    }
    restart() {
        this.stop();
        this.start();
    }
    isRunning() {
        return this.runningFlag;
    }
    getConnectionCount() {
        return Object.values(this.sseTransports).length + Object.values(this.transports).length;
    }
}