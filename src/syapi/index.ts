/**
 * API.js
 * 用于发送思源api请求。
 */
import { getToken } from "@/utils/common";
import { isValidStr } from "@/utils/commonCheck";
import { warnPush, errorPush, debugPush, logPush } from "@/logger"
/**向思源api发送请求
 * @param data 传递的信息（body）
 * @param url 请求的地址
 */
export async function postRequest(data: any, url:string){
    let result;
    await fetch(url, {
        body: JSON.stringify(data),
        method: 'POST',
        headers: {
            // "Authorization": "Token "+ getToken(),
            "Content-Type": "application/json"
        }
    }).then((response) => {
        result = response.json();
    });
    return result;
}

export async function getResponseData(promiseResponse){
    const response = await promiseResponse;
    if (response.code != 0 || response.data == null){
        return null;
    }else{
        return response.data;
    }
}

/**
 * 检查请求是否成功，返回0、-1
 * @param {*} response 
 * @returns 成功为0，失败为-1
 */
export async function checkResponse(response){
    if (response.code == 0){
        return 0;
    }else{
        return -1;
    }
}

/**SQL（api）
 * @param sqlstmt SQL语句
 */
export async function queryAPI(sqlstmt:string){
    let url = "/api/query/sql";
    let response = await postRequest({stmt: sqlstmt},url);
    if (response.code == 0 && response.data != null){
        return response.data;
    }
    if (response.msg != "") {
        throw new Error(`SQL ERROR: ${response.msg}`);
    }
    
    return [];
}

/**重建索引
 * @param docpath 需要重建索引的文档路径
 */
export async function reindexDoc(docpath){
    let url = "/api/filetree/reindexTree";
    await postRequest({path: docpath},url);
    return 0;
}

/**列出子文件（api）
 * @param notebookId 笔记本id
 * @param path 需要列出子文件的路径
 * @param maxListCount 子文档最大显示数量
 * @param sort 排序方式（类型号）
 */
export async function listDocsByPathT({notebook, path, maxListCount = undefined, sort = undefined, ignore = true, showHidden = null}){
    let url = "/api/filetree/listDocsByPath";
    let body = {
        "notebook": notebook,
        "path": path
    }
    if (maxListCount != undefined && maxListCount >= 0) {
        body["maxListCount"] = maxListCount;
    }
    if (sort != undefined && sort != DOC_SORT_TYPES.FOLLOW_DOC_TREE && sort != DOC_SORT_TYPES.UNASSIGNED) {
        body["sort"] = sort;
    }
    if (ignore != undefined) {
        body["ignoreMaxListHint"] = ignore;
    }
    if (showHidden != null) {
        body["showHidden"] = showHidden;
    }
    let response = await postRequest(body, url);
    if (response.code != 0 || response.data == null){
        warnPush("listDocsByPath请求错误", response.msg);
        return new Array();
    }
    return response.data.files;
}

/**
 * 添加属性（API）
 * @param attrs 属性对象
 * @param 挂件id
 * */
export async function addblockAttrAPI(attrs, blockid){
    let url = "/api/attr/setBlockAttrs";
    let attr = {
        id: blockid,
        attrs: attrs
    }
    let result = await postRequest(attr, url);
    return checkResponse(result);
}

/**获取挂件块参数（API）
 * @param blockid
 * @return response 请访问result.data获取对应的属性
 */
export async function getblockAttr(blockid){
    let url = "/api/attr/getBlockAttrs";
    let response = await postRequest({id: blockid}, url);
    if (response.code != 0){
        throw Error("获取挂件块参数失败");
    }
    return response.data;
}

/**
 * 更新块（返回值有删减）
 * @param {String} text 更新写入的文本
 * @param {String} blockid 更新的块id
 * @param {String} textType 文本类型，markdown、dom可选
 * @returns 对象，为response.data[0].doOperations[0]的值，返回码为-1时也返回null
 */
export async function updateBlockAPI(text, blockid, textType = "markdown"){
    let url = "/api/block/updateBlock";
    let data = {dataType: textType, data: text, id: blockid};
    let response = await postRequest(data, url);
    try{
        if (response.code == 0 && response.data != null &&  isValidStr(response.data[0].doOperations[0].id)){
            return response.data[0].doOperations[0];
        }
        if (response.code == -1){
            warnPush("更新块失败", response.msg);
            return null;
        }
    }catch(err){
        errorPush(err);
        warnPush(response.msg);
    }
    return null;
}

/**
 * 插入块（返回值有删减）
 * @param {string} text 文本
 * @param {string} blockid 指定的块
 * @param {string} textType 插入的文本类型，"markdown" or "dom"
 * @param {string} addType 插入到哪里？默认插入为指定块之后，NEXT 为插入到指定块之前， PARENT 为插入为指定块的子块
 * @return 对象，为response.data[0].doOperations[0]的值，返回码为-1时也返回null
 */
export async function insertBlockAPI(text, blockid, addType = "previousID", textType = "markdown"){
    let url = "/api/block/insertBlock";
    let data = {dataType: textType, data: text};
    switch (addType) {
        case "parentID":
        case "PARENT":
        case "parentId": {
            data["parentID"] = blockid;
            break;
        }
        case "nextID":
        case "NEXT":
        case "nextId": {
            data["nextID"] = blockid;
            break;
        }
        case "previousID":
        case "PREVIOUS":
        case "previousId": 
        default: {
            data["previousID"] = blockid;
            break;
        }
    }
    let response = await postRequest(data, url);
    try{
        if (response.code == 0 && response.data != null && isValidStr(response.data[0].doOperations[0].id)){
            return response.data[0].doOperations[0];
        }
        if (response.code == -1){
            warnPush("插入块失败", response.msg);
            return null;
        }
    }catch(err){
        errorPush(err);
        warnPush(response.msg);
    }
    return null;

}


/**
 * 插入块 API
 * @param {Object} params
 * @param {"markdown"|"dom"} params.dataType - 数据类型
 * @param {string} params.data - 待插入的数据
 * @param {string} params.nextID - 后一个块的ID
 * @param {string} params.previousID - 前一个块的ID
 * @param {string} params.parentID - 父块ID
 * @returns {Promise<Object>} 插入结果
 */
export async function insertBlockOriginAPI({ dataType, data, nextID, previousID, parentID }) {
    // 参数校验
    if (!isValidStr(dataType) || !["markdown", "dom"].includes(dataType)) {
        throw new Error("Invalid dataType");
    }
    if (!isValidStr(data)) {
        throw new Error("Data cannot be empty");
    }
    // 定位插入点，优先级 nextID > previousID > parentID
    let anchorType = "";
    let anchorID = "";
    if (isValidStr(nextID)) {
        anchorType = "nextID";
        anchorID = nextID;
    } else if (isValidStr(previousID)) {
        anchorType = "previousID";
        anchorID = previousID;
    } else if (isValidStr(parentID)) {
        anchorType = "parentID";
        anchorID = parentID;
    } else {
        throw new Error("At least one anchor ID(nextID, previousId or parentId) must be provided");
    }

    const payload = {
        dataType,
        data,
        nextID,
        previousID,
        parentID
    };
    let response = await postRequest(payload, "/api/block/insertBlock");
    if (response.data == null || response.data.length == 0 || response.data[0].doOperations == null || response.data[0].doOperations.length === 0 || response.data[0].doOperations[0] == null || !isValidStr(response.data[0].doOperations[0].id)) {
        throw new Error("Insert block failed: No operations returned");
    }
    return response.data;
}

/**
 * 获取文档大纲
 * @param {string} docid 要获取的文档id
 * @returns {*} 响应的data部分，为outline对象数组
 */
export async function getDocOutlineAPI(docid){
    let url = "/api/outline/getDocOutline";
    let data = {"id": docid};
    let response = await postRequest(data, url);
    if (response.code == 0){
        return response.data;
    }else{
        return null;
    }
}

/**
 * 插入为后置子块
 * @param {*} text 子块文本
 * @param {*} parentId 父块id
 * @param {*} textType 默认为"markdown"
 * @returns 
 */
export async function prependBlockAPI(text, parentId, textType = "markdown"){
    let url = "/api/block/prependBlock";
    let data = {"dataType": textType, "data": text, "parentID": parentId};
    let response = await postRequest(data, url);
    try{
        if (response.code == 0 && response.data != null && isValidStr(response.data[0].doOperations[0].id)){
            return response.data[0].doOperations[0];
        }
        if (response.code == -1){
            warnPush("插入块失败", response.msg);
            return null;
        }
    }catch(err){
        errorPush(err);
        warnPush(response.msg);
    }
    return null;

}

/**
 * 插入为前置子块
 * @param {*} text 子块文本
 * @param {*} parentId 父块id
 * @param {*} textType 默认为markdown
 * @returns 
 */
export async function appendBlockAPI(text, parentId, textType = "markdown"){
    let url = "/api/block/appendBlock";
    let data = {"dataType": textType, "data": text, "parentID": parentId};
    let response = await postRequest(data, url);
    try{
        if (response.code == 0 && response.data != null && isValidStr(response.data[0].doOperations[0].id)){
            return response.data[0].doOperations[0];
        }
        if (response.code == -1){
            warnPush("插入块失败", response.msg);
            return null;
        }
    }catch(err){
        errorPush(err);
        warnPush(response.msg);
    }
    return null;

}

/**
 * 推送普通消息
 * @param {string} msgText 推送的内容
 * @param {number} timeout 显示时间，单位毫秒
 * @return 0正常推送 -1 推送失败
 */
export async function pushMsgAPI(msgText, timeout){
    let url = "/api/notification/pushMsg";
    let response = await postRequest({msg: msgText, timeout: timeout}, url);
    if (response.code != 0 || response.data == null || !isValidStr(response.data.id)){
        return -1;
    }
    return 0;
}

/**
 * 获取当前文档id（伪api）
 * 优先使用jquery查询
 * @param {boolean} mustSure 是否必须确认，若为true，找到多个打开中的文档时返回null
 */
export function getCurrentDocIdF(mustSure: boolean = false) {
    let thisDocId:string = null;
    // 桌面端
    thisDocId = window.top.document.querySelector(".layout__wnd--active .protyle.fn__flex-1:not(.fn__none) .protyle-background")?.getAttribute("data-node-id");
    debugPush("尝试获取当前具有焦点的id", thisDocId);
    let temp:string = null;
    // 移动端
    if (!thisDocId && isMobile()) {
        // UNSTABLE: 面包屑样式变动将导致此方案错误！
        try {
            temp = window.top.document.querySelector(".protyle-breadcrumb .protyle-breadcrumb__item .popover__block[data-id]")?.getAttribute("data-id");
            let iconArray = window.top.document.querySelectorAll(".protyle-breadcrumb .protyle-breadcrumb__item .popover__block[data-id]");
            for (let i = 0; i < iconArray.length; i++) {
                let iconOne = iconArray[i];
                if (iconOne.children.length > 0 
                    && iconOne.children[0].getAttribute("xlink:href") == "#iconFile"){
                    temp = iconOne.getAttribute("data-id");
                    break;
                }
            }
            thisDocId = temp;
        }catch(e){
            console.error(e);
            temp = null;
        }
    }
    // 无聚焦窗口
    if (!thisDocId) {
        thisDocId = window.top.document.querySelector(".protyle.fn__flex-1:not(.fn__none) .protyle-background")?.getAttribute("data-node-id");
        debugPush("获取具有焦点id失败，获取首个打开中的文档", thisDocId);
        if (mustSure && window.top.document.querySelectorAll(".protyle.fn__flex-1:not(.fn__none) .protyle-background").length > 1) {
            debugPush("要求必须唯一确认，但是找到多个打开中的文档");
            return null;
        }
    }
    return thisDocId;
}

export function getAllShowingDocId(): string[] {
    if (isMobile()) {
        return [getCurrentDocIdF()];
    } else {
        const elemList = window.document.querySelectorAll("[data-type=wnd] .protyle.fn__flex-1:not(.fn__none) .protyle-background");
        const result = [].map.call(elemList, function(elem: Element) {
            return elem.getAttribute("data-node-id");
        });
        return result
    }
}

/**
 * 获取当前挂件id
 * @returns 
 */
export function getCurrentWidgetId(){
    try{
        if (!window.frameElement.parentElement.parentElement.dataset.nodeId) {
            return window.frameElement.parentElement.parentElement.dataset.id;
        }else{
            return window.frameElement.parentElement.parentElement.dataset.nodeId;
        }
    }catch(err){
        warnPush("getCurrentWidgetId window...nodeId方法失效");
        return null;
    }
}

/**
 * 检查运行的操作系统
 * @return true 可以运行，当前os在允许列表中
 */
//  export function checkOs(){
//     try{
//         if (setting.includeOs.indexOf(window.top.siyuan.config.system.os.toLowerCase()) != -1){
//             return true;
//         }
//     }catch(err){
//         errorPush(err);
//         warnPush("检查操作系统失败");
//     }
    
//     return false;
// }
/**
 * 删除块
 * @param {*} blockid 
 * @returns 
 */
export async function removeBlockAPI(blockid){
    let url = "/api/block/deleteBlock";
    let response = await postRequest({id: blockid}, url);
    if (response.code == 0){
        return true;
    }
    warnPush("删除块失败", response);
    return false;
}

/**
 * 获取块kramdown源码
 * @param {*} blockid 
 * @returns kramdown文本
 */
export async function getKramdown(blockid, throwError = false){
    let url = "/api/block/getBlockKramdown";
    let response = await postRequest({id: blockid}, url);
    if (response.code == 0 && response.data != null && "kramdown" in response.data){
        return response.data.kramdown;
    }
    if (throwError) {
        throw new Error(`get kramdown failed: ${response.msg}`);
    }
    return null;
}

/**
 * 获取笔记本列表
 * @returns 
        "id": "20210817205410-2kvfpfn", 
        "name": "测试笔记本",
        "icon": "1f41b",
        "sort": 0,
        "closed": false
      
 */
export async function getNodebookList() {
    let url = "/api/notebook/lsNotebooks";
    let response = await postRequest({}, url);
    if (response.code == 0 && response.data != null && "notebooks" in response.data){
        return response.data.notebooks;
    }
    return null;
}

/**
 * 基于本地window.siyuan获得笔记本信息
 * @param {*} notebookId 为空获得所有笔记本信息
 * @returns 
 */
export function getNotebookInfoLocallyF(notebookId = undefined) {
    try {
        if (!notebookId) return window.top.siyuan.notebooks;
        for (let notebookInfo of window.top.siyuan.notebooks) {
            if (notebookInfo.id == notebookId) {
                return notebookInfo;
            }
        }
        return undefined;
    }catch(err) {
        errorPush(err);
        return undefined;
    }
}

/**
 * 获取笔记本排序规则
 * （为“跟随文档树“的，转为文档树排序
 * @param {*} notebookId 笔记本id，不传则为文档树排序
 * @returns 
 */
export function getNotebookSortModeF(notebookId = undefined) {
    try {
        let fileTreeSort = window.top.siyuan.config.fileTree.sort;
        if (!notebookId) return fileTreeSort;
        let notebookSortMode = window.document.querySelector(`.file-tree.sy__file ul[data-url='${notebookId}']`)?.getAttribute("data-sortmode") ?? getNotebookInfoLocallyF(notebookId).sortMode;
        if (typeof notebookSortMode === "string") {
            notebookSortMode = parseInt(notebookSortMode, 10);
        }
        if (notebookSortMode == DOC_SORT_TYPES.UNASSIGNED || notebookSortMode == DOC_SORT_TYPES.FOLLOW_DOC_TREE) {
            return fileTreeSort;
        }
        return notebookSortMode;
    }catch(err) {
        errorPush(err);
        return undefined;
    }
}

/**
 * 批量添加闪卡
 * @param {*} ids 
 * @param {*} deckId 目标牌组Id 
 * @param {*} oldCardsNum 原有牌组卡牌数（可选）
 * @returns （若未传入原卡牌数）添加后牌组内卡牌数,  （若传入）返回实际添加的卡牌数； 返回null表示请求失败
 */
export async function addRiffCards(ids, deckId, oldCardsNum = -1) {
    let url = "/api/riff/addRiffCards";
    let postBody = {
        deckID: deckId,
        blockIDs: ids
    };
    let response = await postRequest(postBody, url);
    if (response.code == 0 && response.data != null && "size" in response.data) {
        if (oldCardsNum < 0) {
            return response.data.size;
        }else{
            return response.data.size - oldCardsNum;
        }
    }
    warnPush("添加闪卡出错", response);
    return null;
}

export async function getNotebookConf(notebookId: string) {
    const url = "/api/notebook/getNotebookConf";
    const response = await postRequest({ notebook: notebookId }, url);
    if (response.code === 0 && response.data) {
        return response.data;
    }
    return null;
}

/**
 * 批量移除闪卡
 * @param {*} ids 
 * @param {*} deckId 目标牌组Id 
 * @param {*} oldCardsNum 原有牌组卡牌数（可选）
 * @returns （若未传入原卡牌数）移除后牌组内卡牌数,  （若传入）返回实际移除的卡牌数； 返回null表示请求失败
 */
export async function removeRiffCards(ids, deckId, oldCardsNum = -1) {
    let url = "/api/riff/removeRiffCards";
    let postBody = {
        deckID: deckId,
        blockIDs: ids
    };
    let response = await postRequest(postBody, url);
    if (response.code == 0 && response.data != null && "size" in response.data) {
        if (oldCardsNum < 0) {
            return response.data.size;
        }else{
            return oldCardsNum - response.data.size;
        }
    }
    if (response.code == 0) {
        return ids.length;
    }
    warnPush("移除闪卡出错", response);
    return null;
}

/**
 * 获取全部牌组信息
 * @returns 返回数组
 * [{"created":"2023-01-05 20:29:48",
 * "id":"20230105202948-xn12hz6",
 * "name":"Default Deck",
 * "size":1,
 * "updated":"2023-01-19 21:48:21"}]
 */
export async function getRiffDecks() {
    let url = "/api/riff/getRiffDecks";
    let response = await postRequest({}, url);
    if (response.code == 0 && response.data != null) {
        return response.data;
    }
    return new Array();
}

/**
 * 获取文件内容或链接信息
 * @param {*} blockid 获取的文件id
 * @param {*} size 获取的块数
 * @param {*} mode 获取模式，0为获取html；1为
 */
export async function getDoc(blockid, size = 5, mode = 0) {
    let url = "/api/filetree/getDoc";
    let response = await postRequest({id: blockid, mode: mode, size: size}, url);
    if (response.code == 0 && response.data != null) {
        return response.data;
    }
    return undefined;
}

/**
 * 获取文档导出预览
 * @param {*} docid 
 * @returns 
 */
export async function getDocPreview(docid) {
    let url = "/api/export/preview";
    let response = await postRequest({id: docid}, url);
    if (response.code == 0 && response.data != null) {
        return response.data.html;
    }
    return "";
}
/**
 * 删除文档
 * @param {*} notebookid 笔记本id
 * @param {*} path 文档所在路径
 * @returns 
 */
export async function removeDocAPI(notebookid, path) {
    let url = "/api/filetree/removeDoc";
    let response = await postRequest({"notebook": notebookid, "path": path}, url);
    if (response.code == 0) {
        return response.code;
    }
    warnPush("删除文档时发生错误", response.msg);
    return response.code;
}
/**
 * 重命名文档
 * @param {*} notebookid 笔记本id
 * @param {*} path 文档所在路径
 * @param {*} title 新文档名
 * @returns 
 */
export async function renameDocAPI(notebookid, path, title) {
    let url = "/api/filetree/renameDoc";
    let response = await postRequest({"notebook": notebookid, "path": path, "title": title}, url);
    if (response.code == 0) {
        return response.code;
    }
    warnPush("重命名文档时发生错误", response.msg);
    return response.code;
}

export function isDarkMode() {
    if (window.top.siyuan) {
        return window.top.siyuan.config.appearance.mode == 1 ? true : false;
    } else {
        let isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        return isDarkMode;
    }
}

/**
 * 通过markdown创建文件
 * @param {*} notebookid 笔记本id
 * @param {*} hpath 示例 /父文档1/父文档2/你要新建的文档名
 * @param {*} md 
 * @returns 
 */
export async function createDocWithMdAPI(notebookid, hpath, md) {
    let url = "/api/filetree/createDocWithMd";
    let response = await postRequest({"notebook": notebookid, "path": hpath, "markdown": md}, url);
    if (response.code == 0 && response.data != null) {
        return response.data.id;
    }
    return null;
}

/**
 * 
 * @param {*} notebookid 
 * @param {*} path 待创建的新文档path，即，最后应当为一个随机的id.sy
 * @param {*} title 【可选】文档标题
 * @param {*} contentMd 【可选】markdown格式的内容
 * @returns 
 */
export async function createDocWithPath(notebookid, path, title = "Untitled", contentMd = "", listDocTree=false) {
    let url = "/api/filetree/createDoc";
    let response = await postRequest({"notebook": notebookid, "path": path, "md": contentMd, "title": title, "listDocTree": listDocTree}, url);
    if (response.code == 0) {
        return true;
    }
    logPush("responseERROR", response);
    throw Error(response.msg);
    return false;
}

/**
 * 将对象保存为JSON文件
 * @param {*} path 
 * @param {*} object 
 * @param {boolean} format
 * @returns 
 */
export async function putJSONFile(path, object, format = false) {
    const url = "/api/file/putFile";
    const pathSplited = path.split("/");
    let fileContent = "";
    if (format) {
        fileContent = JSON.stringify(object, null, 4);
    } else {
        fileContent = JSON.stringify(object);
    }
    // File的文件名实际上无关，但这里考虑到兼容，将上传文件按照路径进行了重命名
    const file = new File([fileContent], pathSplited[pathSplited.length - 1], {type: "text/plain"});
    const data = new FormData();
    data.append("path", path);
    data.append("isDir", "false");
    data.append("modTime", new Date().valueOf().toString());
    data.append("file", file);
    return fetch(url, {
        body: data,
        method: 'POST',
        headers: {
            "Authorization": "Token "+ getToken()
        }
    }).then((response) => {
        return response.json();
    });
}

/**
 * 从JSON文件中读取对象
 * @param {*} path 
 * @returns 
 */
export async function getJSONFile(path) {
    const url = "/api/file/getFile";
    let response = await postRequest({"path": path}, url);
    if (response.code == 404) {
        return null;
    }
    return response;
}

export async function getFileAPI(path) {
    const url = "/api/file/getFile";
    let data = {"path": path};
    let result;
    let response = await fetch(url, {
        body: JSON.stringify(data),
        method: 'POST',
        headers: {
            "Authorization": "Token "+ getToken(),
            "Content-Type": "application/json"
        }
    });
    result = await response.text();
    try {
        let jsonresult = JSON.parse(result);
        if (jsonresult.code == 404) {
            return null;
        }
        return result;
    } catch(err) {

    }
    return result;
}

/**
 * 获取工作空间中的文件，部分情况下返回blob
 * @param path 文件路径
 * @returns json内容或blob
 */
export async function getFileAPIv2(path:string) {
    const url = "/api/file/getFile";
    const data = { path };
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            "Authorization": "Token " + getToken(),
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    const contentType = response.headers.get("Content-Type") || "";

    if (contentType.includes("application/json")) {
        const json = await response.json();
        if (json.code === 404) {
            return null;
        }
        return json;
    } else {
        // 如果是文件，返回二进制 blob
        const blob = await response.blob();
        return blob;
    }
}

/**
 * 列出工作空间下的文件
 * @param {*} path  例如"/data/20210808180117-6v0mkxr/20200923234011-ieuun1p.sy"
 * @returns isDir, isSymlink, name三个属性
 */
export async function listFileAPI(path) {
    const url = "/api/file/readDir";
    let response = await postRequest({"path": path}, url);
    if (response.code == 0) {
        return response.data;
    }
    return [];
}

export async function removeFileAPI(path) {
    const url = "/api/file/removeFile";
    let response = await postRequest({"path": path}, url);
    if (response.code == 0) {
        return true;
    } else {
        return false;
    }
}

export async function getDocInfo(id) {
    let data = {
        "id": id
    };
    let url = `/api/block/getDocInfo`;
    return getResponseData(postRequest(data, url));
}

/**
 * 反向链接面板用的API（标注有T，该API不是正式API）
 * @param id 
 * @param sort 反链结果排序方式 字母0/1、自然4/5创建9/10，修改2/3
 * @param msort 
 * @param k 
 * @param mk 看起来是提及部分的关键词
 * @returns 
 */
export async function getBackLink2T(id, sort = "3", msort= "3", k = "", mk = "") {
    let data = {
        "id": id,
        "sort": sort,
        "msort": msort,
        "k": k,
        "mk": mk
    };
    let url = `/api/ref/getBacklink2`;
    return getResponseData(postRequest(data, url));
}

export async function getTreeStat(id:string) {
    let data = {
        "id": id
    };
    let url = `/api/block/getTreeStat`;
    return getResponseData(postRequest(data, url));
}

let isMobileRecentResult = null;
export function isMobile() {
    if (isMobileRecentResult != null) {
        return isMobileRecentResult;
    }
    if (window.top.document.getElementById("sidebar")) {
        isMobileRecentResult = true;
        return true;
    } else {
        isMobileRecentResult = false;
        return false;
    }
};

export function getBlockBreadcrumb(blockId: string, excludeTypes: string[] = []) {
    let data = {
        "id": blockId,
        "excludeTypes": excludeTypes
    };
    let url = `/api/block/getBlockBreadcrumb`;
    return getResponseData(postRequest(data, url));
}

export async function getHPathById(docId:string): Promise<string|undefined> {
    let data = {
        "id": docId
    }
    const url = "/api/filetree/getHPathByID";
    return getResponseData(postRequest(data, url)) as Promise<string|undefined>;
}

/**
 * 批量设置属性
 * @param {*} blockAttrs 数组，每一个元素为对象，包含 id 和 attrs两个属性值，attrs为对象，其属性和属性值即为 attr-key: attr-value
 * @ref https://github.com/siyuan-note/siyuan/issues/10337
 */
export async function batchSetBlockAtrs(blockAttrs: string) {
    let url = "/api/attr/batchSetBlockAttrs";
    let postBody = {
        blockAttrs: blockAttrs,
    };
    let response = await postRequest(postBody, url);
    if (response.code == 0 && response.data != null) {
        return response.data;
    }
    return null;
}

/**
 * 创建daily note
 * @param notebook 笔记本id
 * @param app appid
 * @returns dailynote id
 */
export async function createDailyNote(notebook:string, app: string) {
    const url = "/api/filetree/createDailyNote";
    let postBody = {
        app: app,
        notebook: notebook
    };
    let response = await postRequest(postBody, url);
    if (response.code == 0) {
        return response.data.id;
    } else {
        throw new Error("Create Dailynote Failed: " + response.msg);
    }
}

export async function fullTextSearchBlock({query, method = 0, paths = [], groupBy = 1, orderBy = 0, page = 1, types = DEFAULT_FILTER}:FullTextSearchQuery) {
    const url = "/api/search/fullTextSearchBlock";
    if (groupBy == 0 && orderBy == 5){
        orderBy = 0;
        warnPush("orderBy取值不合法，已被重置");
    }
    let postBody = {
        query,
        method,
        page,
        paths,
        groupBy,
        orderBy,
        types,
        pageSize: 10,
    }
    postBody["reqId"] = Date.now();
    let response = await postRequest(postBody, url);
    if (response.code == 0) {
        return response.data;
    } else {
        throw new Error("fullTextSearchBlock Failed: " + response.msg);
    }
}

export async function exportMdContent({id, refMode, embedMode, yfm}: ExportMdContentBody) {
    const url = "/api/export/exportMdContent";
    let postBody = {
        id,
        refMode,
        embedMode,
        yfm,
    }
    let response = await postRequest(postBody, url);
    if (response.code == 0) {
        return response.data;
    } else {
        throw new Error("exportMdContent Failed: " + response.msg);
    }
}
/**
 * 获得子块
 * @param id 块id或文档id
 * @returns 子块信息,数组，有id, type, subType, content, markdown字段
 */
export async function getChildBlocks(id:string) {
    const url = "/api/block/getChildBlocks";
    let postBody = {
        id
    }
    let response = await postRequest(postBody, url);
    if (response.code == 0) {
        return response.data;
    } else {
        throw new Error("getChildBlocks Failed: " + response.msg);
    }
}

export async function listDocTree(notebook:string, path:string) {
    const url = "/api/filetree/listDocTree";
    let postBody = {
        notebook,
        path
    }
    let response = await postRequest(postBody, url);
    if (response.code == 0) {
        return response.data.tree;
    } else {
        throw new Error("listDocTree Failed: " + response.msg);
    }
}

export const DOC_SORT_TYPES = {
    FILE_NAME_ASC: 0,
    FILE_NAME_DESC: 1,
    NAME_NAT_ASC: 4,
    NAME_NAT_DESC: 5,
    CREATED_TIME_ASC: 9,
    CREATED_TIME_DESC: 10,
    MODIFIED_TIME_ASC: 2,
    MODIFIED_TIME_DESC: 3,
    REF_COUNT_ASC: 7,
    REF_COUNT_DESC: 8,
    DOC_SIZE_ASC: 11,
    DOC_SIZE_DESC: 12,
    SUB_DOC_COUNT_ASC: 13,
    SUB_DOC_COUNT_DESC: 14,
    CUSTOM_SORT: 6,
    FOLLOW_DOC_TREE: 255, // 插件内部定义的”跟随文档树“
    FOLLOW_DOC_TREE_ORI: 15, // 官方对于”跟随文档树“的定义
    UNASSIGNED: 256,
};


export const DEFAULT_FILTER: BlockTypeFilter = {
    audioBlock: false,
    blockquote: false,
    codeBlock: true,
    databaseBlock: false,
    document: true,
    embedBlock: false,
    heading: true,
    htmlBlock: true,
    iframeBlock: false,
    list: false,
    listItem: false,
    mathBlock: true,
    paragraph: true,
    superBlock: false,
    table: true,
    videoBlock: false,
    widgetBlock: false
};
