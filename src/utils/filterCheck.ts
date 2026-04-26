import { checkIdValid, getBlockDBItem, getDatabaseBlockId, getDocDBitem, isValidIdFormat } from "@/syapi/custom";
import { getPluginInstance } from "./pluginHelper";
import { debugPush, isDebugMode, logPush, warnPush } from "@/logger";
import { createErrorResponse } from "./mcpResponse";
import { isValidNotebookId } from "./commonCheck";
import { PermissionBit } from "@/constants";
import { getBlockPermission, getNotebookPermission } from "./permission/permissionStorageHelper";

function getPluginSettings() {
    const plugin = getPluginInstance();
    return plugin?.mySettings;
}

function getRequiredPermissionBit(hints?: McpToolAnnotations): number {
    if (hints?.destructiveHint) return PermissionBit.Destructive; // D位
    if (hints?.readOnlyHint === false) return PermissionBit.Write; // W位
    return PermissionBit.Read; // R位
}

function hasPermission(userValue: number, requiredBit: number): boolean {
    return (userValue & requiredBit) === requiredBit;
}

export async function filterNotebook(notebookId: string, requiredBit: number): Promise<boolean> {
    const {permissionCode} = await getNotebookPermissionStatus(notebookId);
    return !hasPermission(permissionCode, requiredBit);
}

export async function filterBlock(blockId: string, dbItem: any | null, requiredBit: number): Promise<boolean> {
    if (!dbItem) dbItem = await getBlockDBItem(blockId);
    if (!dbItem) return false;

    const { permissionCode } = await getBlockPermissionStatus(dbItem);

    return !hasPermission(permissionCode, requiredBit);
}

export async function filterDefault(requiredBit: number): Promise<boolean> {
    const settings = getPluginSettings();
    const permissionCode = settings?.defaultPermission ?? 0;
    return !hasPermission(permissionCode, requiredBit);
}

export async function getBlockPermissionStatus(dbItem: any | null): Promise<{permissionCode: number, permissionFromId: string}> {
    const settings = getPluginSettings();
    const notebookId = dbItem.box;
    let fromSource = 'unknown';
    // path 示例: /20230101121212-abc/20230102101010-def.sy
    const pathParts = dbItem.path.split('/');

    let finalPerm: number | undefined;
    pathParts[pathParts.length - 1] = dbItem.root_id;

    for (let i = pathParts.length - 1; i >= 1; i--) {
        const parentId = pathParts[i];
        const parentPermission = await getBlockPermission(parentId);
        if (parentPermission !== undefined) {
            finalPerm = parentPermission;
            debugPush(`文档过滤触发：由文档路径上的父级 ${parentId} 决定，权限值 ${finalPerm}`);
            fromSource = "D " + parentId;
            break;
        }
    }

    // 笔记本级别
    const notebookPermission = await getNotebookPermission(notebookId);
    if (finalPerm === undefined && notebookPermission !== undefined) {
        finalPerm = notebookPermission;
        debugPush(`文档过滤触发：由所属笔记本 ${notebookId} 决定，权限值 ${finalPerm}`);
        fromSource = "N " + notebookId;
    }

    // 兜底：默认权限
    if (finalPerm === undefined) {
        finalPerm = settings?.defaultPermission ?? 0;
        debugPush(`文档过滤触发：使用默认权限值 ${finalPerm}`);
        fromSource = 'default';
    }
    return {
        permissionCode: finalPerm,
        permissionFromId: fromSource
    }
}

export async function getNotebookPermissionStatus(notebookId: string): Promise<{permissionCode: number, permissionFromId: string}> {
    const settings = getPluginSettings();
    const notebookPermission = await getNotebookPermission(notebookId);
    let finalPerm: number | undefined;
    let fromSource = 'unknown';
    if (notebookPermission !== undefined) {
        finalPerm = notebookPermission;
        debugPush(`笔记本过滤触发：由所属笔记本 ${notebookId} 决定，权限值 ${finalPerm}`);
        fromSource = "N " + notebookId;
    } else {
        finalPerm = settings?.defaultPermission ?? 0;
        debugPush(`笔记本过滤触发：使用默认权限值 ${finalPerm}`);
        fromSource = 'default';
    }
    return {
        permissionCode: finalPerm,
        permissionFromId: fromSource
    }
}


export function mcpToolCheckPermissionWrapper(handler: (args: any, extra: any) => Promise<any>, funcTypeDict?: McpToolAnnotations) {
    return async (args: any, extra: any) => {
        // 通用id
        if (args.id !== undefined) {
            checkIdValid(args.id);
        }
        let checked = false;
        const requiredPermissionBit = getRequiredPermissionBit(funcTypeDict);
        debugPush(`工具权限检查开始，所需权限位: ${requiredPermissionBit}`);
        // 文档id
        if (args.docId) {
            if (!isValidIdFormat(args.docId)) {
                return createErrorResponse("Invalid docId format. Must be a 14-digit timestamp(yyyyMMddHHmmss) followed by a 7-char alphanumeric suffix. Example: '20260414211243-1a2b3c4'");
            }
            const docDbItem = await getDocDBitem(args.docId);
            if (docDbItem == null) {
                return createErrorResponse(`The document identified by ${args.docId} does not exist`);
            }
            if (await filterBlock(args.docId, docDbItem, requiredPermissionBit)) {
                return createErrorResponse(`Permission denied for ${args.docId}. According to user settings, the current tool cannot access this document.`);
            }
            checked = true;
        }

        // 块Id
        if (args.blockId) {
            if (!isValidIdFormat(args.blockId)) {
                return createErrorResponse("Invalid blockId format. Must be a 14-digit timestamp(yyyyMMddHHmmss) followed by a 7-char alphanumeric suffix. Example: '20260414211243-1a2b3c4'");
            }
            if (await filterBlock(args.blockId, null, requiredPermissionBit)) {
                return createErrorResponse(`Permission denied for ${args.blockId}. According to user settings, the current tool cannot access this block.`);
            }
            checked = true;
        }

        // 笔记本id
        if (args.notebookId) {
            if (!isValidIdFormat(args.notebookId)) {
                return createErrorResponse("Invalid notebookId format. Must be a 14-digit timestamp(yyyyMMddHHmmss) followed by a 7-char alphanumeric suffix. Example: '20260414211243-1a2b3c4'");
            }
            if (!isValidNotebookId(args.notebookId)) {
                return createErrorResponse(`The notebook identified by ${args.notebookId} does not exist`);
            }
            if (await filterNotebook(args.notebookId, requiredPermissionBit)) {
                return createErrorResponse(`Permission denied for ${args.notebookId}. According to user settings, the current tool cannot access this notebook.`);
            }
            checked = true;
        }

        // 数据库id
        if (args.avId) {
            if (!isValidIdFormat(args.avId)) {
                return createErrorResponse("Invalid avId format. Must be a 14-digit timestamp(yyyyMMddHHmmss) followed by a 7-char alphanumeric suffix. Example: '20260414211243-1a2b3c4'");
            }
            const databaseBlockIds = await getDatabaseBlockId(args.avId);
            if (databaseBlockIds) {
                // results.every 这里的逻辑是 有一个数据库对应的文档是可访问的，那么这个数据库就是可访问的
                const canNotAccessFlag = await Promise.all(databaseBlockIds.map(async (id) => await filterBlock(id, null, requiredPermissionBit))).then(results => results.every((v): v is boolean => !!v));
                if (canNotAccessFlag) {
                    return createErrorResponse(`Permission Denied. According to user settings, the current tool cannot access this database block.`);
                }
            } else {
                return createErrorResponse(`No database block found for the provided avId: ${args.avId}`);
            }
            checked = true;
        }

        if (!checked) {
            if (isDebugMode()) {
                warnPush("DEV WRAN: 当前工具未检测到明确的文档、块或笔记本ID参数进行权限过滤检查。请确认该工具是否需要权限检查，或是否在工具内部完成权限检查。");
            }
        }
        return await handler(args, extra);
    }
}