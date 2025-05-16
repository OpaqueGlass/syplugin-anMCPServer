import { IObject, ISiyuan } from "siyuan";
declare global {
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
}