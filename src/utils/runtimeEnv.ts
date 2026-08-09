/**
 * runtimeEnv.ts
 * 运行环境抽象层：区分「思源插件环境」与「CLI（Node.js）环境」。
 *
 * - 插件环境：直接读取 window.siyuan.*；
 * - CLI 环境：启动时调用 initKernelEnv()，通过 API 拉取内核配置
 *   （/api/file/getFile path=/conf/conf.json，返回值即 window.siyuan.config 的 json）
 *   与笔记本列表（/api/notebook/lsNotebooks），缓存供同步函数使用。
 *
 * 注意：本文件仅允许依赖 @/syapi/apiClient（零依赖模块），避免循环引用。
 */
import { getApiClient } from "@/syapi/apiClient";

let cliModeFlag = false;

/** CLI 入口调用，显式标记当前为 CLI 运行环境 */
export function markCliMode() {
    cliModeFlag = true;
}

export function isCliMode(): boolean {
    return cliModeFlag;
}

/** 是否处于思源插件（浏览器/electron 渲染）环境 */
export function isPluginEnv(): boolean {
    return !cliModeFlag
        && typeof window !== "undefined"
        && (window as any)?.siyuan != null;
}

/* ------------------------------------------------------------------ */
/* 内核配置缓存                                                          */
/* ------------------------------------------------------------------ */

let kernelConfigCache: any = null;

/**
 * CLI 环境下拉取并缓存内核配置。
 * 插件环境无需调用（getKernelConfig 会直接读 window.siyuan.config）。
 */
export async function refreshKernelConfig(): Promise<void> {
    const response = await getApiClient().postRaw("/api/file/getFile", { path: "/conf/conf.json" });
    const json = await response.json();
    if (json && json.code !== undefined && json.code !== 0 && json.data == null) {
        throw new Error(`Failed to load kernel config (/conf/conf.json): ${json.msg ?? "unknown error"}`);
    }
    kernelConfigCache = json;
}

/**
 * 同步获取内核配置（即 window.siyuan.config 的等价物）。
 * 插件环境：window.siyuan.config；CLI 环境：initKernelEnv() 拉取的缓存。
 */
export function getKernelConfig(): any {
    if (isPluginEnv()) {
        return (window as any).siyuan.config;
    }
    return kernelConfigCache ?? {};
}

/* ------------------------------------------------------------------ */
/* 笔记本列表缓存                                                        */
/* ------------------------------------------------------------------ */

let notebookCache: any[] | null = null;
let notebookCacheTime = 0;
let notebookRefreshing = false;
const NOTEBOOK_CACHE_TTL_MS = 30 * 1000;

/** CLI 环境下拉取并缓存笔记本列表 */
export async function refreshNotebookCache(): Promise<void> {
    if (notebookRefreshing) return;
    notebookRefreshing = true;
    try {
        const response = await getApiClient().postJson("/api/notebook/lsNotebooks", {});
        if (response?.code === 0 && response.data?.notebooks) {
            notebookCache = response.data.notebooks;
            notebookCacheTime = Date.now();
        }
    } finally {
        notebookRefreshing = false;
    }
}

/**
 * 同步获取笔记本列表（即 window.siyuan.notebooks 的等价物）。
 * CLI 环境下若缓存超过 TTL，会触发一次后台异步刷新（本次调用仍返回旧值）。
 */
export function getNotebooksSync(): any[] {
    if (isPluginEnv()) {
        return (window as any).siyuan.notebooks ?? [];
    }
    if (notebookCache != null && Date.now() - notebookCacheTime > NOTEBOOK_CACHE_TTL_MS) {
        refreshNotebookCache().catch(() => { /* 后台刷新失败时保留旧缓存 */ });
    }
    return notebookCache ?? [];
}

/* ------------------------------------------------------------------ */
/* 初始化入口                                                            */
/* ------------------------------------------------------------------ */

/**
 * CLI 启动时调用：标记 CLI 模式并预热内核配置、笔记本列表缓存。
 */
export async function initKernelEnv(): Promise<void> {
    markCliMode();
    await refreshKernelConfig();
    await refreshNotebookCache();
}

/* ------------------------------------------------------------------ */
/* 常用取值封装                                                          */
/* ------------------------------------------------------------------ */

/** 鉴权码加密盐（插件与 CLI 使用同一工作空间时结果一致，保证格式兼容） */
export function getAuthSalt(): string {
    return getKernelConfig()?.system?.id ?? "glass";
}

/** 工作空间目录 */
export function getWorkspaceDir(): string {
    return getKernelConfig()?.system?.workspaceDir ?? "";
}
