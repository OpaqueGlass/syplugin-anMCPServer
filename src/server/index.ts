import { debugPush, errorPush, logPush } from '../logger';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
import { MoveBlockToolProvider } from '@/tools/move';
import { generateUUID } from '@/utils/common';
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';

const http = require("http");

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
    constructor() {
        this.mcpServer = new McpServer({
            "name": "siyuan",
            "version": "0.7.0"
        }, {
            "capabilities": {
                "tools": {},
                "prompts": {},
            }
        });
    }
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
        transportInfo.transport.close();
        delete this.transports[transportInfo.sessionId];
    }
    initialize() {
        logPush("Initializing mcp server");
        this.expressApp = createMcpExpressApp(); // express();
        // this.expressApp.use(express.json());
        this.expressApp.get('/health', (_, res) => {
            res.status(200).send("ok");
        });

        
        /* New Way */
        this.expressApp.post("/mcp", async (req: Request, res: Response) => {
            const plugin = getPluginInstance();
            const authToken = plugin?.mySettings["authCode"];
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
                        this.cleanTransportBySessionId(sessionId);
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
                    if (isValidStr(authToken) && authToken !== CONSTANTS.CODE_UNSET) {
                        const authHeader = req.headers["authorization"];
                        const token = authHeader?.replace("Bearer ", "");
                        logPush("auth", authHeader, clientIp);
                        if (!await isAuthTokenValid(token)) {
                            plugin.connectionLogger.warn(`Authentication failed for incoming connection. Invalid token provided. Client IP: ${clientIp}, Socket IP: ${socketIp}.`, clientIp as string, socketIp);
                            if (authHeader) {
                                res.status(403).send("Invalid Token. Authentication is requied. 鉴权失败");
                            }else {
                                res.status(401).send("Authentication is requied. 鉴权失败");
                            }
                            return
                        }
                    }
                    const eventStore = new InMemoryEventStore();
                    transport = new StreamableHTTPServerTransport({
                        sessionIdGenerator: () => generateUUID(),
                        eventStore,
                        onsessioninitialized: sessionId =>{
                            logPush("New Session Initialized", sessionId, clientIp, socketIp);
                            plugin.connectionLogger.info(`New session initialized: ${sessionId}`, clientIp as string, socketIp);
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
                    // res.on('error', (e)=>{
                    //     const sid = transport.sessionId;
                    //     errorPush("An Error Occured: ", e);
                    //     this.cleanTransportBySessionId(sid);
                    // })
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
            new MoveBlockToolProvider(),
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
            if (bindAddress !== "127.0.0.1" && (getPluginInstance()?.mySettings["authCode"] === CONSTANTS.CODE_UNSET) || !isValidStr(getPluginInstance()?.mySettings["authCode"])) {
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
            clearInterval(this.checkInterval);
            this.checkInterval = setInterval(() => {
                const now = new Date();
                Object.values(this.transports).forEach(transportInfo => {
                    const idleTime = (now.getTime() - transportInfo.recentActivityAt.getTime()) / 1000;
                    if (idleTime > 300) { // 5 minutes
                        logPush(`Transport ${transportInfo.transport.sessionId} has been idle for ${idleTime} seconds, terminating.`);
                        this.cleanTransportBySessionId(transportInfo.transport.sessionId);
                    }
                });
            }, 600000);
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
            Object.values(this.transports).forEach(ts => this.cleanTransport(ts));
            
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
        clearInterval(this.checkInterval);
    }
    restart() {
        this.stop();
        this.start();
    }
    isRunning() {
        return this.runningFlag;
    }
    getConnectionCount() {
        return  Object.values(this.transports).length;
    }
}