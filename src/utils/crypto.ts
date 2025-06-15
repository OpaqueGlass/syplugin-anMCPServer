import { logPush } from "@/logger";
import { getPluginInstance } from "./pluginHelper";

export async function calculateSHA256(fileOrString) {
  // 如果是字符串，先转成 ArrayBuffer
  let data;
  if (typeof fileOrString === 'string') {
    const encoder = new TextEncoder();
    data = encoder.encode(fileOrString);
  } else if (fileOrString instanceof Blob) {
    data = await fileOrString.arrayBuffer();
  } else {
    throw new Error('Unsupported input type');
  }

  // 计算哈希
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export async function isAuthTokenValid(inputCode:string) {
    inputCode += window?.siyuan?.config?.system?.id ?? "glass";
    inputCode = await calculateSHA256(inputCode);
    const plugin = getPluginInstance();
    if (plugin?.mySettings["authCode"] === inputCode) {
        return true;
    } else {
        return false;
    }
}

export async function encryptAuthCode(inputCode:string) {
    inputCode += window?.siyuan?.config?.system?.id ?? "glass";
    return await calculateSHA256(inputCode);
}