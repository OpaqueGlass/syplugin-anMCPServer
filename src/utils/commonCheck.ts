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