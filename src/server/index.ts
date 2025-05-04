import { errorPush, logPush } from '../logger';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { Request, Response } from "express";
import * as express from "express";
import { blockReadTool } from '@/tools/docRead';
import { sqlQueryTool, sqlSchemaTool } from '@/tools/sql';
import { appendToDailynoteTool, listNotebookTool } from '@/tools/dailynote';
import { appendToDocTool } from '@/tools/docWrite';
import { fullTextSearchTool } from '@/tools/search';
import { getPluginInstance } from '@/utils/pluginHelper';
import { CONSTANTS } from '@/constants';
const http = require("http");
export default class MyMCPServer {
    runningFlag: boolean = false;
    httpServer: any = null;
    mcpServer: McpServer = null;
    expressApp: express.Application = null;
    transports: { [id: string]: SSEServerTransport } = {};
    workingPort: number = -1;
    constructor() {
        this.mcpServer = new McpServer({
            "name": "siyuan",
            "version": "0.1.0"
        }, {
            "capabilities": {
                "resources": {},
                "tools": {},
            }
        });

        this.loadTools();
    }
    initialize() {
        logPush("hello");
        this.expressApp = express();
        this.expressApp.get('/health', (_, res) => {
            res.status(200).send("ok");
        });
        this.expressApp.get("/sse", async (req: Request, res: Response) => {
            const transport = new SSEServerTransport(
                "/messages",
                res,
            );
            logPush("新SSE连接", transport.sessionId);

            this.transports[transport.sessionId] = transport;
            res.on("close", () => {
                logPush("SSE连接断开", transport.sessionId);
                delete this.transports[transport.sessionId];
            });
            await this.mcpServer.connect(transport);
        });

        this.expressApp.post("/messages", async (req: Request, res: Response) => {
            const sessionId = req.query.sessionId as string;
            if (!this.transports[sessionId]) {
                res.status(400).send(`No transport found for sessionId ${sessionId}`);
                return;
            }
            logPush("SSE-messages", sessionId);
            await this.transports[sessionId].handlePostMessage(req, res);
        });
    }
    loadTools() {
        const toolList = [
            blockReadTool, 
            sqlQueryTool, sqlSchemaTool, 
            appendToDailynoteTool, listNotebookTool, 
            appendToDocTool, 
            fullTextSearchTool
        ];
        toolList.forEach(item =>{
            this.mcpServer.tool(
                item.name,
                item.description,
                item.schema,
                item.handler
            );
        })
    }
    start() {
        let port = 16806;
        const plugin = getPluginInstance();
        const newPort = plugin?.data[CONSTANTS.STORAGE_NAME]["port"];
        if (newPort) {
            if (port >= 0 && port <= 65535) {
                port = newPort;
            }
        }
        try {
            logPush("启动服务中");
            const httpServer = http.createServer(this.expressApp);
            httpServer.listen(port, "127.0.0.1", () => {
                logPush("服务运行在端口：", port);
                this.runningFlag = true;
                this.httpServer = httpServer;
                this.workingPort = port;
            });
            httpServer.on('error', (err) => {
                errorPush("http server ERROR: ", err);
                this.runningFlag = false;
            });
        } catch (err) {
            errorPush("创建http server ERROR: ", err);
            this.runningFlag = false;
            this.workingPort = -1;
        }
    }
    stop() {
        if (!this.runningFlag) {
            return;
        }
        try {
            Object.values(this.transports).forEach(ts => ts.close());
            if (this.httpServer) {
                this.httpServer.close();
            }
            this.runningFlag = false;
            this.workingPort = -1;
            logPush("MCP服务关闭");
        } catch (err) {
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
        return Object.values(this.transports).length;
    }
}