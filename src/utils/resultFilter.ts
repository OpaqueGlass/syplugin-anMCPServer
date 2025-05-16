import { logPush } from "@/logger";
import { FullTextSearchQuery } from "@/syapi/interface";
import { isValidStr } from "./commonCheck";

/**
 * 以文档分组下，过滤检索的结果
 * @param inputDataList 检索结果中的blocks字段
 */
export function filterGroupSearchBlocksResult(inputDataList) {
    if (inputDataList == null) {
        return [];
    }
    let result = inputDataList.map((item)=>{
        let children = item["children"] ? item.children.map((childItem)=>getSearchResultString(childItem)) : [];
        return {
            "notebookId": item["box"],
            "path": item["path"],
            "docId": item["rootID"],
            "docName": item["content"] ,
            "hPath": item["hPath"],
            "tag": item["tag"],
            "memo": item["memo"],
            "children": children
        }
    });
    return result;
}

/**
 * 从块结果获取检索结果字符串（仅）
 * @param inputData SearchResult
 * @returns 用于反映检索结果的内容
 */
export function getSearchResultString(inputData) {
    if (!isValidStr(inputData["markdown"])) {
        return inputData["fcontent"] ?? "";
    }
    return inputData["markdown"];
}

export function filterSearchBlocksResult(inputDataList) {
    if (inputDataList == null) {
        return [];
    }
    return inputDataList.map((item)=>{
        return {
            "notebookId": item["box"],
            "path": item["path"],
            "docId": item["rootID"],
            "blockId": item["id"],
            "content": item["markdown"] ,
            "docHumanPath": item["hPath"],
            "tag": item["tag"],
            "memo": item["memo"],
            "alias": item["alias"]
        }
    });
}

export function formatSearchResult(responseObj, requestObj: FullTextSearchQuery) {
    let pageDesp = `This is page ${requestObj["page"] ?? "1"} of a paginated API response.  
${responseObj["matchedRootCount"]} documents and ${responseObj["matchedBlockCount"]} content blocks matched the search, across ${responseObj["pageCount"]} total pages.`;
    let data = null;
    let anyResult = responseObj["blocks"] == null || responseObj["blocks"].length == 0 ? null : responseObj["blocks"][0];
    if (requestObj.groupBy == 1 || anyResult?.children) {
        data = filterGroupSearchBlocksResult(responseObj["blocks"]);
    } else {
        data = filterSearchBlocksResult(responseObj["blocks"]);
    }
    return `${pageDesp}
Search Result:
${JSON.stringify(data)}`;
}
