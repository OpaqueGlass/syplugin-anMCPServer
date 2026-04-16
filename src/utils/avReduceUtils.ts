import { errorPush, logPush, warnPush } from "@/logger";
import { isValidStr } from "./commonCheck";
import { getBlockDBItem, isValidIdFormat } from "@/syapi/custom";

export function reduceAvRowData(avRowDatas, columns) {
    const columnIdMap = new Map();
    const columnNameSet = new Set();
    let columnNameConflict = false;
    columns.forEach(col => {
        columnIdMap.set(col.id, col);
        if (columnNameSet.has(col.name)) {
            columnNameConflict = true;
        } else {
            columnNameSet.add(col.name);
        }
    });
    return avRowDatas.map(row => {
        const simplifiedRow: SimplifiedAttributeViewRowData = {
            id: row.id,
            isDetach: row.isDetach,
            bindBlockId: row.cells[0]?.value?.blockID || undefined,
            columns: {}
        };
        row.cells.forEach(cell => {
            const col = columnIdMap.get(cell.value.keyID);
            if (col && ["lineNumber"].includes(cell.type) === false) { // lineNumber类型的列我们不返回，这个永远是从1开始的，并不是数据库中存储的值
                const cellValue = formatCellValueToDto(cell.value);
                if (columnNameConflict) {
                    simplifiedRow.columns[`${col.name}__${col.id}`] = {
                        "keyName": col.name,
                        "keyId": col.id,
                        "value": cellValue["value"]
                    };
                } else {
                    simplifiedRow.columns[col.name] = cellValue["value"];
                }
            }
        });
        return simplifiedRow;
    });
}


/**
 * 将单元格的.value字段对象格式化为AVCellValueDto类型
 * @param cellValue 每个单元格的.value字段对象
 * @returns 我们格式化后的结果
 */
export function formatCellValueToDto(cellValue): AVCellValueDto {
    const valueType = cellValue.type;
    let valueObjectKeyName = valueType;
    switch (valueType) {
        case "select": {
            valueObjectKeyName = "mSelect";
            break;
        }
        default: {
            valueObjectKeyName = valueType;
            break;
        }
    }
    let rawValue = cellValue[valueObjectKeyName];
    const result: AVCellValueDto = {
        "cellID": cellValue.id,
        "keyID": cellValue.keyID,
        "rowID": cellValue.blockID,
        "valueType": valueType,
        "value": undefined,
        "isPrimaryKey": false,
        "bindBlockId": undefined
    }
    if (rawValue === null || rawValue === undefined) {
        return result;
    }
    switch (valueType) {
        case "block": {
            result["isPrimaryKey"] = true;
            result["value"] = rawValue["content"];
            result["bindBlockId"] = cellValue.blockID;
            break;
        }
        case "date": {
            result["value"] = {
                startDate: rawValue["isNotEmpty"] ? formatDate(new Date(rawValue["content"]), rawValue["isNotTime"]) : undefined,
                endDate: rawValue["hasEndDate"] ? formatDate(new Date(rawValue["content2"]), rawValue["isNotTime"]) : undefined,
                isNotTime: rawValue["isNotTime"]
            };
            break;
        }
        case "select":
        case "mSelect": {
            result["value"] = rawValue["content"];
            break;
        }
        case "number": {
            result["value"] = rawValue["content"];
            break;
        }
        case "checkbox": {
            result["value"] = rawValue["checked"];
            break;
        }
        case "url":
        case "email":
        case "phone":
        case "text": {
            result["value"] = rawValue["content"];
            break;
        }
        case "mAsset": {
            result["value"] = rawValue;
            break;
        }
        case "rollup": {
            result["value"] = rawValue["contents"];
            break;
        }
        case "relation": 
        default: {
            result["value"] = rawValue["content"] ?? rawValue;
            break;
        }
    }
    return result;
}

export async function fromRowColumnDataVoListToUpdateAPIInfo(rowColumnDataVoList: RowColumnDataVo[], columns: ViewColumn[], rowId: string) {
    const columnIdMap = new Map();
    const columnNameMap = new Map();
    let columnNameConflict = false;
    columns.forEach(col => {
        columnIdMap.set(col.id, col);
        if (columnNameMap.has(col.name)) {
            columnNameConflict = true;
            let temp = columnNameMap.get(col.name);
            temp.append(col);
            columnNameMap.set(col.name, temp);
        } else {
            columnNameMap.set(col.name, [col]);
        }
    });
    const result = [];
    const wrongData = [];
    for (const rowColumnDataVo of rowColumnDataVoList) {
        logPush("Processing rowColumnDataVo", rowColumnDataVo);
        let keySchema = undefined;
        if (isValidStr(rowColumnDataVo.keyName)) {
            keySchema = columnNameMap.get(rowColumnDataVo.keyName);
            if (keySchema && keySchema.length > 1) {
                keySchema = keySchema.find(col => col.type === rowColumnDataVo.type || col.id === rowColumnDataVo.keyId);
            } else {
                keySchema = keySchema ? keySchema[0] : undefined;
            }
        } else if (isValidStr(rowColumnDataVo.keyId)) {
            keySchema = columnIdMap.get(rowColumnDataVo.keyId);
        }
        if (!keySchema) {
            wrongData.push({
                "inputColumnData": rowColumnDataVo,
                "error": "根据提供的列名称或列ID未找到对应的列字段定义"
            });
            continue;
        }
        try {
            const apiValue = await fromCellValueValueVoToAPIValue(rowColumnDataVo.value, keySchema);
            // updateAPIInfo  keyID  itemID  value
            // https://github.com/siyuan-note/siyuan/issues/15310#issuecomment-3079412833
            result.push({
                "keyID": keySchema.id,
                "itemID": rowId,
                "value": apiValue
            });
        } catch (e) {
            errorPush("Error converting cell value for column", keySchema, "with input", rowColumnDataVo, "Error details:", e);
            wrongData.push({
                "inputColumnData": rowColumnDataVo,
                "error": "按照数据库列类型进行格式转换时出现错误：" + e?.message + "。请检查输入值的格式是否符合字段类型要求。"
            });
            continue;
        }
    }
    return [result, wrongData];
}

export enum ConversionErrorType {
    INVALID_TYPE = 'INVALID_TYPE',       // 数据类型不匹配
    MISSING_REQUIRED = 'MISSING_REQUIRED', // 缺少必要字段
    INVALID_FORMAT = 'INVALID_FORMAT',   // 格式不正确（如 ID 格式）
    READ_ONLY_COLUMN = 'READ_ONLY_COLUMN', // 只读列（如 rollup）
    UNKNOWN_COLUMN = 'UNKNOWN_COLUMN'    // 未知列类型
}

export class CellValueConversionError extends Error {
    constructor(
        public type: ConversionErrorType,
        public message: string,
        public detail?: any
    ) {
        super(message);
        this.name = 'CellValueConversionError';
    }
}

/**
 * 将我们前端定义的RowColumnDataValueVo类型转换为API可以接受的Value格式
 * @param vo 
 * @param columnSchema 
 * @returns {[valueType]: {...}}
 */
export async function fromCellValueValueVoToAPIValue(vo: RowColumnDataValueVo, columnSchema: ViewColumn) {
    const columnType = columnSchema.type;
    let result = {
    }
    let valueObjectKeyName = columnType;
    let valueObject = {};
    switch (columnType) {
        case "block": {
            vo = vo as RowColumnDataBlockVo;
            if (!isValidStr(vo["content"])) {
                throw new CellValueConversionError(ConversionErrorType.INVALID_FORMAT, "该列为block类型，content字段不能为空");
            }
            if (isValidStr(vo.bindBlockId) && !isValidIdFormat(vo.bindBlockId)) {
                throw new CellValueConversionError(ConversionErrorType.INVALID_FORMAT, "bindBlockId字段格式不正确，必须为合法的ID格式");
            }
            if (await getBlockDBItem(vo.bindBlockId) == null) {
                throw new CellValueConversionError(ConversionErrorType.INVALID_FORMAT, `Target block with ID '${vo.bindBlockId}' does not exist. The provided bindBlockId must correspond to an existing block record in the database. No match found.`);
            }

            valueObject = {
                "content": vo.content,
                "blockID": vo.bindBlockId,
                "isDetached": isValidStr(vo.bindBlockId)
            }
            break;
        }
        case "date": {
            vo = vo as RowColumnDataDateVO;
            valueObject = {
                "content": 0,
                "isNotEmpty": false,
                "hasEndDate": false,
                "content2": 0,
                "isNotEmpty2": false,
                "isNotTime": vo.isNotTime ?? false,
                "formattedContent": ""
            }
            if (isValidStr(vo["startDate"])) {
                result["content"] = new Date(vo["startDate"]).getTime();
                result["isNotEmplty"] = true;
            } else {
                throw new CellValueConversionError(ConversionErrorType.INVALID_FORMAT, "该列为date类型，startDate字段不能为空");
            }
            if (isValidStr(vo["endDate"])) {
                result["hasEndDate"] = true;
                result["content2"] = new Date(vo["endDate"]).getTime();
                result["isNotEmplty2"] = true;
            }
            break;
        }
        case "select":
        case "mSelect": {
            valueObjectKeyName = "mSelect";
            vo = vo as RowColumnDataMSelectVO;
            if (vo instanceof Array) {
                valueObject = vo.map(item => ({
                    "content": item,
                    // 我们先忽略color这个应该是和option相关的，我觉得不填写也行？
                }));
            } else {
                throw new CellValueConversionError(ConversionErrorType.INVALID_FORMAT, "该列为select或mSelect类型，值应该为字符串数组");
            }
            break;
        }
        case "number": {
            if (typeof vo !== "number") {
                throw new CellValueConversionError(ConversionErrorType.INVALID_TYPE, "该列为number类型，值应该为数字");
            }
            valueObject = {
                "content": vo as number,
                "isNotEmpty": vo !== null,
            }
            break;
        }
        case "checkbox": {
            if (typeof vo !== "boolean") {
                throw new CellValueConversionError(ConversionErrorType.INVALID_TYPE, "该列为checkbox类型，值应该为布尔值");
            }
            valueObject = {
                "checked": vo as boolean
            }
            break;
        }
        case "url":
        case "email":
        case "phone":
        case "text": {
            if (typeof vo !== "string") {
                throw new CellValueConversionError(ConversionErrorType.INVALID_TYPE, `该列为文本类型（${columnType}），值应该为字符串`);
            }
            valueObject = {
                "content": vo as string
            }
            break;
        }
        case "relation": {
            if (vo instanceof Array) {
                for (let item of vo) {
                    if (!isValidIdFormat(item)) {
                        throw new CellValueConversionError(ConversionErrorType.INVALID_FORMAT, "该列为relation类型，值应该为字符串数组，且每个字符串应该为合法的ID格式");
                    }
                }
                valueObject = {
                    "blockID": vo as string[]
                }
            } else {
                throw new CellValueConversionError(ConversionErrorType.INVALID_FORMAT, "该列为relation类型，值应该为字符串数组，且每个字符串为关联到的数据库中存在的行id");
            }
            break;
        }
        case "rollup":  {
            throw new CellValueConversionError(ConversionErrorType.INVALID_FORMAT, "rollup列不能够单独调整，需要修改列schema");
        }
        default: {
            warnPush("遇到未知的列类型，无法转换，请@开发者处理此问题", columnType);
            throw new CellValueConversionError(ConversionErrorType.UNKNOWN_COLUMN, "遇到未知的列类型，无法转换");
        }
    }
    result[valueObjectKeyName] = valueObject;
    return result;
}

export function fromColumnNameToId(columnName, columnType, columns) {
    const column = columns.find(col => col.name === columnName && col.type === columnType);
    return column ? column.id : undefined;
}

function formatDate(date, isNotTime = false) {
    const y = date.getFullYear();
    const M = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    
    if (isNotTime) {
        return `${y}-${M}-${d}`;
    }
    return `${y}-${M}-${d} ${h}:${m}:${s}`;
}