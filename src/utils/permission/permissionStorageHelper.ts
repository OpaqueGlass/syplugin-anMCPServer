import { CONSTANTS } from "@/constants";
import { JSONStorage } from "../jsonStorageUtil";

let _filePermissionJsonStorage: JSONStorage<PermissionSettings> | null = null;
let _notebookPermissionJsonStorage: JSONStorage<PermissionSettings> | null = null;

export async function useBlockPermissionJsonStorage(): Promise<JSONStorage<PermissionSettings>> {
    if (!_filePermissionJsonStorage) {
        _filePermissionJsonStorage = new JSONStorage<PermissionSettings>("blockPermissionSettings.json");
        await _filePermissionJsonStorage.init();
    }
    return _filePermissionJsonStorage;
}

export async function useNotebookPermissionJsonStorage(): Promise<JSONStorage<PermissionSettings>> {
    if (!_notebookPermissionJsonStorage) {
        _notebookPermissionJsonStorage = new JSONStorage<PermissionSettings>("notebookPermissionSettings.json");
        await _notebookPermissionJsonStorage.init();
    }
    return _notebookPermissionJsonStorage;
}

export async function setBlockPermission(blockId: string, permissionValue: number|undefined): Promise<void> {
    const storage = await useBlockPermissionJsonStorage();
    storage.set(blockId, permissionValue);
}

export async function setNotebookPermission(notebookId: string, permissionValue: number|undefined): Promise<void> {
    const storage = await useNotebookPermissionJsonStorage();
    storage.set(notebookId, permissionValue);
}

export async function getBlockPermission(blockId: string): Promise<number | undefined> {
    const storage = await useBlockPermissionJsonStorage();
    return await storage.get(blockId);
}

export async function getNotebookPermission(notebookId: string): Promise<number | undefined> {
    const storage = await useNotebookPermissionJsonStorage();
    return await storage.get(notebookId);
}