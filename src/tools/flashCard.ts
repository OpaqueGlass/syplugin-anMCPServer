import { addRiffCards, getRiffDecks, queryAPI, removeRiffCards } from "@/syapi";
import { getBlockDBItem, isValidDeck, QUICK_DECK_ID } from "@/syapi/custom";
import { isValidStr } from "@/utils/commonCheck";
import { createErrorResponse, createJsonResponse, createSuccessResponse } from "@/utils/mcpResponse";
import { createNewDocWithParentId } from "./sharedFunction";
import { McpToolsProvider } from "./baseToolProvider";
import { z } from "zod";
import { useWsIndexQueue } from "@/utils/wsMainHelper";
import { TASK_STATUS, taskManager } from "@/utils/historyTaskHelper";
import { filterBlock } from "@/utils/filterCheck";

const TYPE_VALID_LIST = ["h1", "h2", "h3", "h4", "h5", "highlight", "superBlock"] as const;

export class FlashcardToolProvider extends McpToolsProvider<any> {
    async getTools(): Promise<McpTool<any>[]> {
        return [{
            name: "siyuan_create_flashcards_with_new_doc",
            description: "Create New Document, and Make Flashcards with Specific Method",
            schema: {
                parentId: z.string().describe("The ID of the parent document where the new document will be created."),
                docTitle: z.string().describe("The title of the new document that will contain the flashcards."),
                type: z.enum(TYPE_VALID_LIST).describe("The block type to use when formatting flashcards (e.g., heading or highlight)."),
                deckId: z.string().optional().describe("The ID of the flashcard deck to which the new content belongs."),
                markdownContent: z.string().describe("The Markdown-formatted content to append at the end of the new document."),
            },
            handler: addFlashCardMarkdown,
            title: "Create Flashcards with New Doc",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
            }
        },
        {
            name: "siyuan_create_flashcards",
            description: "Create flashcards from one or more block IDs.",
            schema: {
                blockIds: z.array(z.string()).describe("The IDs of the blocks to be converted into flashcards."),
                deckId: z.string().optional().describe("The ID of the deck to add the cards to. If not provided, a default deck will be used."),
            },
            handler: createFlashcardsHandler,
            title: "Create Flashcards",
            annotations: {
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
            }
        },
        {
            name: "siyuan_delete_flashcards",
            description: "Delete flashcards from a deck using their corresponding block IDs.",
            schema: {
                blockIds: z.array(z.string()).describe("The IDs of the blocks corresponding to the flashcards to be deleted."),
                deckId: z.string().optional().describe("The ID of the deck to remove the cards from. If not provided, a default deck will be used."),
            },
            handler: deleteFlashcardsHandler,
            title: "Delete Flashcards",
            annotations: {
                readOnlyHint: false,
                destructiveHint: true,
                idempotentHint: false,
            }
        }];
    }
}
async function addFlashCardMarkdown(params, extra) {
    let { parentId, docTitle, type, deckId, markdownContent } = params;
    let { sendNotification, _meta} = extra;
    
    if (await filterBlock(parentId, null)) {
        return createErrorResponse("The specified document or block is excluded by the user settings, so cannot create a new note under it.");
    }
    // 默认deck
    if (!isValidStr(deckId)) {
        deckId = QUICK_DECK_ID;
    }
    if (!await isValidDeck(deckId)) {
        return createErrorResponse("制卡失败：卡包DeckId不存在，如果用户没有明确指定卡包名称或ID，可以将参数deckId设置为\"\"");
    }
    if (type === "highlight" && !window.siyuan.config.editor.markdown.inlineMath) {
        return createErrorResponse("制卡失败：高亮内容制卡需要用户启用Markdown标记语法，请提醒用户开启此功能（设置-编辑器-Markdown行级标记语法）");
    }
    const {result, newDocId} = await createNewDocWithParentId(parentId, docTitle, markdownContent);
    if (result) {
        taskManager.insert(newDocId, markdownContent, "createNewNoteWithFlashCard", {}, TASK_STATUS.APPROVED);
    }
    if (result) {
        let progressInterval: any;
        if (_meta?.progressToken) {
            let currentProgress = 0;
            const maxDuration = 120 * 1000; // 2 minutes in ms
            const updateInterval = 200; // ms
            const progressIncrement = updateInterval / maxDuration;

            progressInterval = setInterval(() => {
                currentProgress += progressIncrement;
                if (currentProgress < 0.95) {
                    sendNotification({
                        method: "notifications/progress",
                        params: { progress: currentProgress, progressToken: _meta.progressToken }
                    });
                }
            }, updateInterval);
        }

        try {
            // 需要等待索引完成，自 https://github.com/siyuan-note/siyuan/issues/15390 更新后，此等待索引方式实际无效，变为sleep
            const addCardsResult = await useWsIndexQueue()?.enqueue(async ()=>{
                return await parseDocAddCards(newDocId, type, deckId);
            });
            
            if (_meta?.progressToken) {
                await sendNotification({
                    method: "notifications/progress",
                    params: { progress: 1, progressToken: _meta.progressToken }
                });
            }
            return createSuccessResponse(`成功添加了 ${addCardsResult} 张闪卡`);
        } finally {
            if (progressInterval) {
                clearInterval(progressInterval);
            }
        }
    } else {
        return createErrorResponse("制卡失败：创建闪卡文档时遇到未知问题");
    }
}

async function createFlashcardsHandler(params, extra) {
    let { blockIds, deckId } = params;
    let { sendNotification, _meta} = extra;

    if (!isValidStr(deckId)) {
        deckId = QUICK_DECK_ID;
    }
    if (!await isValidDeck(deckId)) {
        return createErrorResponse("Card creation failed: The DeckId does not exist. If the user has not specified a deck name or ID, set the deckId parameter to an empty string.");
    }
    const filteredIds = [];
    for (let i = 0; i < blockIds.length; i++) {
        const blockId = blockIds[i];
        const dbItem = await getBlockDBItem(blockId);
        if (dbItem == null) {
            return createErrorResponse(`Invalid block ID: ${blockId}. Please check if the ID exists and is correct.`);
        }
        if (await filterBlock(blockId, dbItem)) {
            continue;
        }
        filteredIds.push(blockId);
        if (_meta?.progressToken) {
            await sendNotification({
                method: "notifications/progress",
                params: { progress: (i + 1) / blockIds.length + 2, progressToken: _meta.progressToken }
            });
        }
    }

    const addCardsResult = await addRiffCards(filteredIds, deckId);
    if (addCardsResult === null) {
        return createErrorResponse("Failed to create flashcards.");
    }
    return createSuccessResponse(`Successfully added ${filteredIds.length} flashcards.`);
}

async function deleteFlashcardsHandler(params, extra) {
    let { blockIds, deckId } = params;

    if (!isValidStr(deckId)) {
        deckId = "";
    }
    if (!await isValidDeck(deckId) && deckId !== "") {
        return createErrorResponse("Card deletion failed: The DeckId does not exist. If the user has not specified a deck name or ID, set the deckId parameter to an empty string.");
    }

    const removeResult = await removeRiffCards(blockIds, deckId);
    if (removeResult === null) {
        return createErrorResponse("Failed to delete flashcards.");
    }
    return createSuccessResponse(`Successfully removed flashcards corresponding to ${blockIds.length} blocks.`);
}

async function parseDocAddCards(docId:string, addType: string, deckId: string) {
    const functionDict = {
        "h1": provideHeadingIds.bind(this, docId, addType),
        "h2": provideHeadingIds.bind(this, docId, addType),
        "h3": provideHeadingIds.bind(this, docId, addType),
        "h4": provideHeadingIds.bind(this, docId, addType),
        "h5": provideHeadingIds.bind(this, docId, addType),
        "highlight": provideHighlightBlockIds.bind(this, docId),
        "superBlock": provideSuperBlockIds.bind(this, docId),
    }
    const blockIds = await functionDict[addType]();
    let afterAddSize = await addRiffCards(blockIds, deckId);
    return blockIds.length;
}

async function listDeck(params, extra) {
    if (!window.siyuan.config.flashcard.deck) {
        return createSuccessResponse("用户禁用了卡包，在调用其他工具时，可以直接将参数deckId设置为\"\"");
    }
    const deckResponse = await getRiffDecks();
    return createJsonResponse(deckResponse);
}

// async function addFlashCardFromExistBlock(params, extra) {
//     const { blockId, deckId } = params;
//     // 确认入参
    
// }

function isValidType(type) {
    return TYPE_VALID_LIST.includes(type);
}

function getIdFromSqlItem(sqlResponse) {
    sqlResponse = sqlResponse ?? [];
    return sqlResponse.map(item=>item.id);
}

async function provideHeadingIds(docId: string, headingType: string) {
    let queryResult = await queryAPI(`select id from blocks where root_id = '${docId}' and type = 'h' and subtype = '${headingType}';`);
    return getIdFromSqlItem(queryResult);
}
async function provideSuperBlockIds(docId:string) {
    let queryResult = await queryAPI(`select * from blocks where root_id = '${docId}' and type = 's'`);
    return getIdFromSqlItem(queryResult);
}
async function provideHighlightBlockIds(docId:string) {
    let queryResult = await queryAPI(`SELECT * FROM blocks WHERE 
        root_id = '${docId}' 
    AND 
        type = "p" 
    AND 
        markdown regexp '==.*=='`);
    let finalResult = new Array();
    queryResult.forEach((oneResult) => {
        let oneContent = oneResult.markdown;
        // logPush(`[正则检查]原内容`, oneContent);
        oneContent = oneContent.replace(new RegExp("(?!<\\\\)`[^`]*`(?!`)", "g"), "");
        // logPush(`[正则检查]移除行内代码`, oneContent);
        let regExp = new RegExp("(?<!\\\\)==[^=]*[^\\\\]==");
        // logPush(`[正则检查]重新匹配高亮`, oneContent.match(regExp));
        if (oneContent.match(regExp) != null) {
            finalResult.push(oneResult);
        }
    });
    return getIdFromSqlItem(queryResult);
}