import { z } from "zod";
import { createErrorResponse, createJsonResponse, createSuccessResponse } from "../utils/mcpResponse";
import { exportMdContent, getFileAPIv2, getKramdown } from "@/syapi";
import { McpToolsProvider } from "./baseToolProvider";
import { getBlockAssets, getBlockDBItem } from "@/syapi/custom";
import { blobToBase64Object } from "@/utils/common";
import { debugPush, errorPush, logPush } from "@/logger";
import { isValidStr } from "@/utils/commonCheck";
import { lang } from "@/utils/lang";

export class DocReadToolProvider extends McpToolsProvider<any> {
    async getTools(): Promise<McpTool<any>[]> {
        return [{
            name: "siyuan_read_doc_content_markdown",
            description: 'Retrieve the content of a document or block by its ID',
            schema: {
                id: z.string().describe("The unique identifier of the document or block"),
                offset: z.number().default(0).describe("The starting character offset for partial content reading (for pagination/large docs)"),
                limit: z.number().default(10000).describe("The maximum number of characters to return in this request"),
            },
            handler: blockReadHandler,
            title: lang("tool_title_read_doc_content_markdown"),
            annotations: {
                readOnlyHint: true,
            }
        },
        {
            name: "siyuan_get_block_kramdown",
            description: '从思源笔记中根据文档或块 ID 获取其完整的 Kramdown 内容。与普通文本不同，此 Kramdown 格式将保留包括颜色、属性、ID 在内的所有丰富格式信息。此工具主要用于修改前读取块内容，确保更新后能完整地保留原有格式。',
            schema: {
                id: z.string().describe("The unique identifier of the block"),
            },
            handler: kramdownReadHandler,
            title: lang("tool_title_get_block_kramdown"),
            annotations: {
                readOnlyHint: true,
            }
        }];
    }
}

async function blockReadHandler(params, extra) {
    const { id, offset = 0, limit = 10000 } = params;
    debugPush("读取文档内容");
    // 检查输入
    const dbItem = await getBlockDBItem(id);
    if (dbItem == null) {
        return createErrorResponse("Invalid document or block ID. Please check if the ID exists and is correct.");
    }
    let otherImg = [];
    if (dbItem.type != "d") {
        try {
            otherImg = await getAssets(id);
        } catch (error) {
            errorPush("转换Assets为图片时出错", error);
        }
    }
    const markdown = await exportMdContent({id, refMode: 4, embedMode: 1, yfm: false});
    // 返回块内容时，不应当返回文档标题，需要判断设置项
    if (dbItem.type != "d" && isValidStr(markdown["content"]) && window.siyuan.config.export.addTitle) {
        markdown["content"] = markdown["content"].replace(/^#{1,6}\s+.*\n?/, '');
    }
    const content = markdown["content"] || "";
    const sliced = content.slice(offset, offset + limit);
    const hasMore = offset + limit < content.length;
    return createJsonResponse({
        content: sliced,
        offset,
        limit,
        "hasMore": hasMore,
        "totalLength": content.length
    }, otherImg);
}

async function kramdownReadHandler(params, extra) {
    const { id } = params;
    // 检查输入
    const dbItem = await getBlockDBItem(id);
    if (dbItem == null) {
        return createErrorResponse("Invalid block ID. Please check if the ID exists and is correct.");
    }
    let otherImg = [];
    if (dbItem.type != "d") {
        try {
            otherImg = await getAssets(id);
        } catch (error) {
            errorPush("转换Assets为图片时出错", error);
        }
    } else {
        return createErrorResponse("这个工具目前仅接受读取非文档块的kramdown结构，不支持读取整篇文档");
    }
    const kramdown = await getKramdown(id);
    const content = kramdown || "";
    return createJsonResponse({
        kramdown: content,
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
            logPush("文件过大，暂不予返回", blob.size);
        } else if (mediaLengthSum / 1024 / 1024 > 5) {
            logPush("累计返回媒体过大，不再返回后续内容", mediaLengthSum);
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
