import { getBlockDBItem } from "@/syapi/custom";
import { getPluginInstance } from "./pluginHelper";
import { debugPush, logPush } from "@/logger";

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
