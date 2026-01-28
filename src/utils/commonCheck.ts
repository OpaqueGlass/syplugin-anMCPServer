import { CONSTANTS } from "@/constants";

/**
 * 判定字符串是否有效
 * @param s 需要检查的字符串（或其他类型的内容）
 * @returns true / false 是否为有效的字符串
 */
export function isValidStr(s: any): boolean {
    if (s == undefined || s == null || s === '') {
		return false;
	}
	return true;
}

export function isValidAuthCode(str) {
    return /^[A-Za-z0-9+\-\/._~]{6,}$/.test(str);
}

export function isAuthCodeSetted(str) {
    if (str !== CONSTANTS.CODE_UNSET) {
        return true;
    }
    return false;
}

/**
 * 判断字符串是否为空白
 * @param s 字符串
 * @returns true 字符串为空或无效或只包含空白字符
 */
export function isBlankStr(s: any): boolean {
	if (!isValidStr(s)) return true;
	const clearBlankStr = s.replace(/\s+/g, '');
	if (clearBlankStr === '') {
		return true;
	}
	return false;
}

let cacheIsMacOs = undefined;
export function isMacOs() {
	let platform = window.top.siyuan.config.system.os ?? navigator.platform ?? "ERROR";
    platform = platform.toUpperCase();
    let isMacOSFlag = cacheIsMacOs;
    if (cacheIsMacOs == undefined) {
        for (let platformName of ["DARWIN", "MAC", "IPAD", "IPHONE", "IOS"]) {
            if (platform.includes(platformName)) {
                isMacOSFlag = true;
                break;
            }
        }
        cacheIsMacOs = isMacOSFlag;
    }
	if (isMacOSFlag == undefined) {
		isMacOSFlag = false;
	}
	return isMacOSFlag;
}

export function isEventCtrlKey(event) {
    if (isMacOs()) {
        return event.metaKey;
    }
    return event.ctrlKey;
}

export function isSelectQuery(sql: string): boolean {
    return sql.trim().toUpperCase().startsWith("SELECT");
}

export function isValidNotebookId(id: string) {
    const notebooks = window.siyuan.notebooks;
    const result = notebooks.find(item=>item.id === id);
    return result != null;
}

export function isNonContainerBlockType(type: string) {
    const nonContainerTypes = ["audio", "av", "c", "html", "iframe", "m", "p", "t", "tb", "video", "widget", "h", "query_embed"];
    return nonContainerTypes.includes(type);
}

export function isNonParentBlockType(type: string) {
    const nonContainerTypes = ["audio", "av", "c", "html", "iframe", "m", "p", "t", "tb", "video", "widget", "query_embed"];
    return nonContainerTypes.includes(type);
}

export function isContainerBlockType(type: string) {
    const containerTypes = ["d", "l", "i", "callout", "b", "s"];
    return containerTypes.includes(type);
}

/**
 * 解析版本号字符串，移除除数字和点之外的所有字符，并将其分割成数字数组。
 * 例如 "v3.1.2-beta" -> [3, 1, 2]
 * @param version - 版本号字符串
 * @returns - 由版本号各部分组成的数字数组
 */
const parseVersion = (version: string): number[] => {
    // 如果 version 为空或非字符串，返回空数组以避免错误
    if (!version || typeof version !== 'string') {
        return [];
    }
    return version.replace(/[^0-9.]/g, '').split('.').map(Number);
};

/**
 * 比较当前内核版本是否小于输入的版本号。
 * @param version - 要比较的版本号字符串，例如 "3.1.23" 或 "3.2.1.1"
 * @returns boolean - 如果当前版本小于输入版本，则返回 true；否则（大于或等于）返回 false。
 */
export function isCurrentVersionLessThan(version: string): boolean {
    const parsedInputVersion = parseVersion(version);
    const parsedCurrentVersion = parseVersion(window.siyuan.config.system.kernelVersion);

    const len = Math.max(parsedCurrentVersion.length, parsedInputVersion.length);

    for (let i = 0; i < len; i++) {
        const currentPart = parsedCurrentVersion[i] || 0;
        const inputPart = parsedInputVersion[i] || 0;

        if (currentPart < inputPart) {
            return true; 
        }
        if (currentPart > inputPart) {
            return false; 
        }
    }
    return false;
}