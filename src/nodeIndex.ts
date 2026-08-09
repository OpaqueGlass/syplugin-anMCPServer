/**
 * nodeIndex.ts
 * CLI（Node.js / npx）运行入口。
 *
 * 用法：
 *   npx syplugin-an-mcp-server [选项]
 *
 * 选项：
 *   --http                以 HTTP (Streamable HTTP) 模式启动服务；默认是 stdio 模式
 *   --port <port>         HTTP 模式监听端口（默认取插件设置/16806）
 *   --address <addr>      HTTP 模式绑定地址（默认 127.0.0.1）
 *   --base-url <url>      思源内核地址（也可用环境变量 SIYUAN_BASE_URL，默认 http://127.0.0.1:6806）
 *   --api-key <key>       思源 API Token（也可用环境变量 SIYUAN_API_KEY；不填则请求不携带 Authorization）
 *   --log-level <0-5>     日志级别（默认 2：Error + Warn）
 *   -h, --help            显示帮助
 *
 * 环境变量：
 *   SIYUAN_BASE_URL   思源内核地址
 *   SIYUAN_API_KEY    思源 API Token
 *   MCP_AUTH_CODE     HTTP 模式的连接鉴权码（明文）；不设置则不鉴权（仅允许监听本机回环地址）
 */
import { initApiClient } from "@/syapi/apiClient";
import { initKernelEnv, getKernelConfig } from "@/utils/runtimeEnv";
import { setLoggerStderrMode, setLoggerLevel, logPush, errorPush } from "@/logger";
import { setPluginInstance } from "@/utils/pluginHelper";
import { CONSTANTS, DEFAULT_SETTING } from "@/constants";
import { encryptAuthCode } from "@/utils/crypto";
import { getJSONFile } from "@/syapi";
import { isValidStr } from "@/utils/commonCheck";
import MyMCPServer from "@/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { taskManager } from "@/utils/historyTaskHelper";
import { ConnectionLogger } from "@/logger/connectionLogger";
import { getFormattedTimestr } from "@/utils/common";
import { setLanguage } from "@/utils/lang";
import zhCN from "@/i18n/zh_CN.json";
import enUS from "@/i18n/en_US.json";

const HELP_TEXT = `SiYuan MCP Server (CLI mode)

Usage:
  npx syplugin-an-mcp-server [options]

Options:
  --http                Run as Streamable HTTP server (default: stdio)
  --port <port>         HTTP listen port (default: plugin setting or 16806)
  --address <addr>      HTTP bind address (default: 127.0.0.1)
  --base-url <url>      SiYuan kernel URL (env: SIYUAN_BASE_URL, default: http://127.0.0.1:6806)
  --api-key <key>       SiYuan API token (env: SIYUAN_API_KEY; omit to send no Authorization header)
  --log-level <0-5>     Log level, 0=silent ... 5=debug (default: 2)
  -h, --help            Show this help

Environment variables:
  SIYUAN_BASE_URL       SiYuan kernel URL
  SIYUAN_API_KEY        SiYuan API token
  MCP_AUTH_CODE         Auth code (plaintext) for HTTP mode; if unset, auth is disabled
                        (only allowed when binding to loopback address)

HTTPS (HTTP mode only):
  Place "server-key.pem" and "server-cert.pem" in the current working directory
  to enable HTTPS automatically.
`;

interface CliArgs {
    http: boolean;
    port: string | null;
    address: string | null;
    baseUrl: string | null;
    apiKey: string | null;
    logLevel: string | null;
    help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
    const args: CliArgs = {
        http: false, port: null, address: null,
        baseUrl: null, apiKey: null, logLevel: null, help: false,
    };
    for (let i = 0; i < argv.length; i++) {
        switch (argv[i]) {
            case "--http": args.http = true; break;
            case "--port": args.port = argv[++i] ?? null; break;
            case "--address":
            case "--host": args.address = argv[++i] ?? null; break;
            case "--base-url": args.baseUrl = argv[++i] ?? null; break;
            case "--api-key": args.apiKey = argv[++i] ?? null; break;
            case "--log-level": args.logLevel = argv[++i] ?? null; break;
            case "--help":
            case "-h": args.help = true; break;
            default:
                console.error(`Unknown option: ${argv[i]} (use --help for usage)`);
                break;
        }
    }
    return args;
}

function pickLanguage() {
    const localeHints = [
        process.env.LC_ALL, process.env.LC_MESSAGES, process.env.LANG, process.env.LANGUAGE,
        (() => { try { return Intl.DateTimeFormat().resolvedOptions().locale; } catch { return ""; } })(),
    ].filter(Boolean).join(",").toLowerCase();
    return localeHints.includes("zh") ? zhCN : enUS;
}

async function loadPluginSettings(): Promise<any> {
    // 与插件侧一致：STORAGE_NAME + system.id 后 6 位，保存在插件数据目录下
    try {
        const systemId: string = (await getKernelConfig())?.system?.id ?? "";
        if (systemId.length >= 36) {
            const configKey = CONSTANTS.STORAGE_NAME + systemId.substring(30, 36);
            const saved = await getJSONFile(CONSTANTS.PLUGIN_DATA_SAVEPATH + configKey);
            if (saved && typeof saved === "object" && saved.code === undefined) {
                logPush("Loaded plugin-side settings from workspace:", configKey);
                return saved;
            }
        }
    } catch (err) {
        errorPush("Failed to load plugin-side settings, falling back to defaults", err);
    }
    return null;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log(HELP_TEXT);
        return;
    }
    const stdioMode = !args.http;
    if (stdioMode) {
        // stdio 模式下 stdout 被 MCP 协议独占，日志全部走 stderr
        setLoggerStderrMode(true);
    }
    if (args.logLevel != null) {
        const level = parseInt(args.logLevel, 10);
        if (!isNaN(level)) setLoggerLevel(level);
    }
    setLanguage(pickLanguage());

    // 1. 初始化 API 客户端（baseUrl + apiKey）
    const baseUrl = args.baseUrl ?? process.env.SIYUAN_BASE_URL ?? "http://127.0.0.1:6806";
    const apiKey = args.apiKey ?? process.env.SIYUAN_API_KEY ?? "";
    initApiClient({ baseUrl, apiKey });
    logPush(`SiYuan kernel: ${baseUrl} (Authorization: ${isValidStr(apiKey) ? "Token ***" : "none"})`);

    // 2. 拉取内核配置与笔记本列表（相当于 window.siyuan.config / notebooks）
    try {
        await initKernelEnv();
    } catch (err: any) {
        console.error(`Failed to connect to SiYuan kernel at ${baseUrl}: ${err?.message ?? err}`);
        console.error("Please check SIYUAN_BASE_URL / SIYUAN_API_KEY and make sure SiYuan is running.");
        process.exit(1);
    }

    // 加载任务缓存（插件环境在模块加载时完成；CLI 需等待 ApiClient 就绪后手动执行）
    try {
        await taskManager.init();
    } catch (err) {
        errorPush("Failed to load task cache", err);
    }

    // 3. 构造伪插件实例（复用插件侧保存的设置，保证权限/过滤配置格式兼容）
    const saved = await loadPluginSettings();
    const mySettings: any = Object.assign({}, DEFAULT_SETTING, saved ?? {});
    if (args.port != null) mySettings["port"] = args.port;
    if (args.address != null) mySettings["address"] = args.address;
    // HTTP 连接鉴权：MCP_AUTH_CODE 明文传入；不设置则不鉴权（server 侧会拒绝非回环地址的无鉴权绑定）
    const authCodePlain = process.env.MCP_AUTH_CODE;
    if (isValidStr(authCodePlain)) {
        mySettings["authCode"] = await encryptAuthCode(authCodePlain);
    } else {
        mySettings["authCode"] = CONSTANTS.CODE_UNSET;
    }

    const pseudoPlugin: any = {
        name: "syplugin-anMCPServer",
        i18n: {},
        data: {},
        mySettings,
        connectionLogger: new ConnectionLogger(getFormattedTimestr()),
        saveData: async () => { /* CLI 不回写插件设置 */ },
        loadData: async () => null,
    };
    setPluginInstance(pseudoPlugin);

    // 4. 启动
    const myMCPServer = new MyMCPServer();
    if (args.http) {
        await myMCPServer.start();
        logPush("MCP HTTP server started.");
    } else {
        const mcpServerInstance = await myMCPServer.getMcpServerInstance();
        const transport = new StdioServerTransport();
        await mcpServerInstance.connect(transport);
        logPush("MCP stdio server connected.");
    }

    const shutdown = () => {
        try {
            if (args.http) myMCPServer.stop();
        } catch { /* ignore */ }
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
