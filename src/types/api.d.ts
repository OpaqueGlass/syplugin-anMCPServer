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

export interface NotebookConf {
    box: string;
    conf: {
        name: string;
        sort: number;
        icon: string;
        closed: boolean;
        refCreateSaveBox: string;
        refCreateSavePath: string;
        docCreateSaveBox: string;
        docCreateSavePath: string;
        dailyNoteSavePath: string;
        dailyNoteTemplatePath: string;
        sortMode: number;
    };
    name: string;
}