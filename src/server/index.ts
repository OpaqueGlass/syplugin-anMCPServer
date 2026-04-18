import { debugPush, errorPush, infoPush, logPush } from '../logger';
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
import { AttributeViewToolProvider } from '@/tools/attributeView';
import dbHelpDocMD from "@/../static/data_db_CN.md";
import mdSyntaxMD from "@/../static/data_md_syntax_CN.md";
import templateFunctionMD from "@/../static/data_template_action_CN.md";
import sqlBlockDatabaseSchemaMD from "@/../static/database_schema.md";

const http = require("http");
const https = require("https");
const fs = require("fs");

interface MCPTransportInfo {
    sessionId: string;
    clientIp: string | undefined;
    socketIp: string | undefined;
    transport: StreamableHTTPServerTransport;
    createdAt: Date;
    recentActivityAt: Date;
    serverInstance?: McpServer;
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
    toolProviders: any[] = [];
    tryHttps: boolean = false;
    httpsOptions: any = null;

    mcpInitConfig = {
        "name": "siyuan",
        "version": "1.1.1",
    }
    constructor() {
        this.toolProviders = [
            new DailyNoteToolProvider(),
            new DocWriteToolProvider(),
            new SearchToolProvider(),
            new DocReadToolProvider(),
            new RelationToolProvider(),
            new DocVectorSearchProvider(),
            new FlashcardToolProvider(),
            new AttributeToolProvider(),
            new BlockWriteToolProvider(),
            new MoveBlockToolProvider(),
            new TemplateToolProvider(),
            new AttributeViewToolProvider(),
        ];
    }
    cleanTransport(transportInfo: MCPTransportInfo) {
        const sessionId = transportInfo.sessionId;
        const info = this.transports[sessionId];
        if (!info) return;

        logPush(`Cleaning up transport for session ${sessionId}`);
        if (info.transport) {
            info.transport.onclose = null;
            info.transport.close();
        }
        if (info.serverInstance) {
            info.serverInstance.close().catch(e => errorPush("Close server error", e));
            info.serverInstance = null;
        }

        delete this.transports[sessionId];
    }
    async getMcpServerInstance() {
        const mcpServer = new McpServer(this.mcpInitConfig, {
            "capabilities": {
                "tools": {},
                "prompts": {},
                "resources": {}
            }
        });
        await this.loadToolsAndPrompts(mcpServer);
        return mcpServer;
    }
    async initialize() {
        logPush("Initializing mcp server");
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
        try {
            let keyFile = fs.readFileSync(window.siyuan.config.system.workspaceDir + '/data/storage/petal/syplugin-anMCPServer/server-key.pem');
            let certFile = fs.readFileSync(window.siyuan.config.system.workspaceDir + '/data/storage/petal/syplugin-anMCPServer/server-cert.pem');
            this.tryHttps = true;
            this.httpsOptions = {
                key: keyFile,
                cert: certFile
            }
            logPush("HTTPS certificates loaded successfully, HTTPS will be enabled.");
        } catch (error) {
            infoPush("HTTPS certificates not found, falling back to HTTP. To enable HTTPS, please place 'server-key.pem' and 'server-cert.pem' in the plugin directory.");
            this.tryHttps = false;
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
                        this.cleanTransport(this.transports[sessionId]);
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
                                res.status(403).send("Invalid Token. Authentication is required. 鉴权失败");
                            }else {
                                res.status(401).send("Authentication is required. 鉴权失败");
                            }
                            return
                        }
                    }
                    const eventStore = new InMemoryEventStore();
                    const mcpServerInstance = await this.getMcpServerInstance();
                    transport = new StreamableHTTPServerTransport({
                        sessionIdGenerator: () => generateUUID(),
                        eventStore,
                        onsessioninitialized: sessionId =>{
                            logPush("New Session Initialized", sessionId, clientIp, socketIp);
                            plugin.connectionLogger.info(`New session initialized: ${sessionId}`, clientIp as string, socketIp);
                            this.transports[sessionId] = {
                                sessionId: sessionId,
                                clientIp: clientIp as string,
                                socketIp: socketIp,
                                transport: transport,
                                createdAt: new Date(),
                                recentActivityAt: new Date(),
                                serverInstance: mcpServerInstance,
                            };
                        }
                    });
                    transport.onclose = ()=>{
                        const sid = transport.sessionId;
                        logPush("Session Close", sid);
                        plugin.connectionLogger.info(`Session closed: ${sid}`, clientIp as string, socketIp);
                        this.cleanTransport(this.transports[sid]);
                    };
                    res.on('error', (e)=>{
                        const sid = transport.sessionId;
                        errorPush("An Error Occured: ", e);
                        this.cleanTransport(this.transports[sid]);
                    });
                    await mcpServerInstance.connect(transport);
                    await transport.handleRequest(req, res, req.body);
                    return;
                } else {
                    logPush(`Received MCP request with invalid session ID: ${sessionId}. No existing session found. Client IP: ${clientIp}, Socket IP: ${socketIp}. Request body: `, req.body);
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
                debugPush(`Handling MCP request for session ${transport.sessionId}. Client IP: ${clientIp}, Socket IP: ${socketIp}. Request body: `, req.body);
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
            } finally {
                this.cleanTransport(this.transports[sessionId]);
            }
        });
    }
    async loadPrompts(mcpServerInstance?: McpServer) {
        mcpServerInstance.registerPrompt(
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
        mcpServerInstance.registerPrompt(
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
        mcpServerInstance.registerPrompt(
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
    async loadToolsAndPrompts(mcpServerInstance?: McpServer) {
        await this.loadTools(mcpServerInstance);
        await this.loadPrompts(mcpServerInstance);
        await this.loadResources(mcpServerInstance);
    }
    async loadTools(mcpServerInstance?: McpServer) {
        const plugin = getPluginInstance();
        const readOnlyMode = plugin?.mySettings["readOnly"] || "allow_all";

        // 工具提供者列表
        for (const provider of this.toolProviders) {
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
                debugPush("启用工具中", tool.name, tool.title);
                const mymcptool = mcpServerInstance.registerTool(
                    tool.name,
                    {
                        "title": tool.title,
                        "description": tool.description,
                        "inputSchema": tool.schema,
                        "annotations": tool.annotations,
                    }, tool.handler
                );
                logPush(`Tool registered: ${tool.name} (${tool.title})`, mymcptool);
            }
        }
    }
    async loadResources(mcpServerInstance?: McpServer) {
        mcpServerInstance.registerResource(
            'database_helpdoc',
            'helpdoc://database',
            {
                title: 'Database Help Document',
                description: '思源笔记数据库操作工具说明文档。数据库操作工具提供对思源笔记中数据库内容块的操作接口。注意区分，此工具操作的数据库类似于笔记文档中嵌入了一个智能表格，并非传统数据库。工具集目前支持创建数据库、增删改数据库行、增删数据库列、查询数据库内容等功能。',
                mimeType: 'text/plain'
            },
            async uri => ({
                contents: [{ uri: uri.href, 
                    text:  dbHelpDocMD}]
            })
        );
        mcpServerInstance.registerResource(
            'markdown_syntax_helpdoc',
            'helpdoc://markdown_syntax',
            {
                title: 'Markdown Syntax Help Document',
                description: '思源笔记Markdown语法说明文档。',
                mimeType: 'text/plain'
            },
            async uri => ({
                contents: [{ uri: uri.href, 
                    text:  mdSyntaxMD}]
            })
        );
        mcpServerInstance.registerResource(
            'template_function_helpdoc',
            'helpdoc://template_function',
            {
                title: 'Template Function Help Document',
                description: '思源笔记模板语法说明文档。',
                mimeType: 'text/plain'
            },
            async uri => ({
                contents: [{ uri: uri.href, 
                    text:  templateFunctionMD}]
            })
        );
        mcpServerInstance.registerResource(
            'sql_contentblock_db_schema',
            'helpdoc://sql_contentblock_db_schema',
            {
                title: 'SQL Block Database Schema Help Document',
                description: '思源笔记SQL块数据库模式说明文档。',
                mimeType: 'text/plain'
            },
            async uri => ({
                contents: [{ uri: uri.href, 
                    text:  sqlBlockDatabaseSchemaMD}]
            })
        );
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
            let httpServer: any;
            if (this.tryHttps) {
                httpServer = https.createServer(this.httpsOptions, this.expressApp);
            } else {
                httpServer = http.createServer(this.expressApp);
            }
            const bindAddress = getPluginInstance()?.mySettings["address"] || "127.0.0.1";
            if ((bindAddress !== "127.0.0.1" && bindAddress !== "localhost") && (getPluginInstance()?.mySettings["authCode"] === CONSTANTS.CODE_UNSET) || !isValidStr(getPluginInstance()?.mySettings["authCode"])) {
                throw new Error(lang("msg_auth_code_please"));
            }
            httpServer.listen(port, bindAddress, () => {
                logPush("服务运行在端口：", port);
                logPush("服务运行在地址：", bindAddress);
                showMessage(lang("server_running_on") + port + " (" + bindAddress + ")" + (this.tryHttps ? " with HTTPS" : ""));
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
                const nowTime = now.getTime();
                const sessionsToClose = Object.values(this.transports)
                    .filter(info => (nowTime - info.recentActivityAt.getTime()) / 1000 > 5 * 60);

                sessionsToClose.forEach(sessionInfo => {
                    logPush(`Transport ${sessionInfo.sessionId} exceeded idle timeout, terminating.`);
                    this.cleanTransport(sessionInfo);
                });
            }, 2 * 60 * 1000);
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
                this.httpServer.removeAllListeners();
                this.httpServer.close();
            }
            clearInterval(this.checkInterval);
            this.runningFlag = false;
            this.workingPort = -1;
            logPush("MCP服务关闭");
            showMessage(lang("server_stopped") + ` [${lang("plugin_name")}]`, 2000);
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