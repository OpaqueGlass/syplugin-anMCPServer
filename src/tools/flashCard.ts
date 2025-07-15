import { addRiffCards, getRiffDecks, queryAPI } from "@/syapi";
import { isValidDeck, QUICK_DECK_ID } from "@/syapi/custom";
import { isValidStr } from "@/utils/commonCheck";
import { createErrorResponse, createJsonResponse, createSuccessResponse } from "@/utils/mcpResponse";
import { createNewDocWithParentId } from "./sharedFunction";
import { McpToolsProvider } from "./baseToolProvider";
import { z } from "zod";
import { useWsIndexQueue } from "@/utils/wsMainHelper";

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
            annotations: {
                title: "Create Flashcards with New Doc",
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
            }
        }];
    }
}
async function addFlashCardMarkdown(params, extra) {
    let { parentId, docTitle, type, deckId, markdownContent } = params;
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
        // 需要等待索引完成
        const addCardsResult = await useWsIndexQueue()?.enqueue(async ()=>{
            return await parseDocAddCards(newDocId, type, deckId);
        });
        return createSuccessResponse(`成功添加了 ${addCardsResult} 张闪卡`);
    } else {
        return createErrorResponse("制卡失败：创建闪卡文档时遇到未知问题");
    }
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