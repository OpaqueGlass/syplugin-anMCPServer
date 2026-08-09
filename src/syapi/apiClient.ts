/**
 * apiClient.ts
 * 思源 API 请求客户端封装。
 *
 * 目的：同时支持两种运行环境——
 * 1. 插件环境：baseUrl 为空（同源相对路径请求），apiKey 为空（依赖同源 Cookie 鉴权），行为与原实现一致；
 * 2. CLI（Node.js）环境：初始化时传入 baseUrl（如 http://127.0.0.1:6806）与 apiKey，
 *    apiKey 非空时请求头携带 "Authorization: Token <apiKey>"，为空时不携带 Authorization 字段。
 *
 * 注意：本文件不应 import 项目内其他模块（避免循环依赖），保持零依赖。
 */

export interface ApiClientOptions {
    baseUrl?: string;
    apiKey?: string;
}

function isNonEmptyStr(s: any): boolean {
    return s !== undefined && s !== null && s !== "";
}

export class ApiClient {
    private baseUrl: string = "";
    private apiKey: string = null;

    /**
     * 配置客户端。插件环境无需调用（保持默认空 baseUrl / 空 apiKey）。
     * @param options baseUrl 结尾的斜杠会被移除；apiKey 为空时请求不携带 Authorization
     */
    configure(options: ApiClientOptions) {
        this.baseUrl = (options.baseUrl ?? "").replace(/\/+$/, "");
        this.apiKey = isNonEmptyStr(options.apiKey) ? options.apiKey : null;
    }

    getBaseUrl(): string {
        return this.baseUrl;
    }

    getApiKey(): string | null {
        return this.apiKey;
    }

    /**
     * 构建请求头；仅在 apiKey 有效时附加 Authorization
     */
    buildHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
        const headers: Record<string, string> = { ...(extraHeaders ?? {}) };
        if (isNonEmptyStr(this.apiKey)) {
            headers["Authorization"] = "Token " + this.apiKey;
        }
        return headers;
    }

    resolveUrl(url: string): string {
        if (!isNonEmptyStr(this.baseUrl)) {
            return url;
        }
        return this.baseUrl + (url.startsWith("/") ? url : "/" + url);
    }

    /**
     * 发送 JSON POST 请求，返回解析后的 JSON 对象
     */
    async postJson(url: string, data: any): Promise<any> {
        const response = await fetch(this.resolveUrl(url), {
            body: JSON.stringify(data),
            method: "POST",
            headers: this.buildHeaders({
                "Content-Type": "application/json",
            }),
        });
        return response.json();
    }

    /**
     * 发送 JSON POST 请求，返回原始 Response（用于需要检查 Content-Type / 读取 blob 的场景）
     */
    async postRaw(url: string, data: any): Promise<Response> {
        return fetch(this.resolveUrl(url), {
            body: JSON.stringify(data),
            method: "POST",
            headers: this.buildHeaders({
                "Content-Type": "application/json",
            }),
        });
    }

    /**
     * 发送 FormData POST 请求（文件上传等），返回原始 Response
     */
    async postFormData(url: string, formData: FormData): Promise<Response> {
        return fetch(this.resolveUrl(url), {
            body: formData,
            method: "POST",
            headers: this.buildHeaders(),
        });
    }
}

// 模块级单例
const apiClientInstance = new ApiClient();

/**
 * 获取全局 ApiClient 单例
 */
export function getApiClient(): ApiClient {
    return apiClientInstance;
}

/**
 * 初始化全局 ApiClient（CLI 入口调用；插件环境不调用即保持默认行为）
 */
export function initApiClient(options: ApiClientOptions) {
    apiClientInstance.configure(options);
}
