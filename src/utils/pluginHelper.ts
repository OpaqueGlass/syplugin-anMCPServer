import { Plugin } from "siyuan";

let pluginInstance: Plugin = null;

export function setPluginInstance(instance:Plugin) {
    pluginInstance = instance;
}
export function getPluginInstance(): any {
    return pluginInstance;
}