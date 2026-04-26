interface QueueDocIdItem {
    id: string;
}

interface SimplifiedAttributeViewRowData {
    id: string;
    isDetach: boolean;
    bindBlockId: string;
    columns: {
        [key: string]: any;
    }
}

interface AVCellValueDto {
    "cellID": string,
    "keyID": string,
    "rowID": string,
    "valueType": string,
    "value": any,
    "isPrimaryKey": boolean,
    "bindBlockId": string | undefined
}

type RowColumnDataMSelectVO = string[];

interface RowColumnDataDateVO {
    startDate: string; // yyyy-MM-dd HH:mm:ss
    endDate?: string; // yyyy-MM-dd HH:mm:ss
    isNotTime?: boolean;
}

interface RowColumnDataBlockVo {
    content: string;
    bindBlockId: string | undefined;
}

type RowColumnDataValueVo = boolean | string | number | RowColumnDataMSelectVO | RowColumnDataDateVO | RowColumnDataBlockVo | null;

interface RowColumnDataVo {
    keyName: string;
    type?: string;
    keyId?: string;
    value: RowColumnDataValueVo;
}


type PermissionSettings = {[key: string]: number};