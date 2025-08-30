import { z } from "zod";
import { createErrorResponse, createJsonResponse, createSuccessResponse } from "../utils/mcpResponse";
import { appendBlockAPI, createDailyNote, getChildBlocks, getNotebookConf, prependBlockAPI, queryAPI, removeBlockAPI, exportMdContent, getFileAPIv2 } from "@/syapi";
import { getPluginInstance } from "@/utils/pluginHelper";
import { isValidStr } from "@/utils/commonCheck";
import { lang } from "@/utils/lang";
import { McpToolsProvider } from "./baseToolProvider";
import { debugPush, logPush, warnPush, errorPush } from "@/logger";
import { getBlockAssets } from "@/syapi/custom";
import { blobToBase64Object } from "@/utils/common";

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
            description: `List all notebooks in SiYuan and return their metadata(such as id, open status, dailyNoteSavePath etc.).`,
            schema: {},
            handler: listNotebookHandler,
            annotations: {
                title: "List notebook",
                readOnlyHint: true,
            }
        }, {
            name: "siyuan_read_dailynote",
            description: "Read the content of a daily note for a specific date.",
            schema: {
                date: z.string().optional().describe("The date of the daily note in 'yyyyMMdd' format. If not provided, today's date will be used."),
                notebookId: z.string().optional().describe("The ID of the notebook to search for the daily note. If not provided, a random notebook will be chosen."),
            },
            handler: readDailynoteHandler,
            annotations: {
                title: "Read Daily Note",
                readOnlyHint: true,
            }
        }]
    }
}

async function readDailynoteHandler(params, extra) {
    let { date, notebookId } = params;

    if (!date) {
        const now = new Date();
        date = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
    }

    // 检查 notebookId 和 date 的合法性
    if (notebookId && !/^[a-zA-Z0-9\-]+$/.test(notebookId)) {
        return createErrorResponse("Invalid notebookId format.");
    }
    if (!/^\d{8}$/.test(date)) {
        return createErrorResponse("Invalid date format. Expected 'yyyyMMdd'.");
    }

    const boxCondition = notebookId ? `AND B.box = '${notebookId}'` : "";

    // 首先尝试通过 custom attribute 查询
    let sql = `SELECT B.id FROM blocks AS B JOIN attributes AS A ON B.id = A.block_id WHERE A.name = 'custom-dailynote-${date}' ${boxCondition} AND B.type = 'd' LIMIT 1`;
    let queryResult = await queryAPI(sql);

    // 如果找不到，则回退到通过文档标题查询
    if (!queryResult || queryResult.length === 0) {
        const formattedDate = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
        const boxCondition2 = notebookId ? `AND box = '${notebookId}'` : "";
        sql = `SELECT id FROM blocks WHERE content = '${formattedDate}' ${boxCondition2} AND type = 'd' LIMIT 1`;
        queryResult = await queryAPI(sql);
    }

    if (!queryResult || queryResult.length === 0) {
        const notebookInfo = notebookId ? ` in notebook ${notebookId}` : '';
        return createErrorResponse(`Daily note for date ${date} not found${notebookInfo}.`);
    }

    const docId = queryResult[0].id;
    
    let otherImg = [];
    try {
        otherImg = await getAssets(docId);
    } catch (error) {
        errorPush("Error converting assets to images", error);
    }

    const markdown = await exportMdContent({ id: docId, refMode: 4, embedMode: 1, yfm: false });
    const content = markdown["content"] || "";

    return createJsonResponse({
        content: content,
        docId: docId,
    }, otherImg);
}

async function getAssets(id:string) {
    const assetsInfo = await getBlockAssets(id);
    const assetsPathList = assetsInfo.map(item=>item.path);
    const assetsPromise = [];
    assetsPathList.forEach((pathItem)=>{
        if (isSupportedImageOrAudio(pathItem)) {
            assetsPromise.push(getFileAPIv2("/data/" + pathItem));
        }
    });
    const assetsBlobResult = await Promise.all(assetsPromise);
    const base64ObjPromise = [];
    let mediaLengthSum = 0;
    for (let blob of assetsBlobResult) {
        logPush("type", typeof blob, blob);
        if (blob.size / 1024 / 1024 > 2) {
            logPush("File too large, not returning", blob.size);
        } else if (mediaLengthSum / 1024 / 1024 > 5) {
            logPush("Total media size too large, not returning more content", mediaLengthSum);
            break;
        } else {
            mediaLengthSum += blob.size;
            base64ObjPromise.push(blobToBase64Object(blob));
        }
    }
    return await Promise.all(base64ObjPromise);
}

function isSupportedImageOrAudio(path) {
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'ico'];
    const audioExtensions = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'];

    const extMatch = path.match(/\.([a-zA-Z0-9]+)$/);
    if (!extMatch) return false;

    const ext = extMatch[1].toLowerCase();

    if (imageExtensions.includes(ext)) {
        return 'image';
    } else if (audioExtensions.includes(ext)) {
        return 'audio';
    } else {
        return false;
    }
}

async function appendToDailynoteHandler(params, extra) {
    const {notebookId, markdownContent} = params;
    debugPush("插入日记API被调用", params);
    // 确认dailynote id
    const id = await createDailyNote(notebookId, getPluginInstance().app.appId);
    // 追加写入
    let newBlockId = "";
    if (isValidStr(id)) {
        // query先执行，否则可能真更新数据库了
        const queryResult = await queryAPI(`SELECT * FROM blocks WHERE id = "${id}"`);
        const result = await appendBlockAPI(markdownContent, id);
        if (result == null) {
            return createErrorResponse("Failed to append to dailynote");
        }
        // 判断块个数，移除存在的唯一块
        if (queryResult && queryResult.length == 0) {
            try {
                const childList = await getChildBlocks(id);
                debugPush("貌似是新建日记，检查子块情况", childList);
                if (childList && childList.length >= 1 && childList[0].type == "p" && !isValidStr(childList[0]["markdown"])) {
                    debugPush("移除子块", childList[0]);
                    removeBlockAPI(childList[0].id);
                }
            } catch(err) {
                warnPush("err", err);
            }
        }
        newBlockId = result.id;
    } else {
        return createErrorResponse("Internal Error: failed to create dailynote");
    }
    return createSuccessResponse("Successfully created the dailynote, the block ID for the new content is " + newBlockId);
}

async function listNotebookHandler(params, extra) {
    const notebooks = window?.siyuan?.notebooks;
    if (!notebooks) {
        return createJsonResponse([]);
    }

    const augmentedNotebooks = await Promise.all(notebooks.map(async (notebook) => {
        try {
            const confData = await getNotebookConf(notebook.id);
            if (confData && confData.conf) {
                return {
                    ...notebook,
                    refCreateSaveBox: confData.conf.refCreateSaveBox,
                    refCreateSavePath: confData.conf.refCreateSavePath,
                    docCreateSaveBox: confData.conf.docCreateSaveBox,
                    docCreateSavePath: confData.conf.docCreateSavePath,
                    dailyNoteSavePath: confData.conf.dailyNoteSavePath,
                    dailyNoteTemplatePath: confData.conf.dailyNoteTemplatePath,
                };
            }
        } catch (error) {
            warnPush(`Failed to get conf for notebook ${notebook.id}`, error);
        }
        return notebook;
    }));

    return createJsonResponse(augmentedNotebooks);
}