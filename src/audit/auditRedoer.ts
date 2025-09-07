import { updateBlockAPI } from "@/syapi";

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
    }
}