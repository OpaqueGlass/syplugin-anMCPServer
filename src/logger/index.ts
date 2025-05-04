
// debug push
let g_DEBUG = 2;
const g_NAME = "mcp";
const g_FULLNAME = "MCP_Server";

/*
LEVEL 0 忽略所有
LEVEL 1 仅Error
LEVEL 2 Err + Warn
LEVEL 3 Err + Warn + Info
LEVEL 4 Err + Warn + Info + Log
LEVEL 5 Err + Warn + Info + Log + Debug
请注意，基于代码片段加入window下的debug设置，可能在刚载入挂件时无效
*/
export function commonPushCheck() {
    if (window.top["OpaqueGlassDebugV2"] == undefined || window.top["OpaqueGlassDebugV2"][g_NAME] == undefined) {
        return g_DEBUG;
    }
    return window.top["OpaqueGlassDebugV2"][g_NAME];
}

export function isDebugMode() {
    return commonPushCheck() > g_DEBUG;
}

export function debugPush(str: string, ...args: any[]) {
    if (commonPushCheck() >= 5) {
        console.debug(`${g_FULLNAME}[D] ${new Date().toLocaleTimeString()} ${str}`, ...args);
    }
}

export function infoPush(str: string, ...args: any[]) {
    if (commonPushCheck() >= 3) {
        console.info(`${g_FULLNAME}[I] ${new Date().toLocaleTimeString()} ${str}`, ...args);
    }
}

export function logPush(str: string, ...args: any[]) {
    if (commonPushCheck() >= 4) {
        console.log(`${g_FULLNAME}[L] ${new Date().toLocaleTimeString()} ${str}`, ...args);
    }
}

export function errorPush(str: string, ... args: any[]) {
    if (commonPushCheck() >= 1) {
        console.error(`${g_FULLNAME}[E] ${new Date().toLocaleTimeString()} ${str}`, ...args);
    }
}

export function warnPush(str: string, ... args: any[]) {
    if (commonPushCheck() >= 2) {
        console.warn(`${g_FULLNAME}[W] ${new Date().toLocaleTimeString()} ${str}`, ...args);
    }
}