import { z } from "zod";
import { createErrorResponse, createJsonResponse, createSuccessResponse } from "../utils/mcpResponse";
import { appendBlockAPI, createDailyNote, queryAPI } from "@/syapi";
import { McpTool } from "@/types";
import { getPluginInstance } from "@/utils/pluginHelper";
import { isValidStr } from "@/utils/commonCheck";
import { lang } from "@/utils/lang";
import { McpToolsProvider } from "./baseToolProvider";

export class DailyNoteToolProvider extends McpToolsProvider<any> {
    
    async getTools(): Promise<McpTool<any>[]> {
        return [{
            name: "siyuan_append_to_dailynote",
            description: lang("tool_append_dailynote"),
            schema: {
                markdownContent: z.string().describe("The Markdown-formatted content to append to today's daily note."),
                notebookId: z.string().describe("The ID of the target notebook where the daily note is located. The notebook must not be in a closed state."),
            },
            handler: appendToDailynoteHandler,
            annotations: {
                title: "Append To Dailynote",
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
            }
        },{
            name: "siyuan_list_notebook",
            description: `List all notebooks in SiYuan and return their metadata.

        Each notebook is represented as an object with the following fields:

        - id (string): The unique identifier of the notebook.
        - name (string): The display name of the notebook.
        - icon (string): An emoji icon representing the notebook.
        - sort (number): Manual sort value; lower values appear earlier.
        - sortMode (number): The sorting mode used for this notebook.
        - closed (boolean): Whether the notebook is currently closed.
        - newFlashcardCount (number): Number of newly added flashcards in the notebook.
        - dueFlashcardCount (number): Number of flashcards that are due for review.
        - flashcardCount (number): Total number of flashcards in the notebook.`,
            schema: {},
            handler: listNotebookHandler,
            annotations: {
                title: "List notebook",
                readOnlyHint: true,
            }
        }]
    }
}

export const appendToDailynoteTool: McpTool<any> = {
    name: "siyuan_append_to_dailynote",
    description: lang("tool_append_dailynote"),
    schema: {
        markdownContent: z.string().describe("The Markdown-formatted content to append to today's daily note."),
        notebookId: z.string().describe("The ID of the target notebook where the daily note is located. The notebook must not be in a closed state."),
    },
    handler: appendToDailynoteHandler,
    annotations: {
        title: "Append To Dailynote",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
    }
}

async function appendToDailynoteHandler(params, extra) {
    const {notebookId, markdownContent} = params;
    // 确认dailynote id
    const id = await createDailyNote(notebookId, getPluginInstance().app.appId);
    // 追加写入
    let newBlockId = "";
    if (isValidStr(id)) {
        const result = await appendBlockAPI(markdownContent, id);
        if (result == null) {
            return createErrorResponse("Failed to append to dailynote");
        }
        newBlockId = result.id;
    } else {
        return createErrorResponse("Internal Error: failed to create dailynote");
    }
    return createSuccessResponse("Successfully created the dailynote, the block ID for the new content is " + newBlockId);
}

export const listNotebookTool: McpTool<any> = {
    name: "siyuan_list_notebook",
    description: `List all notebooks in SiYuan and return their metadata.

Each notebook is represented as an object with the following fields:

- id (string): The unique identifier of the notebook.
- name (string): The display name of the notebook.
- icon (string): An emoji icon representing the notebook.
- sort (number): Manual sort value; lower values appear earlier.
- sortMode (number): The sorting mode used for this notebook.
- closed (boolean): Whether the notebook is currently closed.
- newFlashcardCount (number): Number of newly added flashcards in the notebook.
- dueFlashcardCount (number): Number of flashcards that are due for review.
- flashcardCount (number): Total number of flashcards in the notebook.`,
    schema: {},
    handler: listNotebookHandler,
    annotations: {
        title: "List notebook",
        readOnlyHint: true,
    }
}

async function listNotebookHandler(params, extra) {
    return createJsonResponse(window?.siyuan?.notebooks);
}

