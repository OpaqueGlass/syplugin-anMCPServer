import { removeAttributeViewBlocks, removeAttributeViewKey, updateBlockAPI } from "@/syapi";

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
    }
}