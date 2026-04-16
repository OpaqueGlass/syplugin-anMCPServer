import { renderAttributeView } from "@/syapi";

export async function isRowIdExistInAttributeView(avId: string, rowIds: string[]): Promise<boolean> {
    const renderResult = await renderAttributeView({"id": avId, "page": 1, "pageSize": 500});

    if (renderResult?.view?.rowCount > 500) {
        return true;
    }
    const existIds = new Set(renderResult?.view?.rows.map(row => row.id) || []);
    return rowIds.every(rowId => existIds.has(rowId));
}

/**
 * 根据 rowIds 获取对应的行数据
 * @param avId 视图 ID
 * @param targetRowIds 目标行 ID 数组
 * @returns 返回找到的行对象数组
 */
export async function getRowsByIdInAttributeView(avId: string, targetRowIds: string[]): Promise<any[] | null> {
    let currentPage = 1;
    const pageSize = 500; // 尽量使用最大分页步长以减少请求次数
    let hasMore = true;

    let results = [];

    while (hasMore) {
        const renderResult = await renderAttributeView({
            "id": avId,
            "page": currentPage,
            "pageSize": pageSize
        });

        const rows = renderResult?.view?.rows || [];
        
        // 1. 在当前页查找目标行
        const targetRows = rows.filter(row => targetRowIds.includes(row.id));
        results.push(...targetRows);

        // 2. 如果找到了，直接返回该行，终止后续所有请求
        if (results.length >= targetRowIds.length) {
            return results;
        }

        // 3. 边界判断：检查是否还有下一页
        const totalRows = renderResult?.view?.rowCount || 0;
        const fetchedRowsCount = currentPage * pageSize;

        if (rows.length < pageSize || fetchedRowsCount >= totalRows) {
            hasMore = false;
        } else {
            currentPage++;
        }
    }

    return results;
}