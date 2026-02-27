import {
    Plugin,
    getFrontend,
    Custom,
    Setting,
    showMessage,
    Dialog,
    openTab
} from "siyuan";
import "./index.scss";
import MyMCPServer from "./server";
import { setPluginInstance } from "./utils/pluginHelper";
import { infoPush, isDebugMode, logPush } from "./logger";
import { lang, setLanguage } from "./utils/lang";
import { CONSTANTS } from "./constants";
import { isAuthCodeSetted, isValidAuthCode, isValidStr } from "./utils/commonCheck";
import { calculateSHA256, encryptAuthCode } from "./utils/crypto";
import EventHandler from "./utils/eventHandler";
import { setIndexProvider } from "./utils/indexerHelper";
import { MyIndexProvider } from "./indexer/myProvider";
import { generateUUID, getFormattedTimestr } from "./utils/common";
import { createApp } from "vue";
import historyVue from "./components/history.vue";
import ElementPlus from 'element-plus';
import { ConnectionLogger } from "./logger/connectionLogger";

let STORAGE_NAME = CONSTANTS.STORAGE_NAME;

const DEFAULT_SETTING = {
    port: "16806",
    autoStart: false,
    readOnly: "allow_all", // "allow_all", "allow_non_destructive", "deny_all"
    authCode: CONSTANTS.CODE_UNSET,
    ragBaseUrl: undefined,
    autoApproveLocalChange: false, // 是否自动批准原地更改
    filterDocuments: "",   // 多行文本，每行一个文档 id
    filterNotebooks: "",   // 多行文本，每行一个笔记本 id
}

export default class OGanMCPServerPlugin extends Plugin {

    private custom: () => Custom;
    private isMobile: boolean;
    private myMCPServer: MyMCPServer = null;
    public mySettings = DEFAULT_SETTING;
    private eventHandler = null;
    private historyPage = null;
    private _historyVueApp = null;
    public connectionLogger: ConnectionLogger = null;
    onload() {
        setLanguage(this.i18n);
        setPluginInstance(this);
        this.connectionLogger = new ConnectionLogger(getFormattedTimestr());
        this.myMCPServer = new MyMCPServer();
        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
        this.eventHandler = new EventHandler();
        this.addIcons(`<symbol id="iconMessageQ" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle-question-mark-icon lucide-message-circle-question-mark"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></symbol>`)
//         const statusIconTemp = document.createElement("template");
//         statusIconTemp.innerHTML = `<div class="toolbar__item ariaLabel" aria-label="Remove plugin-sample Data">
//     <svg>
//         <use xlink:href="#iconTrashcan"></use>
//     </svg>
// </div>`;
//         statusIconTemp.content.firstElementChild.addEventListener("click", () => {
//             confirm("⚠️", this.i18n.confirmRemove.replace("${name}", this.name), () => {
//                 this.removeData(STORAGE_NAME).then(() => {
//                     this.mySettings = {readonlyText: "Readonly"};
//                     showMessage(`[${this.name}]: ${this.i18n.removedData}`);
//                 });
//             });
//         });

//         this.addStatusBar({
//             element: statusIconTemp.content.firstElementChild as HTMLElement,
//         });
        // this.addTopBar({
        //     "icon": "iconSetting",
        //     "title": "测试MCP",
        //     "callback": async ()=>{
        //         let searchToolProvider = new SearchToolProvider();
        //         let tools = await searchToolProvider.getTools();
        //         let response = await tools[0].handler({"query": "docker", "includingCodeBlock": true, "includingDatabase": true}, {});
        //         logPush("search", response);
        //     }
        // });
        const portInputElem = document.createElement("input");
        const ragBaseUrlInputElem = document.createElement("input");
        const authInputElem = document.createElement("input");
        const autoStartSwitchElem = document.createElement("input");
        const readOnlySelectElem = document.createElement("select");
        const autoApproveLocalChangeSwitchElem = document.createElement("input");
        const filterDocTextareaElem = document.createElement("textarea");
        const filterNotebookTextareaElem = document.createElement("textarea");
        
        this.setting = new Setting({
            confirmCallback: async () => {
                let myAuthCode = authInputElem.value;
                if (isValidStr(myAuthCode)) {
                    if (isValidAuthCode(myAuthCode)) {
                        myAuthCode = await encryptAuthCode(myAuthCode);
                    } else if (myAuthCode != CONSTANTS.CODE_UNSET) {
                        showMessage(lang("code_warning"));
                        myAuthCode = this.mySettings["authCode"];
                    }
                } else {
                    myAuthCode = this.mySettings["authCode"];
                    if (!isValidStr(myAuthCode)) {
                        myAuthCode = CONSTANTS.CODE_UNSET;
                    }
                }
                const filterDocumentsValue = filterDocTextareaElem.value ? filterDocTextareaElem.value.trim() : "";
                const filterNotebooksValue = filterNotebookTextareaElem.value ? filterNotebookTextareaElem.value.trim() : "";

                this.mySettings = {
                    autoStart: autoStartSwitchElem.checked,
                    port: portInputElem.value,
                    authCode: myAuthCode,
                    ragBaseUrl: ragBaseUrlInputElem.value,
                    readOnly: readOnlySelectElem.value,
                    autoApproveLocalChange: autoApproveLocalChangeSwitchElem.checked,
                    filterDocuments: filterDocumentsValue,
                    filterNotebooks: filterNotebooksValue,
                };
                this.saveData(CONSTANTS.STORAGE_NAME + window.siyuan.config.system.id.substring(30, 36), this.mySettings);
            }
        });
        
        this.setting.addItem({
            title: lang("setting_port"),
            direction: "column",
            description: lang("setting_port_desp"),
            createActionElement: () => {
                portInputElem.className = "b3-text-field fn__flex-center fn__size200";
                portInputElem.type = "number";
                portInputElem.max = "65535";
                portInputElem.min = "1";
                portInputElem.placeholder = "Port Number";
                portInputElem.value = this.mySettings.port.toString();
                portInputElem.addEventListener("change", ()=>{
                    this.mySettings['port'] = portInputElem.value;
                });
                return portInputElem;
            },
        });

        this.setting.addItem({
            title: lang("setting_auth"),
            direction: "column",
            description: lang("setting_auth_desp"),
            createActionElement: () => {
                authInputElem.className = "b3-text-field fn__flex-center fn__size200";
                authInputElem.type = "text";
                authInputElem.placeholder = isAuthCodeSetted(this.mySettings["authCode"]) ? lang("code_encrypted") : "";
                authInputElem.value = isValidAuthCode(this.mySettings["authCode"]) ? "" : CONSTANTS.CODE_UNSET;
                return authInputElem;
            },
        });
        

        this.setting.addItem({
            title: lang("setting_autoStart"),
            direction: "column",
            description: lang("setting_autoStart_desp"),
            createActionElement: () => {
                autoStartSwitchElem.className = "b3-switch fn__flex-center";
                autoStartSwitchElem.type = "checkbox";
                autoStartSwitchElem.checked = this.mySettings.autoStart || false;
                // autoStartSwitchElem.addEventListener("change", () => {
                //     this.saveData(STORAGE_NAME, { autoStart: autoStartSwitchElem.checked });
                // });
                return autoStartSwitchElem;
            },
        });

        this.setting.addItem({
            title: lang("setting_readOnly"),
            direction: "column",
            description: lang("setting_readOnly_desp"),
            createActionElement: () => {
                readOnlySelectElem.className = "b3-select fn__flex-center fn__size200";
                readOnlySelectElem.innerHTML = `
                    <option value="allow_all">${lang("setting_readOnly_allow_all")}</option>
                    <option value="allow_non_destructive">${lang("setting_readOnly_allow_non_destructive")}</option>
                    <option value="deny_all">${lang("setting_readOnly_deny_all")}</option>
                `;
                readOnlySelectElem.value = this.mySettings.readOnly || "allow_all";
                return readOnlySelectElem;
            },
        });

        
        this.setting.addItem({
            title: lang("setting_autoApproveLocalChange"),
            direction: "column",
            description: lang("setting_autoApproveLocalChange_desp"),
            createActionElement: () => {
                autoApproveLocalChangeSwitchElem.className = "b3-switch fn__flex-center";
                autoApproveLocalChangeSwitchElem.type = "checkbox";
                autoApproveLocalChangeSwitchElem.checked = this.mySettings.autoApproveLocalChange || false;
                return autoApproveLocalChangeSwitchElem;
            },
        });

        this.setting.addItem({
            title: lang("setting_rag_baseurl"),
            direction: "column",
            description: lang("setting_rag_baseurl_desp"),
            createActionElement: () => {
                ragBaseUrlInputElem.className = "b3-text-field fn__flex-center fn__size200";
                ragBaseUrlInputElem.type = "text";
                ragBaseUrlInputElem.placeholder = "http://127.0.0.1:26806";
                ragBaseUrlInputElem.value = this.mySettings.ragBaseUrl ?? "";
                ragBaseUrlInputElem.addEventListener("change", ()=>{
                    this.mySettings['ragBaseUrl'] = ragBaseUrlInputElem.value;
                });
                return ragBaseUrlInputElem;
            },
        });


        this.setting.addItem({
            title: lang("setting_control"),
            direction: "column",
            description: lang("setting_control_desp"),
            createActionElement: () => {
                const startStopBtnElem = document.createElement("button");
                startStopBtnElem.className = "b3-button b3-button--outline fn__flex-center fn__size200";
                startStopBtnElem.textContent = this.myMCPServer.isRunning() ? lang("setting_control_stop") : lang("setting_control_start");
                startStopBtnElem.addEventListener("click", () => {
                    if (this.myMCPServer.isRunning()) {
                        this.myMCPServer.stop();
                        startStopBtnElem.textContent = lang("setting_control_start");
                    } else {
                        this.myMCPServer.start();
                        startStopBtnElem.textContent = lang("setting_control_stop");
                    }
                });
                return startStopBtnElem;
            },
        });

        // this.setting.addItem({
        //     title: lang("setting_auth"),
        //     direction: "column",
        //     description: lang("setting_auth_desp"),
        //     createActionElement: () => {
        //         authInputElem.className = "b3-text-field fn__flex-center fn__size200";
        //         authInputElem.type = "text";
        //         authInputElem.placeholder = isAuthCodeSetted(this.mySettings["authCode"]) ? lang("code_encrypted") : "";
        //         authInputElem.value = isValidAuthCode(this.mySettings["authCode"]) ? "" : CONSTANTS.CODE_UNSET;
        //         return authInputElem;
        //     },
        // });

        this.setting.addItem({
            title: lang("setting_status"),
            direction: "row",
            description: lang("setting_status_desp"),
            createActionElement: () => {
                const container = document.createElement("div");
                container.className = "fn__flex-column";

                // Status text elements
                const statusTextElem = document.createElement("div");
                statusTextElem.className = "fn__flex-center";
                statusTextElem.textContent = this.myMCPServer.isRunning() ? lang("setting_status_open") : lang("setting_status_close");

                const connectionCountElem = document.createElement("div");
                connectionCountElem.className = "fn__flex-center";
                connectionCountElem.textContent = `${lang("setting_status_connection")}: ${this.myMCPServer.getConnectionCount() || 0}`;

                const portElem = document.createElement("div");
                portElem.className = "fn__flex-center";
                portElem.textContent = `${lang("setting_port")}: ${this.myMCPServer.workingPort || -1}`;

                // Refresh button
                const refreshBtnElem = document.createElement("button");
                refreshBtnElem.className = "b3-button b3-button--outline fn__flex-center fn__size200";
                refreshBtnElem.textContent = lang("setting_status_refresh");
                refreshBtnElem.addEventListener("click", () => {
                    // Update status and connection count
                    statusTextElem.textContent = this.myMCPServer.isRunning() ? lang("setting_status_open") : lang("setting_status_close");
                    connectionCountElem.textContent = `${lang("setting_status_connection")}: ${this.myMCPServer.getConnectionCount() || 0}`;
                    portElem.textContent = `${lang("setting_port")}: ${this.myMCPServer.workingPort || -1}`;
                });
                // Append elements to container
                container.appendChild(statusTextElem);
                if (isDebugMode()) {
                    container.appendChild(connectionCountElem);
                }
                container.appendChild(portElem);
                container.appendChild(refreshBtnElem);

                return container;
            },
        });
        

        // 新增：过滤文档（每行一个文档 id）
        this.setting.addItem({
            title: lang("setting_filterDocId"),
            direction: "row",
            description: lang("setting_filterDocId_desp"),
            createActionElement: () => {
                filterDocTextareaElem.className = "b3-text-field fn__block";
                filterDocTextareaElem.placeholder = "每行一个文档 id";
                filterDocTextareaElem.rows = 6;
                filterDocTextareaElem.value = this.mySettings.filterDocuments ?? "";
                filterDocTextareaElem.addEventListener("change", ()=>{
                    this.mySettings['filterDocuments'] = filterDocTextareaElem.value;
                });
                return filterDocTextareaElem;
            },
        });

        // 新增：过滤笔记本 id（每行一个笔记本 id）
        this.setting.addItem({
            title: lang("setting_filterNotebookId"),
            direction: "row",
            description: lang("setting_filterNotebookId_desp"),
            createActionElement: () => {
                filterNotebookTextareaElem.className = "b3-text-field fn__block";
                filterNotebookTextareaElem.placeholder = "每行一个笔记本 id";
                filterNotebookTextareaElem.rows = 6;
                filterNotebookTextareaElem.value = this.mySettings.filterNotebooks ?? "";
                filterNotebookTextareaElem.addEventListener("change", ()=>{
                    this.mySettings['filterNotebooks'] = filterNotebookTextareaElem.value;
                });
                return filterNotebookTextareaElem;
            },
        });
        this.setting.addItem({
            title: lang("setting_copyright"),
            direction: "column",
            description: lang("setting_copyright_desp"),
            createActionElement: () => {
                const copyrightElem = document.createElement("div");
                copyrightElem.className = "fn__flex-center";
                copyrightElem.textContent = "";
                return copyrightElem;
            },
        });

        let that = this;
        this.historyPage = this.addTab({
            type: "og_history_page",
            init() {
                infoPush("Loading");
                // 创建 shadowRoot
                const shadowHost = document.createElement("div");
                shadowHost.style.height = "100%";
                shadowHost.style.margin = "30px 30px";
                this.element.appendChild(shadowHost);
                const shadowRoot = shadowHost.attachShadow({ mode: "open" });
                // 创建挂载点
                const container = document.createElement("div");
                container.id = "og-history-vue-root";
                shadowRoot.appendChild(container);
                // 注入 element-plus 样式
                const styleElem = document.createElement("style");
                fetch("/plugins/syplugin-anMCPServer/static/element-plus.css")
                  .then(res => res.text())
                  .then(css => { styleElem.textContent = css.replace(":root", ":host"); });
                shadowRoot.prepend(styleElem);
                // 挂载 Vue
                that._historyVueApp = createApp(historyVue);
                that._historyVueApp.use(ElementPlus);
                that._historyVueApp.mount(container);
            },
            destroy() {
                if (that._historyVueApp) {
                    that._historyVueApp.unmount();
                    that._historyVueApp = null;
                }
            }
        });

        this.addCommand({
            langKey: "shortcut_history",
            hotkey: "",
            callback: () => {
                infoPush(this.name)
                openTab({
                    app: this.app,
                    custom: {
                        icon: "iconHistory",
                        title: lang("tab_title_history"),
                        id: this.name + "og_history_page",
                    },
                });
            }
        });
        this.addTopBar({
            "icon": "iconMessageQ",
            "title": lang("tab_title_history"),
            "callback": async ()=>{
                infoPush(this.name)
                openTab({
                    app: this.app,
                    custom: {
                        icon: "iconHistory",
                        title: lang("tab_title_history"),
                        id: this.name + "og_history_page",
                    },
                });
            }
        });
    }

    onLayoutReady() {
        const name = CONSTANTS.STORAGE_NAME + window.siyuan.config.system.id.substring(30, 36);
        this.loadData(name).then(()=>{
            this.mySettings = Object.assign({}, DEFAULT_SETTING, this.data[name]);
            logPush("this.data", this.mySettings);
            this.myMCPServer.initialize();
            this.eventHandler.bindHandler();
            setIndexProvider(new MyIndexProvider(this.data["ragBaseUrl"], this.data["ragAuthKey"]));
            this.myMCPServer.loadTools().then(()=>{
                if (this.mySettings["autoStart"]) {
                    this.myMCPServer.start();
                }
            });
        })
    }

    onunload() {
        this.myMCPServer.stop();
    }

    uninstall() {
        this.myMCPServer.stop();
    }

    /* 自定义设置
    openSetting() {
        const dialog = new Dialog({
            title: this.name,
            content: `<div class="b3-dialog__content"><textarea class="b3-text-field fn__block" placeholder="readonly text in the menu"></textarea></div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${this.i18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${this.i18n.save}</button>
</div>`,
            width: this.isMobile ? "92vw" : "520px",
        });
        const inputElement = dialog.element.querySelector("textarea");
        inputElement.value = this.mySettings.readonlyText;
        const btnsElement = dialog.element.querySelectorAll(".b3-button");
        dialog.bindInput(inputElement, () => {
            (btnsElement[1] as HTMLButtonElement).click();
        });
        inputElement.focus();
        btnsElement[0].addEventListener("click", () => {
            dialog.destroy();
        });
        btnsElement[1].addEventListener("click", () => {
            this.saveData(STORAGE_NAME, {readonlyText: inputElement.value});
            dialog.destroy();
        });
    }*/

}
