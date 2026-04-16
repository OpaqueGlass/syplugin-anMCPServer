import { removeAttributeViewBlocks, removeAttributeViewKey, removeBlockAPI, removeDocAPI, updateBlockAPI } from "@/syapi";

export async function auditRedo(taskItem: any) {
    const {
        id,
        modifiedIds,
        content,
        taskType,
        args,
        status,
        createdAt,
        updatedAt
    } = taskItem;
    switch (taskType) {
        case "updateBlock": {
            const response = await updateBlockAPI(content, modifiedIds[0]);
            break;
        }
        case "deleteDatabaseRow": {
            const response = await removeAttributeViewBlocks(args.avId, args.rowIds);
            break;
        }
        case "deleteDatabaseColumn": {
            const response = await removeAttributeViewKey(args.avId, args.columnId, false);
            break;
        }
        case "deleteDocument": {
            const response = await removeDocAPI(args["box"], args["path"]);
            
            break;
        }
        case "deleteBlock": {
            const response = await removeBlockAPI(modifiedIds[0]);
            break;
        }
        default: {
            throw new Error(`Unknown task type: ${taskType}`);
        }
    }
}