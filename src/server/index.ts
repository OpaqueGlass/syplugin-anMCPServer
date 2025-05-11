import { errorPush, logPush } from '../logger';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
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
    async loadTools() {
        // 工具提供者列表
        const toolProviders = [
            new DailyNoteToolProvider(),
            new DocWriteToolProvider(),
            new SearchToolProvider(),
            new SqlToolProvider(),
            new DocReadToolProvider(),
        ];

        for (const provider of toolProviders) {
            const tools = await provider.getTools();
            for (const tool of tools) {
                this.mcpServer.tool(
                    tool.name,
                    tool.description,
                    tool.schema,
                    tool.handler
                );
            }
        }
    }
    start() {
        let port = 16806;
        try {
            const plugin = getPluginInstance();
            let newPort = plugin?.data[CONSTANTS.STORAGE_NAME]["port"];
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
            httpServer.listen(port, "127.0.0.1", () => {
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
            Object.values(this.transports).forEach(ts => ts.close());
            if (this.httpServer) {
                this.httpServer.close();
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
        return Object.values(this.transports).length;
    }
}