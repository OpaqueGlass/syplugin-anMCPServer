export class CONSTANTS {
    public static readonly STORAGE_NAME: string = "setting.json";
    public static readonly CODE_UNSET: string = "N/A";
    public static readonly DATA_CHANGEABLE_COLUMN_TYPES: string[] = ["text", "number", "select", "mSelect", "date", "checkbox", "relation", "url", "email", "created", "updated", "lineNumber", "mAsset", "phone"];
    public static readonly ALL_COLUMN_TYPES: string[] = ["text", "number", "select", "mSelect", "date", "checkbox", "relation", "url", "email", "rollup", "template", "created", "updated", "lineNumber", "mAsset", "phone"];
    public static readonly PLUGIN_DATA_SAVEPATH: string = "/data/storage/petal/syplugin-anMCPServer/";
}

export enum PermissionBit {
    Read = 4,
    Write = 2,
    Destructive = 1
}