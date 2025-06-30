import { z } from "zod";
import { createErrorResponse, createJsonResponse, createSuccessResponse } from "../utils/mcpResponse";
import { appendBlockAPI, createDailyNote, getBackLink2T, getChildBlocks, prependBlockAPI, queryAPI, removeBlockAPI } from "@/syapi";
import { McpToolsProvider } from "./baseToolProvider";
import { debugPush, logPush, warnPush } from "@/logger";
import { getBlockDBItem } from "@/syapi/custom";

export class RelationToolProvider extends McpToolsProvider<any> {
    async getTools(): Promise<McpTool<any>[]> {
        return [{
            name: "siyuan_get_doc_relationship",
            description: "Retrieve all documents or blocks that reference a specified document or block within the workspace. The result includes the referencing document's ID, name, notebook ID, and path. Useful for understanding backlinks and document relationships within the knowledge base.",
            schema: {
                id: z.string().describe("The ID of the target document or block. The notebook where the target resides must be open."),
            },
            handler: getDocBacklink,
            annotations: {
                title: "Get Note Relationship",
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
            }
        }]
    }
}

async function getDocBacklink(params, extra) {
    const {id} = params;
    const dbItem = await getBlockDBItem(id);
    if (dbItem == null) {
        return createErrorResponse("Invalid document or block ID. Please check if the ID exists and is correct.");
    }
    const backlinkResponse = await getBackLink2T(id, "3");
    debugPush("backlinkResponse", backlinkResponse);
    if (backlinkResponse.backlinks.length == 0) {
        return createSuccessResponse("No documents or blocks referencing the specified ID were found.");
    }
    const result = [];
    for (let i = 0; i < backlinkResponse.backlinks.length; i++) {
        const oneBacklinkItem = backlinkResponse.backlinks[i];
        if (oneBacklinkItem.nodeType === "NodeDocument") {
            let tempDocItem = {
                "name": oneBacklinkItem.name,
                "id": oneBacklinkItem.id,
                "notebookId": oneBacklinkItem.box,
                "hpath": oneBacklinkItem.hpath,
            };
            result.push(tempDocItem);
        }
    }
    return createJsonResponse(result);
}

