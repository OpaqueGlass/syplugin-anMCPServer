import {
    Plugin,
    getFrontend,
    Custom, exitSiYuan,
    Setting
} from "siyuan";
import "./index.scss";
import MyMCPServer from "./server";
import { setPluginInstance } from "./utils/pluginHelper";
import { logPush } from "./logger";
import { lang, setLanguage } from "./utils/lang";
import { CONSTANTS } from "./constants";
import { SearchToolProvider } from "./tools/search";

const STORAGE_NAME = CONSTANTS.STORAGE_NAME;

export default class OGaMCPServerPlugin extends Plugin {

    private custom: () => Custom;
    private isMobile: boolean;
    private myMCPServer: MyMCPServer = null;
    onload() {
        this.data[STORAGE_NAME] = {
            "port": 16806,
            "autoStart": false
        };
        setLanguage(this.i18n);
        setPluginInstance(this);
        this.myMCPServer = new MyMCPServer();
        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";

//         const statusIconTemp = document.createElement("template");
//         statusIconTemp.innerHTML = `<div class="toolbar__item ariaLabel" aria-label="Remove plugin-sample Data">
//     <svg>
//         <use xlink:href="#iconTrashcan"></use>
//     </svg>
// </div>`;
//         statusIconTemp.content.firstElementChild.addEventListener("click", () => {
//             confirm("⚠️", this.i18n.confirmRemove.replace("${name}", this.name), () => {
//                 this.removeData(STORAGE_NAME).then(() => {
//                     this.data[STORAGE_NAME] = {readonlyText: "Readonly"};
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
        const autoStartSwitchElem = document.createElement("input");
        autoStartSwitchElem.type = "checkbox";
        autoStartSwitchElem.checked = this.data[STORAGE_NAME].autoStart || false;
        this.setting = new Setting({
            confirmCallback: () => {
                this.saveData(STORAGE_NAME, {
                    autoStart: autoStartSwitchElem.checked,
                    port: portInputElem.value
                });
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
                portInputElem.placeholder = "Readonly text in the menu";
                portInputElem.value = this.data[STORAGE_NAME].port;
                portInputElem.addEventListener("change", ()=>{
                    this.data[STORAGE_NAME]['port'] = portInputElem.value;
                });
                return portInputElem;
            },
        });
        

        this.setting.addItem({
            title: lang("setting_autoStart"),
            direction: "column",
            description: lang("setting_autoStart_desp"),
            createActionElement: () => {
                autoStartSwitchElem.className = "b3-switch fn__flex-center";
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
        this.loadData(STORAGE_NAME).then(()=>{
            logPush("this.data", this.data[STORAGE_NAME]);
            this.myMCPServer.initialize();
            if (this.data[STORAGE_NAME]["autoStart"]) {
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
        inputElement.value = this.data[STORAGE_NAME].readonlyText;
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
