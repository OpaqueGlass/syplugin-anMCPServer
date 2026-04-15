import { checkIdValid, getBlockDBItem, getDatabaseBlockId, getDocDBitem, isValidIdFormat } from "@/syapi/custom";
import { getPluginInstance } from "./pluginHelper";
import { debugPush, logPush } from "@/logger";
import { createErrorResponse } from "./mcpResponse";
import { isValidNotebookId } from "./commonCheck";

function getPluginSettings() {
    const plugin = getPluginInstance();
    return plugin?.mySettings;
}


export async function filterBlock(blockId: string, dbItem: any|null): Promise<boolean> {
    const settings = getPluginSettings();
    const filterNotebooks = settings?.filterNotebooks.split("\n").map(id => id.trim()).filter(id => id);
    const filterDocuments = settings?.filterDocuments.split("\n").map(id => id.trim()).filter(id => id);
    if (!dbItem) {
        dbItem = await getBlockDBItem(blockId);
    }
    debugPush("Checking", dbItem);
    if (dbItem) {
        const notebookId = dbItem.box;
        const path = dbItem.path;
        if (filterNotebooks && filterNotebooks.includes(notebookId)) {
            return true;
        }
        if (filterDocuments) {
            for (const docId of filterDocuments) {
                if (notebookId === docId || path.includes(docId) || dbItem.id === docId) {
                    return true;
                }
            }
        }
    }
    return false;
}

export function filterNotebook(notebookId: string): boolean {
    const settings = getPluginSettings();
    const filterNotebooks = settings?.filterNotebooks.split("\n").map(id => id.trim()).filter(id => id);
    debugPush("Checking", settings, filterNotebooks);
    if (filterNotebooks && filterNotebooks.includes(notebookId)) {
        return true;
    }
    return false;
}


export function mcpToolCheckPermissionWrapper(handler: (args: any, extra: any) => Promise<any>, funcTypeDict?: McpToolAnnotations) {
    return async (args: any, extra: any) => {
        // 通用id
        if (args.id !== undefined) {
            checkIdValid(args.id);
        }
        // 文档id
        if (args.docId) {
            if (!isValidIdFormat(args.docId)) {
                return createErrorResponse("Invalid docId format. Must be a 14-digit timestamp(yyyyMMddHHmmss) followed by a 7-char alphanumeric suffix. Example: '20260414211243-1a2b3c4'");
            }
            const docDbItem = await getDocDBitem(args.docId);
            if (docDbItem == null) {
                return createErrorResponse("The document identified by docId does not exist");
            }
            if (await filterBlock(args.docId, docDbItem)) {
                return createErrorResponse("Permission denied for this docId");
            }
        }

        // 块Id
        if (args.blockId) {
            if (!isValidIdFormat(args.blockId)) {
                return createErrorResponse("Invalid blockId format. Must be a 14-digit timestamp(yyyyMMddHHmmss) followed by a 7-char alphanumeric suffix. Example: '20260414211243-1a2b3c4'");
            }
            if (await filterBlock(args.blockId, null)) {
                return createErrorResponse("Permission denied for this blockId");
            }
        }

        // 笔记本id
        if (args.notebookId) {
            if (!isValidIdFormat(args.notebookId)) {
                return createErrorResponse("Invalid notebookId format. Must be a 14-digit timestamp(yyyyMMddHHmmss) followed by a 7-char alphanumeric suffix. Example: '20260414211243-1a2b3c4'");
            }
            if (!isValidNotebookId(args.notebookId)) {
                return createErrorResponse("The notebook identified by " + args.notebookId + " does not exist");
            }
            if (filterNotebook(args.notebookId)) {
                return createErrorResponse("Permission denied for this notebookId");
            }
        }

        // 数据库id
        if (args.avId) {
            if (!isValidIdFormat(args.avId)) {
                return createErrorResponse("Invalid avId format. Must be a 14-digit timestamp(yyyyMMddHHmmss) followed by a 7-char alphanumeric suffix. Example: '20260414211243-1a2b3c4'");
            }
            const databaseBlockIds = await getDatabaseBlockId(args.avId);
            if (databaseBlockIds) {
                for (const blockId of databaseBlockIds) {
                    if (await filterBlock(blockId, null)) {
                        return createErrorResponse("Permission Denied. The specified database block is excluded by the user settings.");
                    }
                }
            } else {
                return createErrorResponse("No database block found for the provided avId");
            }
        }

        return await handler(args, extra);
    }
}