import { z } from "zod";
import { createJsonResponse } from "../utils/mcpResponse";
import { McpToolsProvider } from "./baseToolProvider";
import { lang } from "@/utils/lang";

export class TimeToolProvider extends McpToolsProvider<any> {
    async getTools(): Promise<McpTool<any>[]> {
        return [{
            name: "get_current_time",
            description: lang("tool_get_current_time"),
            schema: {},
            handler: getCurrentTimeHandler,
            title: lang("tool_title_get_current_time"),
            annotations: {
                readOnlyHint: true,
            }
        }];
    }
}

async function getCurrentTimeHandler(params, extra) {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const dayOfWeek = now.toLocaleString('en-US', { weekday: 'long' });

    const timeInfo = {
        iso: now.toISOString(),
        year: year,
        month: month,
        day: day,
        hour: hours,
        minute: minutes,
        second: seconds,
        dayOfWeek: dayOfWeek,
        formattedDate: `${year}-${month}-${day}`,
        formattedTime: `${hours}:${minutes}:${seconds}`,
        formattedDateTime: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`,
        timezoneOffset: now.getTimezoneOffset(),
        unixTimestamp: Math.floor(now.getTime() / 1000),
    };

    return createJsonResponse(timeInfo);
}
