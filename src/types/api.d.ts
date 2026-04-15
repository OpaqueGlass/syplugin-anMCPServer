interface IFile {
    icon: string;
    name1: string;
    alias: string;
    memo: string;
    bookmark: string;
    path: string;
    name: string;
    hMtime: string;
    hCtime: string;
    hSize: string;
    dueFlashcardCount?: string;
    newFlashcardCount?: string;
    flashcardCount?: string;
    id: string;
    count: number;
    subFileCount: number;
}

interface SqlResult {
    alias: string;
    box: string;
    content: string;
    created: string;
    fcontent: string;
    hash: string;
    hpath: string;
    ial: string;
    id: string;
    length: number;
    markdown: string;
    memo: string;
    name: string;
    parent_id: string;
    path: string;
    root_id: string;
    sort: number;
    subtype: SqlBlockSubType;
    tag: string;
    type: SqlBlockType;
    updated: string;
}

type SqlBlockType = "d" | "p" | "h" | "l" | "i" | "b" | "html" | "widget" | "tb" | "c" | "s" | "t" | "iframe" | "av" | "m" | "query_embed" | "video" | "audio";

type SqlBlockSubType = "o" | "u" | "t" | "" |"h1" | "h2" | "h3" | "h4" | "h5" | "h6" 


interface BlockTypeFilter {
    audioBlock: boolean;
    blockquote: boolean;
    codeBlock: boolean;
    databaseBlock: boolean;
    document: boolean;
    embedBlock: boolean;
    heading: boolean;
    htmlBlock: boolean;
    iframeBlock: boolean;
    list: boolean;
    listItem: boolean;
    mathBlock: boolean;
    paragraph: boolean;
    superBlock: boolean;
    table: boolean;
    videoBlock: boolean;
    widgetBlock: boolean;
}

interface FullTextSearchQuery {
    query: string;
    method?: number;
    types?: BlockTypeFilter;
    paths?: string[];
    groupBy?: number;
    orderBy?: number;
    page?: number;
    reqId?: number;
    pageSize?: number;
}


interface ExportMdContentBody {
    id: string,
    refMode: number,
    // 内容块引用导出模式
	//   2：锚文本块链
	//   3：仅锚文本
	//   4：块引转脚注+锚点哈希
	//  （5：锚点哈希 https://github.com/siyuan-note/siyuan/issues/10265 已经废弃 https://github.com/siyuan-note/siyuan/issues/13331）
	//  （0：使用原始文本，1：使用 Blockquote，都已经废弃 https://github.com/siyuan-note/siyuan/issues/3155）
    embedMode: number,
    // 内容块引用导出模式，0：使用原始文本，1：使用 Blockquote
    yfm: boolean,
    // Markdown 导出时是否添加 YAML Front Matter
}


interface RenderAttributeViewBody {
    id: string; // 数据库id 
    blockID?: string; // 数据库所在块id
    viewID?: string; // 视图id
    page?: number;
    pageSize?: number;
    query?: string;
    groupPaging?: any; //组分页逻辑
    createIfNotExist?: boolean; // 默认为true
}
/**
 * 视图列定义
 */
interface ViewColumn {
  id: string;
  name: string;
  /** 类型，如 'block', 'select' 等 */
  type: string;
  icon: string;
  wrap: boolean;
  hidden: boolean;
  desc: string;
  calc: any | null;
  numberFormat: string;
  template: string;
  pin: boolean;
  width: string | number;
}

/**
 * 视图配置详情
 */
interface ViewConfig {
  id: string;
  name: string;
  type: string;
  desc: string;
  icon: string;
  pageSize: number;
  hideAttrViewName: boolean;
}

type AVViewType = 'table' | 'gallery' | 'kanban';

/**
 * 完整视图数据模型
 */
interface AttributeViewRenderResult {
  id: string;
  name: string;
  isMirror: boolean;
  viewID: string;
  viewType: AVViewType;
  
  /** 当前视图的具体展示配置与数据 */
  view: ViewConfig & {
    filters: any[];
    sorts: any[];
    group: any | null;
    showIcon: boolean;
    wrapField: boolean;
    groupFolded: boolean;
    groupHidden: number;
    columns: ViewColumn[];
    rows: any[];
    rowCount: number;
  };

  /** 关联的所有视图列表 */
  views: ViewConfig[];
}


/**
 * 基础行结构
 */
interface DataRow {
  id: string;
  cells: DataCell[];
}

/**
 * 单元格结构
 */
interface DataCell {
  id: string;
  value: CellValue;
  valueType: CellType;
  color: string;
  bgColor: string; // 只能取 1~14
}

/**
 * 支持的单元格类型
 */
type CellType = 
  | "block" 
  | "select" 
  | "mSelect" 
  | "number" 
  | "date" 
  | "mAsset" 
  | "checkbox" 
  | "url" 
  | "email" 
  | "text"
  | "rollup" 
  | "relation";

/**
 * 单元格 Value 的联合类型
 */
interface BaseCellValue {
  id: string;
  keyID: string;
  blockID: string;
  type: CellType;
  createdAt: number;
  updatedAt: number;
}

// 具体类型定义
interface BlockValue extends BaseCellValue {
  type: "block";
  isDetached: boolean;
  block: {
    content: string;
    created: number;
    updated: number;
  };
}


// 用于设置
interface SetterValueBlock {
    block: {
        content: string;
    }
}

interface SelectValue extends BaseCellValue {
  type: "select" | "mSelect";
  mSelect?: Array<{
    content: string;
    color: string;
  }>;
}

interface SetterValueSelect {
    mSelect: Array<{
        content: string;
        color?: string;
    }>;
}

interface NumberValue extends BaseCellValue {
  type: "number";
  number: {
    content: number;
    isNotEmpty: boolean;
    format: string;
    formattedContent: string;
  };
}

interface SetterValueNumber {
    number: {
        content: number;
    }
}

interface DateValue extends BaseCellValue {
  type: "date";
  date: {
    content: number;
    isNotEmpty: boolean;
    hasEndDate: boolean;
    isNotTime: boolean;
    content2: number;
    isNotEmpty2: boolean;
    formattedContent: string;
  };
}

interface SetterValueDate {
    date: {
        content: number;
        isNotEmpty: boolean;
        isNotTime: boolean;
        hasEndDate: boolean;
        content2?: number;
        isNotEmpty2?: boolean;
    }
}

interface AssetValue extends BaseCellValue {
  type: "mAsset";
  mAsset?: Array<{
    type: string;
    name: string;
    content: string;
  }> | null;
}

interface CheckboxValue extends BaseCellValue {
  type: "checkbox";
  checkbox: {
    checked: boolean;
  };
}

interface SetterValueCheckbox {
    checkbox: {
        checked: boolean;
    }
}

interface TextContentValue extends BaseCellValue {
  type: "url" | "email" | "text";
  url?: { content: string };
  email?: { content: string };
  text?: { content: string };
}

interface SetterValueTextContent {
    url?: { content: string };
    email?: { content: string };
    text?: { content: string };
}


interface RollupValue extends BaseCellValue {
  type: "rollup";
  rollup: {
    contents: any[] | null; // 根据数据，这里可能是嵌套的 BaseCellValue 数组
  };
}

interface RelationValue extends BaseCellValue {
  type: "relation";
  relation: {
    blockIDs: string[] | null;
    contents: any[] | null;
  };
}

interface SetterValueRelation {
    relation: {
        blockIDs: string[] | null;
    }
}

/**
 * 最终 Value 组合
 */
type CellValue =
  | BlockValue
  | SelectValue
  | NumberValue
  | DateValue
  | AssetValue
  | CheckboxValue
  | TextContentValue
  | RollupValue
  | RelationValue;

/**
 * 顶层响应结构
 */
interface ApiResponse {
  rows: DataRow[];
}

interface AddAttributeViewBlocksBodySrcs {
    id: string;
    isDetached: boolean;
    content?: string;
    itemID?: string; // 行id
}

interface BatchAddAttributeViewBlockAttrsValue {
    keyID: string;
    itemID: string; // 行id
    value: BatchAddAttributeViewBlockAttrsValueValue;
}

type BatchAddAttributeViewBlockAttrsValueValue = SetterValueBlock | SetterValueSelect | SetterValueNumber | SetterValueDate | SetterValueCheckbox | SetterValueTextContent | SetterValueRelation;