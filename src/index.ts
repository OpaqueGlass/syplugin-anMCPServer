import {
    Plugin,
    getFrontend,
    Custom,
    Setting,
    showMessage
} from "siyuan";
import "./index.scss";
import MyMCPServer from "./server";
import { setPluginInstance } from "./utils/pluginHelper";
import { logPush } from "./logger";
import { lang, setLanguage } from "./utils/lang";
import { CONSTANTS } from "./constants";
import { isAuthCodeSetted, isValidAuthCode, isValidStr } from "./utils/commonCheck";
import { calculateSHA256, encryptAuthCode } from "./utils/crypto";
import EventHandler from "./utils/eventHandler";

let STORAGE_NAME = CONSTANTS.STORAGE_NAME;

const DEFAULT_SETTING = {
    "port": "16806",
    "autoStart": false,
    "authCode": CONSTANTS.CODE_UNSET,
}

export default class OGanMCPServerPlugin extends Plugin {

    private custom: () => Custom;
    private isMobile: boolean;
    private myMCPServer: MyMCPServer = null;
    public mySettings = DEFAULT_SETTING;
    private eventHandler = null;
    onload() {
        setLanguage(this.i18n);
        setPluginInstance(this);
        this.myMCPServer = new MyMCPServer();
        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
        this.eventHandler = new EventHandler();

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
        const authInputElem = document.createElement("input");
        const autoStartSwitchElem = document.createElement("input");
        
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
                this.mySettings = {
                    autoStart: autoStartSwitchElem.checked,
                    port: portInputElem.value,
                    authCode: myAuthCode,
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
                container.appendChild(connectionCountElem);
                container.appendChild(portElem);
                container.appendChild(refreshBtnElem);

                return container;
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
    }

    onLayoutReady() {
        const name = CONSTANTS.STORAGE_NAME + window.siyuan.config.system.id.substring(30, 36);
        this.loadData(name).then(()=>{
            this.mySettings = Object.assign(this.mySettings, this.data[name]);
            logPush("this.data", this.mySettings);
            this.myMCPServer.initialize();
            this.eventHandler.bindHandler();
            if (this.mySettings["autoStart"]) {
                this.myMCPServer.start();
            }
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
