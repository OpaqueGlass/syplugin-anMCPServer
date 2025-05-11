import { IOperation, IProtyle } from "siyuan";

interface Window {
    echarts: {
        init(element: HTMLElement, theme?: string, options?: {
            width: number
        }): {
            setOption(option: any): void;
            getZr(): any;
            on(name: string, event: (e: any) => void): any;
            containPixel(name: string, position: number[]): any;
            resize(): void;
        };
        dispose(element: Element): void;
        getInstanceById(id: string): {
            resize: () => void
        };
    }
    ABCJS: {
        renderAbc(element: Element, text: string, options: {
            responsive: string
        }): void;
    }
    hljs: {
        listLanguages(): string[];
        highlight(text: string, options: {
            language?: string,
            ignoreIllegals: boolean
        }): {
            value: string
        };
        getLanguage(text: string): {
            name: string
        };
    };
    katex: {
        renderToString(math: string, option?: {
            displayMode?: boolean;
            output?: string;
            macros?: IObject;
            trust?: boolean;
            strict?: (errorCode: string) => "ignore" | "warn";
        }): string;
    }
    mermaid: {
        initialize(options: any): void,
        init(options: any, element: Element): void
    };
    plantumlEncoder: {
        encode(options: string): string,
    };
    pdfjsLib: any

    dataLayer: any[]

    siyuan: ISiyuan
    webkit: any
    html2canvas: (element: Element, opitons: {
        useCORS: boolean,
        scale?: number
    }) => Promise<any>;
    JSAndroid: {
        returnDesktop(): void
        openExternal(url: string): void
        changeStatusBarColor(color: string, mode: number): void
        writeClipboard(text: string): void
        writeImageClipboard(uri: string): void
        readClipboard(): string
        getBlockURL(): string
    }

    Protyle: any

    goBack(): void

    reconnectWebSocket(): void

    showKeyboardToolbar(height: number): void

    hideKeyboardToolbar(): void

    openFileByURL(URL: string): boolean

    destroyTheme(): Promise<void>
}

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

interface ISiyuan {
    zIndex: number
    storage?: {
        [key: string]: any
    },
    transactions?: {
        protyle: IProtyle,
        doOperations: IOperation[],
        undoOperations: IOperation[]
    }[]
    reqIds: {
        [key: string]: number
    },
    editorIsFullscreen?: boolean,
    hideBreadcrumb?: boolean,
    notebooks?: INotebook[],
    emojis?: IEmoji[],
    backStack?: IBackStack[],
    mobile?: {
        editor?: any
        popEditor?: any
        files?: any
    },
    user?: {
        userId: string
        userName: string
        userAvatarURL: string
        userHomeBImgURL: string
        userIntro: string
        userNickname: string
        userSiYuanOneTimePayStatus: number  // 0 未付费；1 已付费
        userSiYuanProExpireTime: number // -1 终身会员；0 普通用户；> 0 过期时间
        userSiYuanSubscriptionPlan: number // 0 年付订阅/终生；1 教育优惠；2 订阅试用
        userSiYuanSubscriptionType: number // 0 年付；1 终生；2 月付
        userSiYuanSubscriptionStatus: number // -1：未订阅，0：订阅可用，1：订阅封禁，2：订阅过期
        userToken: string
        userTitles: {
            name: string,
            icon: string,
            desc: string
        }[]
    },
    dragElement?: HTMLElement,
    layout?: {
        layout?: any,
        centerLayout?: any,
        leftDock?: any,
        rightDock?: any,
        bottomDock?: any,
    }
    config?: any;
    ws: any,
    ctrlIsPressed?: boolean,
    altIsPressed?: boolean,
    shiftIsPressed?: boolean,
    coordinates?: {
        pageX: number,
        pageY: number,
        clientX: number,
        clientY: number,
        screenX: number,
        screenY: number,
    },
    menus?: any,
    languages?: {
        [key: string]: any;
    }
    bookmarkLabel?: string[]
    blockPanels: any,
    dialogs: any,
    viewer?: any
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


export interface BlockTypeFilter {
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

export interface FullTextSearchQuery {
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
