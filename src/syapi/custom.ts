import * as siyuanAPIs from "siyuan";
import { debugPush } from "@/logger";
import { queryAPI, listDocsByPathT, getTreeStat, getCurrentDocIdF } from ".";
import { isValidStr } from "@/utils/commonCheck";
/**
 * 统计子文档字符数
 * @param {*} childDocs 
 * @returns 
 */
export async function getChildDocumentsWordCount(docId:string) {
    const sqlResult = await queryAPI(`
        SELECT SUM(length) AS count
        FROM blocks
        WHERE
            path like "%/${docId}/%"
            AND 
            type in ("p", "h", "c", "t")
        `);
    if (sqlResult[0].count) {
        return sqlResult[0].count;
    }
    return 0;
    // let totalWords = 0;
    // let docCount = 0;
    // for (let childDoc of childDocs) {
    //     let tempWordsResult = await getTreeStat(childDoc.id);
    //     totalWords += tempWordsResult.wordCount;
    //     childDoc["wordCount"] = tempWordsResult.wordCount;
    //     docCount++;
    //     if (docCount > 128) {
    //         totalWords = `${totalWords}+`;
    //         break;
    //     }
    // }
    // return [childDocs, totalWords];
}

export async function getChildDocuments(sqlResult:SqlResult, maxListCount: number): Promise<IFile[]> {
    let childDocs = await listDocsByPathT({path: sqlResult.path, notebook: sqlResult.box, maxListCount: maxListCount});
    return childDocs;
}

export async function isChildDocExist(id: string) {
    const sqlResponse = await queryAPI(`
        SELECT * FROM blocks WHERE path like '%${id}/%' LIMIT 3
        `);
    if (sqlResponse && sqlResponse.length > 0) {
        return true;
    }
    return false;
}

export async function isDocHasAv(docId: string) {
    let sqlResult = await queryAPI(`
    SELECT count(*) as avcount FROM blocks WHERE root_id = '${docId}'
    AND type = 'av'
    `);
    if (sqlResult.length > 0 && sqlResult[0].avcount > 0) {
        return true;
    } else {
        
        return false;
    }
}

export async function isDocEmpty(docId: string, blockCountThreshold = 0) {
    // 检查父文档是否为空
    let treeStat = await getTreeStat(docId);
    if (blockCountThreshold == 0 && treeStat.wordCount != 0 && treeStat.imageCount != 0) {
        debugPush("treeStat判定文档非空，不插入挂件");
        return false;
    }
    if (blockCountThreshold != 0) {
        let blockCountSqlResult = await queryAPI(`SELECT count(*) as bcount FROM blocks WHERE root_id like '${docId}' AND type in ('p', 'c', 'iframe', 'html', 'video', 'audio', 'widget', 'query_embed', 't')`);
        if (blockCountSqlResult.length > 0) {
            if (blockCountSqlResult[0].bcount > blockCountThreshold) {
                return false;
            } else {
                return true;
            }
        }
    }
    
    let sqlResult = await queryAPI(`SELECT markdown FROM blocks WHERE 
        root_id like '${docId}' 
        AND type != 'd' 
        AND (type != 'p' 
           OR (type = 'p' AND length != 0)
           )
        LIMIT 5`);
    if (sqlResult.length <= 0) {
        return true;
    } else {
        debugPush("sql判定文档非空，不插入挂件");
        return false;
    }
}

export function getActiveDocProtyle() {
    const allProtyle = {};
    window.siyuan.layout.centerLayout?.children?.forEach((wndItem) => {
        wndItem?.children?.forEach((tabItem) => {
            if (tabItem?.model) {
                allProtyle[tabItem?.id](tabItem.model?.editor?.protyle);
            }
        });
    });
}

export function getActiveEditorIds() {
    let result = [];
    let id = window.document.querySelector(`.layout__wnd--active [data-type="tab-header"].item--focus`)?.getAttribute("data-id");
    if (id) return [id];
    window.document.querySelectorAll(`[data-type="tab-header"].item--focus`).forEach(item=>{
        let uid = item.getAttribute("data-id");
        if (uid) result.push(uid);
    });
    return result;
}



/**
 * 获取当前更新时间字符串
 * @returns 
 */
export function getUpdateString(){
    let nowDate = new Date();
    let hours = nowDate.getHours();
    let minutes = nowDate.getMinutes();
    let seconds = nowDate.getSeconds();
    hours = formatTime(hours);
    minutes = formatTime(minutes);
    seconds = formatTime(seconds);
    let timeStr = nowDate.toJSON().replace(new RegExp("-", "g"),"").substring(0, 8) + hours + minutes + seconds;
    return timeStr;
    function formatTime(num) {
        return num < 10 ? '0' + num : num;
    }
}

/**
 * 生成一个随机的块id
 * @returns 
 */
export function generateBlockId(){
    // @ts-ignore
    if (window?.Lute?.NewNodeID) {
        // @ts-ignore
        return window.Lute.NewNodeID();
    }
    let timeStr = getUpdateString();
    let alphabet = new Array();
    for (let i = 48; i <= 57; i++) alphabet.push(String.fromCharCode(i));
    for (let i = 97; i <= 122; i++) alphabet.push(String.fromCharCode(i));
    let randomStr = "";
    for (let i = 0; i < 7; i++){
        randomStr += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    let result = timeStr + "-" + randomStr;
    return result;
}

/**
 * 转换块属性对象为{: }格式IAL字符串
 * @param {*} attrData 其属性值应当为String类型
 * @returns 
 */
export function transfromAttrToIAL(attrData) {
    let result = "{:";
    for (let key in attrData) {
        result += ` ${key}=\"${attrData[key]}\"`;
    }
    result += "}";
    if (result == "{:}") return null;
    return result;
}


export function removeCurrentTabF(docId?:string) {
    // 获取tabId
    if (!isValidStr(docId)) {
        docId = getCurrentDocIdF(true);
    }
    if (!isValidStr(docId)) {
        debugPush("错误的id或多个匹配id");
        return;
    }
    // v3.1.11或以上
    if (siyuanAPIs?.getAllEditor) {
        const editor = siyuanAPIs.getAllEditor();
        let protyle = null;
        for (let i = 0; i < editor.length; i++) {
            if (editor[i].protyle.block.rootID === docId) {
                protyle = editor[i].protyle;
                break;
            }
        }
        if (protyle) {
            if (protyle.model.headElement) {
                if (protyle.model.headElement.classList.contains("item--pin")) {
                    debugPush("Pin页面，不关闭存在页签");
                    return;
                }
            }
            //id: string, closeAll = false, animate = true, isSaveLayout = true
            debugPush("关闭存在页签", protyle?.model?.parent?.parent, protyle.model?.parent?.id);
            protyle?.model?.parent?.parent?.removeTab(protyle.model?.parent?.id, false, false);
        } else {
            debugPush("没有找到对应的protyle，不关闭存在的页签");
            return;
        }
    } else { // v3.1.10或以下
        return;
    }

}

export function isValidIdFormat(id: string): boolean {
    const idRegex = /^\d{14}-[a-zA-Z0-9]{7}$/;
    return idRegex.test(id);
}

export function checkIdValid(id: string): void {
    if (!isValidIdFormat(id)) {
        throw new Error("The `id` format is incorrect, please check if it is a valid `id`.");
    }
}


export async function isADocId(id:string): Promise<boolean> {
    const queryResponse = await queryAPI(`SELECT type FROM blocks WHERE id = '${id}'`);
    if (queryResponse == null || queryResponse.length == 0) {
        return false;
    }
    if (queryResponse[0].type == "d") {
        return true;
    }
    return false;
}

export async function getDocDBitem(id:string) {
    const queryResponse = await queryAPI(`SELECT * FROM blocks WHERE id = '${id}' and type = 'd'`);
    if (queryResponse == null || queryResponse.length == 0) {
        return null;
    }
    return queryResponse[0];
}