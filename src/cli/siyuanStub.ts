/**
 * siyuanStub.ts
 * CLI（Node.js）构建时替代 "siyuan" 前端模块的 stub。
 * webpack.cli.config.js 通过 resolve.alias 将 "siyuan" 指向本文件。
 *
 * 仅提供 CLI 打包依赖图中实际会被引用的运行时导出；
 * 所有 UI 相关函数均为 no-op（或输出到 stderr 的日志）。
 */

export function showMessage(msg: string, timeout?: number, type?: string, id?: string) {
    // CLI 无 UI，消息输出到 stderr（避免污染 stdio MCP 通道）
    console.error(`[showMessage${type ? "/" + type : ""}] ${msg}`);
}

export function getBackend(): string {
    return process.platform === "win32" ? "windows"
        : process.platform === "darwin" ? "darwin" : "linux";
}

export function getFrontend(): string {
    return "desktop";
}

export function openTab(_options?: any) {
    // no-op in CLI
}

export function openMobileFileById(_app?: any, _id?: string, _action?: any) {
    // no-op in CLI
}

export function getAllEditor(): any[] {
    return [];
}

export function confirm(_title?: string, _text?: string, _confirmCb?: any, _cancelCb?: any) {
    // no-op in CLI
}

export function fetchPost(_url?: string, _data?: any, _cb?: any) {
    // no-op in CLI（项目内部请求统一走 ApiClient）
}

export class Dialog {
    element: any = null;
    constructor(_options?: any) { /* no-op in CLI */ }
    destroy() { /* no-op */ }
}

export class Menu {
    constructor(_id?: string, _closeCb?: any) { /* no-op in CLI */ }
    addItem(_item?: any) { /* no-op */ }
    open(_options?: any) { /* no-op */ }
}

export class Setting {
    constructor(_options?: any) { /* no-op in CLI */ }
    addItem(_item?: any) { /* no-op */ }
}

export class Plugin {
    i18n: any = {};
    data: any = {};
    name: string = "syplugin-anMCPServer";
    async loadData(_storageName: string): Promise<any> { return null; }
    async saveData(_storageName: string, _content: any): Promise<void> { /* no-op */ }
}

export class Constants {
    // 常量占位；CLI 依赖图中通常不会实际读取
}

// 类型导出占位（值为 undefined，仅避免罕见的运行时引用报错）
export const Custom: any = undefined;
