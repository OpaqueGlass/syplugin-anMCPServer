import { debugPush, errorPush, logPush } from '../logger';
import { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
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
import promptTemplatePromptCN from '@/../static/prompt_template_CN.md';
import { AttributeToolProvider } from '@/tools/attributes';
import { BlockWriteToolProvider } from '@/tools/blockWrite';
import { MoveBlockToolProvider } from '@/tools/move';
import { generateUUID } from '@/utils/common';
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { TemplateToolProvider } from '@/tools/template';
import { HelpDocToolProvider } from '@/tools/helpDoc';
import {
    isCloudflareAccessConfigured,
    extractCloudflareAccessToken,
    extractBearerToken,
    looksLikeJWT,
    validateCloudflareAccessToken
} from '@/utils/cloudflareAccess';

const http = require("http");

/**
 * Validates authentication for incoming requests.
 * Supports multiple authentication methods:
 * 1. Cloudflare Access JWT (Cf-Access-Jwt-Assertion header or CF_Authorization cookie)
 * 2. Cloudflare Linked Apps OAuth (Authorization: Bearer with JWT)
 * 3. Local Bearer token authentication
 * @returns authentication result with method used
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

    const headers = req.headers as Record<string, string | string[] | undefined>;

    // 1. Try Cloudflare Access authentication (Cf-Access-Jwt-Assertion header or cookie)
    if (hasCfAccessAuth) {
        const cfToken = extractCloudflareAccessToken(headers);
        if (cfToken) {
            const payload = await validateCloudflareAccessToken(cfToken);
            if (payload) {
                logPush("Authenticated via Cloudflare Access:", payload.email || payload.sub);
                return { authenticated: true, method: "cloudflare-access" };
            }
            // If CF token present but invalid, don't fall back to other methods
            return { authenticated: false, error: "Invalid Cloudflare Access token" };
        }
    }

    // 2. Try Bearer token authentication
    const bearerToken = extractBearerToken(headers);
    if (bearerToken) {
        // 2a. If Cloudflare Access is configured and token looks like JWT,
        //     try to validate it as a Cloudflare Linked App OAuth token
        if (hasCfAccessAuth && looksLikeJWT(bearerToken)) {
            const payload = await validateCloudflareAccessToken(bearerToken);
            if (payload) {
                logPush("Authenticated via Cloudflare Linked App OAuth:", payload.email || payload.sub);
                return { authenticated: true, method: "cloudflare-linked-app" };
            }
            // JWT validation failed - if local auth is also configured, try that
            if (!hasBearerAuth) {
                return { authenticated: false, error: "Invalid Cloudflare OAuth token" };
            }
            logPush("Cloudflare JWT validation failed, trying local auth");
        }

        // 2b. Try local Bearer token authentication
        if (hasBearerAuth) {
            logPush("auth", req.headers["authorization"]);
            if (await isAuthTokenValid(bearerToken)) {
                return { authenticated: true, method: "bearer-token" };
            }
            return { authenticated: false, error: "Invalid Bearer token" };
        }
    }

    // No valid authentication provided
    return { authenticated: false, error: "Authentication required" };
}

interface MCPTransportInfo {
    sessionId: string;
    clientIp: string | undefined;
    socketIp: string | undefined;
    transport: StreamableHTTPServerTransport;
    createdAt: Date;
    recentActivityAt: Date;
}

export default class MyMCPServer {
    runningFlag: boolean = false;
    httpServer: any = null;
    mcpServer: McpServer = null;
    expressApp: express.Application = null;
    transports: { [id: string]: MCPTransportInfo } = {};
    workingPort: number = -1;
    checkInterval: ReturnType<typeof setInterval> | null = null;
    checkToolChangeInterval: ReturnType<typeof setInterval> | null = null;
    registeredToolDict: { [name: string]: RegisteredTool } = {};

    mcpInitConfig = {
        "name": "siyuan",
        "version": "1.0.0"
    }
    constructor() {

    }
    /**
     * 根据sessionId关闭链接
     * 不能在onclose中调用，会导致死循环
     * @param sessionId
     * @returns
     */
    closeTrasnportBySessionId(sessionId: string) {
        if (!this.transports[sessionId]) {
            return;
        }
        const transport = this.transports[sessionId].transport;
        this.cleanTransportBySessionId(sessionId);
        transport?.close();
    }
    /**
     * 安全清理连接
     * @param sessionId
     * @returns
     */
    cleanTransportBySessionId(sessionId: string) {
        if (!this.transports[sessionId]) {
            return;
        }
        this.cleanTransport(this.transports[sessionId]);
    }
    cleanTransport(transportInfo: MCPTransportInfo) {
        if (!this.transports[transportInfo.sessionId]) {
            return;
        }
        delete this.transports[transportInfo.sessionId];
    }
    async initialize() {
        logPush("Initializing mcp server");
        this.mcpServer = new McpServer(this.mcpInitConfig, {
            "capabilities": {
                "tools": {},
                "prompts": {},
            }
        });
        await this.loadToolsAndPrompts();
        const plugin = getPluginInstance();
        let address = plugin?.mySettings["address"] || "127.0.0.1";
        const allowedHostsSetting = plugin?.mySettings["allowedHosts"] || "";
        let allowedHosts = allowedHostsSetting.split("\n").map((host: string) => host.trim()).filter((host: string) => host.length > 0);
        if (address === "127.0.0.1" || address === "localhost" || address === "::1") {
            if (allowedHosts.length !== 0) {
                allowedHosts = allowedHosts.concat(["localhost", "127.0.0.1", "::1"]);
            }
        } else if (address !== "0.0.0.0") {
            allowedHosts = allowedHosts.concat([address]);
        }
        if (allowedHosts.length === 0) {
            allowedHosts = undefined;
        }

        this.expressApp = createMcpExpressApp({
            "host": address,
            "allowedHosts": allowedHosts
        }); // express();
        logPush("MCP Express app created with allowed hosts: ", allowedHosts, "Binding address: ", address);
        // this.expressApp.use(express.json());
        this.expressApp.get('/health', (_, res) => {
            res.status(200).send("ok");
        });


        /* New Way */
        this.expressApp.post("/mcp", async (req: Request, res: Response) => {
            const plugin = getPluginInstance();
            const clientIp = req.headers['x-forwarded-for'] ||
                     req.headers['x-real-ip'] ||
                     req.socket.remoteAddress;
            const socketIp = req.socket.remoteAddress;
            const sessionId = req.headers['mcp-session-id'] as string | undefined;
            let transport: StreamableHTTPServerTransport | null = null;
            if (sessionId) {
                logPush(`Received MCP request for session: ${sessionId}`);
            }
            try {
                if (sessionId && this.transports[sessionId]) {
                    transport = this.transports[sessionId].transport;
                    // 检查IP是否匹配，防止会话被劫持
                    if (this.transports[sessionId].socketIp !== socketIp || this.transports[sessionId].clientIp !== clientIp) {
                        this.closeTrasnportBySessionId(sessionId);
                        logPush(`Session IP mismatch for session ${sessionId}. Expected client IP: ${this.transports[sessionId].clientIp}, socket IP: ${this.transports[sessionId].socketIp}. Received client IP: ${clientIp}, socket IP: ${socketIp}. Session terminated for security.`);
                        plugin.connectionLogger.warn(`Session IP mismatch. Expected client IP: ${this.transports[sessionId].clientIp}, socket IP: ${this.transports[sessionId].socketIp}. Terminating session ${sessionId} for security.`, clientIp as string, socketIp);
                        res.status(404).json({
                            jsonrpc: '2.0',
                            error: {
                                code: -32000,
                                message: 'Session IP does not match, possible session hijacking attempt, session terminated. Reauthentication is required. 会话IP不匹配，可能的会话劫持尝试，已终止会话。需要重新认证'
                            },
                            id: null
                        });
                        return;
                    }
                    this.transports[sessionId].recentActivityAt = new Date();
                } else if (!sessionId && isInitializeRequest(req.body)) {
                    // Authenticate on session initialization using multi-method auth
                    const authResult = await validateAuthentication(req);
                    if (!authResult.authenticated) {
                        plugin.connectionLogger.warn(`Authentication failed (${authResult.error}). Client IP: ${clientIp}, Socket IP: ${socketIp}.`, clientIp as string, socketIp);
                        const authHeader = req.headers["authorization"];
                        if (authHeader) {
                            res.status(403).send("Invalid Token. Authentication is required. 鉴权失败");
                        } else {
                            res.status(401).send("Authentication is required. 鉴权失败");
                        }
                        return;
                    }
                    logPush(`Authentication successful via ${authResult.method}. Client IP: ${clientIp}`);
                    const eventStore = new InMemoryEventStore();
                    transport = new StreamableHTTPServerTransport({
                        sessionIdGenerator: () => generateUUID(),
                        eventStore,
                        onsessioninitialized: sessionId =>{
                            logPush("New Session Initialized", sessionId, clientIp, socketIp);
                            plugin.connectionLogger.info(`New session initialized: ${sessionId} (auth: ${authResult.method})`, clientIp as string, socketIp);
                            this.transports[transport.sessionId] = {
                                sessionId: transport.sessionId,
                                clientIp: clientIp as string,
                                socketIp: socketIp,
                                transport: transport,
                                createdAt: new Date(),
                                recentActivityAt: new Date()
                            };
                        }
                    });
                    transport.onclose = ()=>{
                        const sid = transport.sessionId;
                        logPush("Session Close", sid);
                        plugin.connectionLogger.info(`Session closed: ${sid}`, clientIp as string, socketIp);
                        this.cleanTransportBySessionId(sid);
                    };
                    await this.mcpServer.connect(transport);
                    await transport.handleRequest(req, res, req.body);
                    return;
                } else {
                    logPush(`Received MCP request with invalid session ID: ${sessionId}. No existing session found. Client IP: ${clientIp}, Socket IP: ${socketIp}. Request body: `, req.body, req);
                    res.status(400).json({
                        jsonrpc: '2.0',
                        error: {
                            code: -32000,
                            message: 'Bad Request: No valid session ID provided'
                        },
                        id: null
                    });
                    return;
                }
                logPush(`Handling MCP request for session ${transport.sessionId}. Client IP: ${clientIp}, Socket IP: ${socketIp}. Request body: `, req.body, req);
                try {
                    if (req.body && req.body["method"] === "tools/call") {
                        logPush("Tool call ", req.body["params"]["name"]);
                        plugin.connectionLogger.info(`Tool call: ${req.body["params"]["name"]} with args ${JSON.stringify(req.body["params"]["arguments"]).substring(0, 100)}`, clientIp as string, socketIp);
                    }
                } catch (error) {
                    errorPush("Error logging tool call: ", error);
                }

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
            const sessionId = req.headers['mcp-session-id'] as string | undefined;
            if (!sessionId || !this.transports[sessionId]) {
                res.status(400).send('Invalid or missing session ID');
                return;
            }
            logPush(`Received session termination request for session ${sessionId}`);
            try {
                const transportInfo = this.transports[sessionId];
                await transportInfo.transport.handleRequest(req, res);
            } catch (error) {
                errorPush('Error handling session termination:', error);
                if (!res.headersSent) {
                    res.status(500).send('Error processing session termination');
                }
            }
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
        this.mcpServer.registerPrompt(
            "template_creator_prompt_cn",
            {
                title: lang("prompt_template"),
                description: "Template Creator System Prompt",
            },
            ({  }) => ({
                messages: [{
                    role: "assistant",
                    content: {
                        type: "text",
                        text: promptTemplatePromptCN
                    }
                }]
            })
        );
    }
    async loadToolsAndPrompts() {
        await this.loadTools();
        await this.loadPrompts();
    }
    async loadTools() {
        const plugin = getPluginInstance();
        const readOnlyMode = plugin?.mySettings["readOnly"] || "allow_all";

        // 工具提供者列表
        const toolProviders = [
            new HelpDocToolProvider(),
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
            new MoveBlockToolProvider(),
            new TemplateToolProvider(),
        ];
        const toolNames: string[] = [];
        let changedFlag = false;

        for (const provider of toolProviders) {
            const tools = await provider.getTools();
            for (const tool of tools) {
                // 排除工具
                if (readOnlyMode === "deny_all" && (tool.annotations?.readOnlyHint === false || tool.annotations?.destructiveHint === true)) {
                    debugPush(`Skipping tool in read-only mode (deny_all): ${tool.name}`);
                    continue;
                }
                if (readOnlyMode === "allow_non_destructive" && tool.annotations?.destructiveHint === true) {
                    debugPush(`Skipping destructive tool in non-destructive mode: ${tool.name}`);
                    continue;
                }
                // 接纳工具
                toolNames.push(tool.name);
                if (this.registeredToolDict[tool.name]) {
                    continue;
                }
                debugPush("启用工具中", tool.name, tool.title);
                const registeredTool = this.mcpServer.registerTool(
                    tool.name,
                    {
                        "title": tool.title,
                        "description": tool.description,
                        "inputSchema": tool.schema,
                        "annotations": tool.annotations,
                    }, tool.handler
                );
                this.registeredToolDict[tool.name] = registeredTool;
                changedFlag = true;
            }
        }
        for (const toolName in this.registeredToolDict) {
            if (!toolNames.includes(toolName)) {
                debugPush(`Unregistering tool that is no longer provided: ${toolName}`);
                this.registeredToolDict[toolName].remove();
                delete this.registeredToolDict[toolName];
                changedFlag = true;
            }
        }
        if (changedFlag) {
            this.mcpServer.sendToolListChanged();
        }
    }
    async start() {
        await this.initialize();
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
            const bindAddress = getPluginInstance()?.mySettings["address"] || "127.0.0.1";
            if ((bindAddress !== "127.0.0.1" && bindAddress !== "localhost") && (getPluginInstance()?.mySettings["authCode"] === CONSTANTS.CODE_UNSET) || !isValidStr(getPluginInstance()?.mySettings["authCode"])) {
                throw new Error(lang("msg_auth_code_please"));
            }
            httpServer.listen(port, bindAddress, () => {
                logPush("服务运行在端口：", port);
                logPush("服务运行在地址：", bindAddress);
                showMessage(lang("server_running_on") + port + " (" + bindAddress + ")");
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
            clearInterval(this.checkInterval);
            this.checkInterval = setInterval(() => {
                const now = new Date();
                Object.values(this.transports).forEach(transportInfo => {
                    const idleTime = (now.getTime() - transportInfo.recentActivityAt.getTime()) / 1000;
                    if (idleTime > 300) { // 5 minutes
                        logPush(`Transport ${transportInfo.transport.sessionId} has been idle for ${idleTime} seconds, terminating.`);
                        this.closeTrasnportBySessionId(transportInfo.transport.sessionId);
                    }
                });
            }, 600000);
            clearInterval(this.checkToolChangeInterval);
            this.checkToolChangeInterval = setInterval(() => {
                this.loadTools();
            }, 30000);
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
            Object.values(this.transports).forEach(ts => {
                // Ensure underlying StreamableHTTPServerTransport instances are closed
                try {
                    // If the transport is stored directly
                    (ts as any)?.close?.();
                    // If the transport is stored under a "transport" property
                    (ts as any)?.transport?.close?.();
                } catch (closeErr) {
                    errorPush("Error closing transport during server stop", closeErr);
                }
                this.cleanTransport(ts);
            });
            if (this.httpServer) {
                this.httpServer.close();
            }
            if (this.mcpServer) {
                this.mcpServer.close();
            }
            this.registeredToolDict = {};
            this.runningFlag = false;
            this.workingPort = -1;
            logPush("MCP服务关闭");
        } catch (err) {
            showMessage(`${lang("server_stop_error")} ${err.message} ${lang("plugin_name")}`);
            errorPush("MCP服务关闭时出错", err);
        }
        clearInterval(this.checkInterval);
        clearInterval(this.checkToolChangeInterval);
    }
    async restart() {
        this.stop();
        await this.start();
    }
    isRunning() {
        return this.runningFlag;
    }
    getConnectionCount() {
        return  Object.values(this.transports).length;
    }
}
