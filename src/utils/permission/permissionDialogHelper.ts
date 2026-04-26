import { Dialog, confirm } from "siyuan";
import { setBlockPermission, setNotebookPermission } from "./permissionStorageHelper";
import { getBlockPermissionStatus, getNotebookPermissionStatus } from "../filterCheck";
import { PermissionBit } from "@/constants";
import { getBlockDBItem } from "@/syapi/custom";
import { showPluginMessage } from "../common";
import { getNotebookInfoLocallyF } from "@/syapi";


export async function showPermissionSetterDialog(ids: string[], isNotebook: boolean): Promise<void> {
    const isBatch = ids.length > 1;
    let permissionCode: number = 0;
    let permissionFromId: string = "";

    let docName = "";

    // 获取权限状态（仅针对单个 ID）
    if (!isBatch) {
        const id = ids[0];
        if (isNotebook) {
            const status = await getNotebookPermissionStatus(id);
            const notebookInfo = await getNotebookInfoLocallyF(id);
            docName = notebookInfo ? notebookInfo.name : "未知笔记本";
            permissionCode = status.permissionCode;
            permissionFromId = status.permissionFromId;
        } else {
            const dbItem = await getBlockDBItem(id);
            if (!dbItem) {
                showPluginMessage("文档不存在，无法打开权限设置对话框");
                return;
            }
            const status = await getBlockPermissionStatus(dbItem);
            docName = dbItem.content;
            permissionCode = status.permissionCode;
            permissionFromId = status.permissionFromId;
        }
    }

    // 构建对话框信息部分
    const headerHtml = isBatch 
        ? `<div style="margin-bottom: 16px; padding: 8px; background: var(--b3-theme-surface-light); border-radius: 4px;">
             <span class="ft__info">批量操作：</span> 正在对 <b class="ft__highlight">${ids.length}</b> 个文档进行权限设置
           </div>`
        : `<div style="margin-bottom: 16px; font-size: 0.9em; opacity: 0.8; line-height: 1.6;">
             <div>当前 ID: <code style="word-break: break-all;">${ids[0]}</code></div>
             <div>当前文档：${docName}</div>
             <div>权限来源: <span class="ft__info">${permissionFromId}</span></div>
             <div>当前代码: <b class="ft__highlight">${permissionCode}</b></div>
           </div>`;

    const dialog = new Dialog({
        title: `${isNotebook ? '笔记本' : '文档'} 权限设置 ${isBatch ? '(批量)' : ''}`,
        content: `
<div class="b3-dialog__content" style="padding: 20px;">
    ${headerHtml}

    <div class="fn__hr"></div>

    <div style="display: flex; gap: 20px; margin: 20px 0;">
        <label class="fn__flex"><input type="checkbox" class="b3-switch" id="og-mcp-p-read" ${(!isBatch && (permissionCode & PermissionBit.Read)) ? 'checked' : ''}> <span style="margin-left:8px">读取 (4)</span></label>
        <label class="fn__flex"><input type="checkbox" class="b3-switch" id="og-mcp-p-write" ${(!isBatch && (permissionCode & PermissionBit.Write)) ? 'checked' : ''}> <span style="margin-left:8px">写入 (2)</span></label>
        <label class="fn__flex"><input type="checkbox" class="b3-switch" id="og-mcp-p-admin" ${(!isBatch && (permissionCode & PermissionBit.Destructive)) ? 'checked' : ''}> <span style="margin-left:8px">破坏性修改 (1)</span></label>
    </div>

    <div class="b3-dialog__action">
        <button class="b3-button b3-button--error fn__flex-center" id="og-mcp-btn-delete">删除自定义权限</button>
        <div class="fn__flex-1"></div>
        <button class="b3-button b3-button--cancel" id="og-mcp-btn-cancel">取消</button>
        <div class="fn__space"></div>
        <button class="b3-button b3-button--main" id="og-mcp-btn-save">应用设置</button>
    </div>
</div>`,
        width: "480px",
    });

    const contentElement = dialog.element.querySelector(".b3-dialog__content");

    // 保存逻辑
    contentElement.querySelector("#og-mcp-btn-save").addEventListener("click", async () => {
        const r = (contentElement.querySelector("#og-mcp-p-read") as HTMLInputElement).checked ? PermissionBit.Read : 0;
        const w = (contentElement.querySelector("#og-mcp-p-write") as HTMLInputElement).checked ? PermissionBit.Write : 0;
        const a = (contentElement.querySelector("#og-mcp-p-admin") as HTMLInputElement).checked ? PermissionBit.Destructive : 0;
        
        const newCode = r | w | a;
        
        const promises = ids.map(id => 
            isNotebook ? setNotebookPermission(id, newCode) : setBlockPermission(id, newCode)
        );
        
        await Promise.all(promises);
        dialog.destroy();
    });

    // 删除逻辑
    contentElement.querySelector("#og-mcp-btn-delete").addEventListener("click", () => {
        const msg = (isBatch ? `确定要删除这 ${ids.length} 个文档或笔记本的自定义权限吗？` : "确定要删除该文档或笔记本的自定义权限吗？") + " 这将使它们继承上级或默认权限。";
        confirm("确认操作", msg, async () => {
            const promises = ids.map(id => 
                isNotebook ? setNotebookPermission(id, undefined) : setBlockPermission(id, undefined)
            );
            await Promise.all(promises);
            dialog.destroy();
            showPermissionSetterDialog(ids, isNotebook); // 刷新对话框以显示更新后的权限状态
        });
    });

    // 取消
    contentElement.querySelector("#og-mcp-btn-cancel").addEventListener("click", () => {
        dialog.destroy();
    });
}