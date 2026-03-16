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
 * 检查路径是否合法
 * 请注意，该函数允许`/`作为路径分隔符
 * @param path 待检查的路径字符串
 * @returns { isValid: boolean; reason?: string } 返回校验结果及失败原因
 */
export function validatePath(path: string): { isValid: boolean; reason?: string } {
  if (!path || typeof path !== 'string' || path.trim() === '') {
    return { isValid: false, reason: "路径不能为空" };
  }

  // 1. 禁止目录逃逸：检测 ".."
  // 匹配单独的 ".."，或路径片段中的 "/../", "../", "/.."
  const traversalPattern = /(^|[\\\/])\.\.([\\\/]|$)/;
  if (traversalPattern.test(path)) {
    return { isValid: false, reason: "检测到非法路径跳转 '..'" };
  }

  // 2. 非法字符集 (Windows & Linux 通用标准)
  // 包含控制字符 (0-31, 127) 和 Windows 保留字符: < > : " | ? *
  // 注意：此处未包含 / 和 \，因为你允许 / 创建文件夹
  const invalidCharsPattern = /[\x00-\x1F\x7F<>:"|?*]/;
  if (invalidCharsPattern.test(path)) {
    return { isValid: false, reason: "路径包含非法字符 (例如 < > : \" | ? *)" };
  }

  // 3. 检查 Windows 系统保留的文件名 (如 CON, PRN, NUL 等)
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;
  const pathSegments = path.split(/[\\\/]/);
  for (const segment of pathSegments) {
    if (reservedNames.test(segment.trim())) {
      return { isValid: false, reason: `使用了系统保留名称: ${segment}` };
    }
    
    // 额外检查：Windows 不允许文件名以空格或点结尾
    if (segment.endsWith(' ') || (segment.endsWith('.') && segment !== '.')) {
      return { isValid: false, reason: "文件名不能以空格或点结尾" };
    }
  }

  return { isValid: true };
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