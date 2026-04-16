import { z } from "zod";
import { createErrorResponse, createJsonResponse, createSuccessResponse } from "../utils/mcpResponse";
import { addAttributeViewBlocks, addAttributeViewKey, addblockAttrAPI, batchSetAttributeViewBlockAttrs, getAttributeViewKeysByAvID, getblockAttr, insertBlockOriginAPI, queryAPI, removeAttributeViewBlocks, removeAttributeViewKey, removeBlockAPI, removeDocAPI, renderAttributeView, searchAttributeView } from "@/syapi";
import { checkIdValid, generateBlockId, getBlockDBItem, getDatabaseBlockId, isValidIdFormat } from "@/syapi/custom";
import { McpToolsProvider } from "./baseToolProvider";
import { isCurrentVersionLessThan, isNonContainerBlockType, isValidNotebookId, isValidStr } from "@/utils/commonCheck";

import { insertBlockWithCheckWrapper } from "./blockWrite";
import { fromRowColumnDataVoListToUpdateAPIInfo, reduceAvRowData } from "@/utils/avReduceUtils";
import { logPush } from "@/logger";
import { getPluginInstance } from "@/utils/pluginHelper";
import { TASK_STATUS, taskManager } from "@/utils/historyTaskHelper";
import { CONSTANTS } from "@/constants";
import { getRowsByIdInAttributeView, isRowIdExistInAttributeView } from "@/utils/avUtils";
import { filterBlock } from "@/utils/filterCheck";


const columnDataSchema = z.object({
    keyName: z.string().optional().describe("列名称"),
    type: z.enum(CONSTANTS.DATA_CHANGEABLE_COLUMN_TYPES as [string, ...string[]]).optional().describe("列的类型，例如：text、number、select、mselect、date、checkbox、relation 等，存在名称相同、类型不同列时，建议指定列类型"),
    keyId: z.string().optional().describe("列的唯一标识 ID"),
    value: z.union([
        z.array(z.string()).describe("选择（单选/多选）或关联类型 (relation)"), 
        z.number().describe("数值类型"),
        z.object({
            startDate: z.string().describe("格式: yyyy-MM-dd HH:mm:ss"),
            endDate: z.string().optional().describe("格式: yyyy-MM-dd HH:mm:ss，结束日期可选，填写则认为是时间段"),
            isNotTime: z.boolean().optional().describe("是否仅包含日期")
        }).describe("日期类型"),
        z.boolean().describe("复选框类型"),
        z.string().describe("URL/email/纯文本类型"),
        z.array(z.object({
            type: z.enum(["file", "image"]).describe("附件类型，文件或图片"),
            content: z.string().describe("文件/图片的URL地址或assets/开头的相对路径"),
            name: z.string().describe("文件名称")
        })).describe("mAsset附件类型")
    ]).describe("字段值，value的具体类型取决于列定义的类型")
}).refine(data => data.keyName || data.keyId, {
    message: "keyName 和 keyId 必须指定其中一个",
    path: ["keyName"]
});

const rowSchema = z.object({
    bindBlockId: z.string().optional().describe("绑定的块 ID，其内容将作为主键值"),
    primaryColumnData: z.string().optional().default("").describe("手动指定主键字段值，bindBlockId 为空时生效"),
    fillDefault: z.boolean().optional().default(true).describe("不提供的字段是否填充默认值"),
    otherColumnData: z.array(columnDataSchema).optional().describe("其他非主键列的数据")
});

const CreateDatabaseRowSchema = z.object({
    avId: z.string().describe("目标数据库的 ID"),
    rows: z.array(rowSchema).describe("要添加的行数据列表")
});

export class AttributeViewToolProvider extends McpToolsProvider<any> {
    async _getTools(): Promise<McpTool<any>[]> {
        return [
            {
                name: "siyuan_create_database",
                description: "Create a new database. 返回值包括：avId（数据库ID）和 blockId（数据库所在的块ID），对数据库的操作请求需使用avId。",
                schema: {
                    nextID: z.string().optional().describe("后一个块的ID，用于指定插入位置，优先级最高，如果提供了nextID，则忽略previousID和parentID"),
                    previousID: z.string().optional().describe("前一个块的ID，用于指定插入位置，如果提供了previousID且未提供nextID，则使用previousID来确定插入位置，忽略parentID"),
                    parentID: z.string().optional().describe("父块的ID，用于指定插入位置，父块必须是容器块，例如引述块、文档块等，但不包含标题块；优先级最低，如果仅提供parentID，则将数据库插入到父块的末尾")
                },
                handler: createDatabaseHandler,
                annotations: {
                    readOnlyHint: false,
                    destructiveHint: false,
                    idempotentHint: false,
                }
            }, {
                name: "siyuan_search_existing_databases",
                description: "Search for existing databases in the current workspace using keywords. This tool is designed to help you find the avId of an existing database, which is required for other database operations.",
                schema: {
                    keywords: z.string().optional().describe("Search keywords. If not provided, the search will return up to 100 existing databases in the workspace. If provided, separate multiple keywords with spaces; only databases matching all keywords will be returned.")
                },
                handler: searchExistingDatabasesHandler,
                annotations: {
                    readOnlyHint: true,
                }
            }, {
                name: "siyuan_get_database_schema",
                description: "Get the schema of a specific database.\n\n返回值包括：avId（数据库ID）和 blockId（数据库所在的块ID），对数据库的操作请求使用avId。",
                schema: {
                    avId: z.string().describe("The ID of the database."),
                },
                handler: getDatabaseSchemaHandler,
                annotations: {
                    readOnlyHint: true,
                }
            },
            {
                name: "siyuan_get_database_view_schema",
                description: "Get the schema of a specific view within a database.\n\n返回值包括：avId（数据库ID）和 blockId（数据库所在的块ID），对数据库的操作请求使用avId。",
                schema: {
                    avId: z.string().describe("The ID of the database."),
                    viewId: z.string().describe("The ID of the view."),
                },
                handler: getDatabaseViewSchemaHandler,
                annotations: {
                    readOnlyHint: true,
                }
            },
            {
                name: "siyuan_query_database",
                description: "Search for rows in the database with keywords.",
                schema: {
                    avId: z.string().describe("The ID of the database."),
                    query: z.string().optional().describe("Search keywords; separate multiple keywords with spaces. Only results matching all keywords will be returned."),
                    page: z.number().optional().describe("The page number for paginated results, starting from 1."),
                    pageSize: z.number().optional().describe("The number of results per page for pagination."),
                    viewId: z.string().optional().describe("The ID of the view to query against, if not provided, the default view will be used."),
                },
                handler: queryDatabaseHandler,
                annotations: {
                    readOnlyHint: true,
                }
            },
            {
                name: "siyuan_add_database_row_with_data",
                description: "Add a new row to the database and get the row ID of the newly added row. ",
                schema: {
                    avId: z.string().describe("目标数据库的 ID"),
                    bindBlockId: z.string().optional().describe("绑定的块 ID，其内容将作为主键值"),
                    primaryColumnData: z.string().optional().default("").describe("手动指定主键字段值，bindBlockId 为空时生效"),
                    fillDefault: z.boolean().optional().default(true).describe("不提供的字段是否填充默认值"),
                    otherColumnData: z.array(columnDataSchema).optional().describe("其他非主键列的数据")
                },
                handler: addDatabaseRowHandler,
                annotations: {
                    readOnlyHint: false,
                    destructiveHint: false,
                    idempotentHint: false,
                }
            }, {
                name: "siyuan_update_database_row_with_data",
                description: "Update an existing row in the database. Columns not explicitly mentioned will remain unchanged unless explicitly updated to blank values. The values of the rollup and template column types cannot be modified using this tool.",
                schema: {
                    avId: z.string().describe("目标数据库的 ID"),
                    rowId: z.string().describe("要更新的行ID"),
                    otherColumnData: z.array(columnDataSchema).optional().describe("要更新的列数据，格式同添加行接口中的otherColumnData")
                },
                handler: updateDatabaseRowHandler,
                annotations: {
                    readOnlyHint: false,
                    destructiveHint: false,
                    idempotentHint: true,
                }
            }, {
                name: "siyuan_delete_database_rows",
                description: "Delete one or more rows from the database.",
                schema: {
                    avId: z.string().describe("目标数据库的 ID"),
                    rowIds: z.array(z.string()).describe("要删除的行ID列表")
                },
                handler: deleteDatabaseRowHandler,
                annotations: {
                    readOnlyHint: false,
                    destructiveHint: true,
                    idempotentHint: true,
                }
            }, {
                name: "siyuan_add_database_column",
                description: "Add a new column to the database.",
                schema: {
                    avId: z.string().describe("目标数据库的 ID"),
                    columnName: z.string().describe("列名称"),
                    columnType: z.enum(CONSTANTS.DATA_CHANGEABLE_COLUMN_TYPES as [string, ...string[]]).describe("列的类型"),
                    previousColumnId: z.string().optional().describe("前一个列的ID，用于指定插入位置，如果未提供，则将新列添加到末尾")
                },
                handler: addDatabaseColumnHandler,
                annotations: {
                    readOnlyHint: false,
                    destructiveHint: false,
                    idempotentHint: false,
                }
            }, {
                name: "siyuan_delete_database_column",
                description: "Delete a column from the database.",
                schema: {
                    avId: z.string().describe("目标数据库的 ID"),
                    columnId: z.string().describe("要删除的列ID"),
                },
                handler: deleteDatabaseColumnHandler,
                annotations: {
                    readOnlyHint: false,
                    destructiveHint: true,
                    idempotentHint: true,
                }
            }, {
                name: "siyuan_list_database_locations",
                description: "Finds all content block IDs where a specific database (avId) is instantiated. Use this to locate the physical positions of a database, including its original instance and all mirrored versions.",
                schema: {
                    avId: z.string().describe("目标数据库的 ID")
                },
                handler: getAttributeViewLocatedBlockIdHandler,
                annotations: {
                    readOnlyHint: true,
                    destructiveHint: false,
                }
            }
        ];
    }
}

async function createDatabaseHandler(params, extra) {
    const { nextID, previousID, parentID } = params;
    
    const avId = generateBlockId();
    let blockId = generateBlockId(); // WARN: 似乎blockId指定之后也不对应blockId，目前来看这个id传入只是标识符，后端会重新分配id
    const domDataBaseStr = `<div contenteditable=\"false\" data-av-id=\"${avId}\" data-av-type=\"table\" data-node-id=\"${blockId}\" data-node-index=\"1\" data-type=\"NodeAttributeView\" class=\"av\" updated=\"${avId.substring(0, "20260409230104".length)}\"><div spellcheck=\"false\"></div><div class=\"protyle-attr\" contenteditable=\"false\">​</div></div>`
    const response = await insertBlockWithCheckWrapper(domDataBaseStr, nextID, previousID, parentID);
    if (response == null) {
        return createErrorResponse("Failed to insert the block");
    }
    if (response["isError"] !== undefined && response["isError"] === true) {
        return response;
    }
    blockId = response[0].doOperations[0].id;
    return createJsonResponse({
        "avId": avId,
    });
}

async function searchExistingDatabasesHandler(params, extra) {
    const { keywords } = params;
    let searchResult = [];
    searchResult = await searchAttributeView(keywords ?? "");
    if (!isValidStr(keywords)) {
        searchResult = searchResult.slice(0, 100);
    }
    const processedResults = searchResult.map(result => {
        const { children, ...rest } = result;
        return {
            ...rest,
            views: (children || []).map(view => ({
                name: view.viewName,
                id: view.viewID,
                layout: view.viewLayout,
            }))
        };
    });
    const filterPromises = processedResults.map(result => filterBlock(result.blockID, null));
    const filterFlags = await Promise.all(filterPromises);
    const filteredResult = processedResults.filter((_, index) => !filterFlags[index]);
    return createJsonResponse(filteredResult);
}

async function getDatabaseViewSchemaHandler(params, extra) {
    const { avId, viewId } = params;
    const attributeViewRenderResult = await renderAttributeView({ "id": avId, "viewId": viewId } as RenderAttributeViewBody);
    const schemaResponse = {
        "id": avId,
        "views": attributeViewRenderResult.views.map(view => ({
            "id": view.id,
            "name": view.name,
            "type": view.type,
            "desc": view.desc,
        })),
        "currentView": {
            "id": attributeViewRenderResult.viewID,
            "type": attributeViewRenderResult.viewType,
            "name": attributeViewRenderResult.view.name,
            "columns": attributeViewRenderResult.view.columns,
            "desc": attributeViewRenderResult.view.desc,
            "group": attributeViewRenderResult.view.group,
            "sorts": attributeViewRenderResult.view.sorts,
            "filters": attributeViewRenderResult.view.filters,
        }
    };
    return createJsonResponse(schemaResponse);
}

async function getDatabaseSchemaHandler(params, extra) {
    const { avId } = params;
    const attributeViewRenderResult = await renderAttributeView({ "id": avId } as RenderAttributeViewBody);
    const schemaResponse = {
        "id": avId,
        "views": attributeViewRenderResult.views,
        "isMirror": attributeViewRenderResult.isMirror,
        "allColumns": [],
    };
    schemaResponse.allColumns = await getAttributeViewKeysByAvID(avId);
    return createJsonResponse(schemaResponse);
}


async function queryDatabaseHandler(params, extra) {
    const { avId, query = "", page = 1, pageSize = 20, viewId = "" } = params;
    const attributeViewRenderResult = await renderAttributeView({ "id": avId, "viewId": viewId, "query": isValidStr(query) ? query : "", page, pageSize } as RenderAttributeViewBody);
    // 处理返回值
    const cleanedRows = reduceAvRowData(attributeViewRenderResult.view.rows, attributeViewRenderResult.view.columns);
    return createJsonResponse({
        "rows": cleanedRows,
        "rowCount": attributeViewRenderResult.view.rowCount,
        "columnSchema": attributeViewRenderResult.view.columns,
        "page": page,
        "pageSize": pageSize,
    });
}

async function addDatabaseRowHandler(params, extra) {
    const { avId, bindBlockId, primaryColumnData = "", fillDefault = true, otherColumnData = [] } = params;
    let resultRowId = generateBlockId();
    const reqSrcData = {
        itemID: resultRowId,
    };
    if (isValidStr(bindBlockId)) {
        if (!isValidIdFormat(bindBlockId)) {
            return createErrorResponse("Invalid bindBlockId format. Must be a 14-digit timestamp(yyyyMMddHHmmss) followed by a 7-char alphanumeric suffix. Example: '20260414211243-1a2b3c4'");
        }
        // Process the request
        reqSrcData["id"] = bindBlockId;
        reqSrcData["isDetached"] = false;
        if (await getBlockDBItem(bindBlockId) == null) {
            return createErrorResponse(`Target block with ID '${bindBlockId}' does not exist. The provided bindBlockId must correspond to an existing block record in the database. No match found.`);
        }
    } else {
        reqSrcData["isDetached"] = true;
        reqSrcData["content"] = primaryColumnData;
    }
    const addNewRowResponse = await addAttributeViewBlocks(avId, [reqSrcData as AddAttributeViewBlocksBodySrcs], !fillDefault);
    // 2. 填充其他信息
    // 转换一下，需要将name的转换为keyID
    const columnsInfo = await getAttributeViewKeysByAvID(avId);
    const [updateDataForOtherColumns, wrongData] = await fromRowColumnDataVoListToUpdateAPIInfo(otherColumnData, columnsInfo, resultRowId);
    logPush("updateDataForOtherColumns", updateDataForOtherColumns);
    const batchSetResponse = await batchSetAttributeViewBlockAttrs(avId, updateDataForOtherColumns);
    // 需要返回行id
    return createJsonResponse({
        rowId: resultRowId,
        wrongData: wrongData,
    });
}

async function updateDatabaseRowHandler(params, extra) {
    const { avId, rowId, otherColumnData = [] } = params;
    if (!isValidIdFormat(rowId)) {
        return createErrorResponse("Invalid rowId format. Must be a 14-digit timestamp(yyyyMMddHHmmss) followed by a 7-char alphanumeric suffix. Example: '20260414211243-1a2b3c4'");
    }
    // 转换一下，需要将name的转换为keyID
    const columnsInfo = await getAttributeViewKeysByAvID(avId);
    const [updateDataForOtherColumns, wrongData] = await fromRowColumnDataVoListToUpdateAPIInfo(otherColumnData, columnsInfo, rowId);
    logPush("updateDataForOtherColumns", updateDataForOtherColumns);
    const batchSetResponse = await batchSetAttributeViewBlockAttrs(avId, updateDataForOtherColumns);
    return createJsonResponse({
        rowId: rowId,
        wrongData: wrongData,
    });
}

async function deleteDatabaseRowHandler(params, extra) {
    const { avId, rowIds } = params;
    const data = {
        avId,
        rowIds
    }
    const plugin = getPluginInstance();
    const autoApproveDeleteChange = plugin?.mySettings["autoApproveDeleteChange"] ?? false;
    for (const rowId of rowIds) {
        if (!isValidIdFormat(rowId)) {
            return createErrorResponse("Invalid rowId format. Must be a 14-digit timestamp(yyyyMMddHHmmss) followed by a 7-char alphanumeric suffix. Example: '20260414211243-1a2b3c4'");
        }
        
    }
    const checkResult = await getRowsByIdInAttributeView(avId, rowIds);
    if (checkResult.length !== rowIds.length) {
        // 对比一下id，找不存在的id
        const existingRowIds = new Set(checkResult.map(row => row.id));
        const nonExistingRowIds = rowIds.filter(rowId => !existingRowIds.has(rowId));
        return createErrorResponse(`The following rowIds do not exist in the specified database: ${nonExistingRowIds.join(", ")}`);
    }

    if (autoApproveDeleteChange) {
        const response = await removeAttributeViewBlocks(avId, rowIds);
        if (response === false) {
            return createErrorResponse("Failed to delete the database rows");
        }
        taskManager.insert(avId, data, "deleteDatabaseRow", data, TASK_STATUS.APPROVED);
        return createSuccessResponse("Block updated successfully.");
    } else {
        const columnsInfo = await getAttributeViewKeysByAvID(avId);
        taskManager.insert(avId, {
            avId: avId,
            deletedRowIds: rowIds,
            deletedRowInfos: reduceAvRowData(checkResult, columnsInfo)
        }, "deleteDatabaseRow", data, TASK_STATUS.PENDING);
        return createSuccessResponse("The request has been submitted and is pending user approval. Please remind the user to go to \"MCP Update Operation History\" (for Chinese User: \"MCP 修改操作记录\") for manual approval.");
    }
}

async function addDatabaseColumnHandler(params, extra) {
    let { avId, columnName, columnType, previousColumnId = "" } = params;
    
    const columnId = generateBlockId();
    // 获取列信息，然后如果为空，columnId设置为最后一个
    if (!isValidStr(previousColumnId)) {
        const columnsInfo = await getAttributeViewKeysByAvID(avId);
        if (columnsInfo.length > 0) {
            const lastColumn = columnsInfo[columnsInfo.length - 1];
            previousColumnId = lastColumn.id;
        }
    }
    
    const response = await addAttributeViewKey(avId, columnId, columnName, columnType, "", previousColumnId);
    return createJsonResponse({
        "isSuccess": true,
        "columnId": columnId
    });
}

async function updateDatabaseColumnHandler(params, extra) {
    
}

async function deleteDatabaseColumnHandler(params, extra) {
    const { avId, columnId } = params;

    const data = {
        avId,
        columnId,
    }
    if (!isValidIdFormat(avId) || !isValidIdFormat(columnId)) {
        return createErrorResponse("Invalid avId or columnId format. Must be a 14-digit timestamp(yyyyMMddHHmmss) followed by a 7-char alphanumeric suffix. Example: '20260414211243-1a2b3c4'");
    }
    const plugin = getPluginInstance();
    const autoApproveDeleteChange = plugin?.mySettings["autoApproveDeleteChange"] ?? false;
    if (autoApproveDeleteChange) {
        const response = await removeAttributeViewKey(avId, columnId, false);
        taskManager.insert(avId, data, "deleteDatabaseColumn", data, TASK_STATUS.APPROVED);
        return createSuccessResponse("Block updated successfully.");
    } else {
        const blockIds = await getDatabaseBlockId(avId);
        if (blockIds == null || blockIds.length === 0) {
            return createErrorResponse("Failed to find the database block for the given avId");
        }
        taskManager.insert(blockIds[0], data, "deleteDatabaseColumn", data, TASK_STATUS.PENDING);
        return createSuccessResponse("The request has been submitted and is pending user approval. Please remind the user to go to \"MCP Update Operation History\" (for Chinese User: \"MCP 修改操作记录\") for manual approval.");
    }
}

async function getAttributeViewLocatedBlockIdHandler(params, extra) {
    const { avId } = params;
    if (!isValidIdFormat(avId)) {
        return createErrorResponse("Invalid avId format");
    }
    const blockIds = await getDatabaseBlockId(avId);

    return createJsonResponse({
        blockIds: blockIds,
    });
}


