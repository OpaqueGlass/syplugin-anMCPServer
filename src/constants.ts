export class CONSTANTS {
    public static readonly STORAGE_NAME: string = "setting.json";
    public static readonly CODE_UNSET: string = "N/A";
    public static readonly DATA_CHANGEABLE_COLUMN_TYPES: string[] = ["text", "number", "select", "mSelect", "date", "checkbox", "relation", "url", "email", "created", "updated", "lineNumber", "mAsset", "phone"];
    public static readonly ALL_COLUMN_TYPES: string[] = ["text", "number", "select", "mSelect", "date", "checkbox", "relation", "url", "email", "rollup", "template", "created", "updated", "lineNumber", "mAsset", "phone"];
    public static readonly PLUGIN_DATA_SAVEPATH: string = "/data/storage/petal/syplugin-anMCPServer/";
    public static readonly VERSION_CODE: number = 2026042601;
}

export enum PermissionBit {
    Read = 4,
    Write = 2,
    Destructive = 1
}

// 插件设置默认值（插件入口与 CLI 入口共用）
export const DEFAULT_SETTING = {
    address: "127.0.0.1",
    port: "16806",
    autoStart: false,
    readOnly: "allow_all", // "allow_all", "allow_non_destructive", "deny_all"
    authCode: CONSTANTS.CODE_UNSET,
    ragBaseUrl: undefined,
    autoApproveLocalChange: false, // 是否自动批准原地更改
    autoApproveDeleteChange: false, // 是否自动批准删除更改
    filterDocuments: "",   // 多行文本，每行一个文档 id
    filterNotebooks: "",   // 多行文本，每行一个笔记本 id
    allowedHosts: "",
    defaultPermission: 7, // 默认权限，0-7每个位代表不同权限，1=读，2=写，4=删除
    "@version": CONSTANTS.VERSION_CODE,
};