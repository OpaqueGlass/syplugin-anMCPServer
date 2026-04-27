import { Dialog, confirm } from "siyuan";
import { setBlockPermission, setNotebookPermission } from "./permissionStorageHelper";
import { getBlockPermissionStatus, getNotebookPermissionStatus } from "../filterCheck";
import { PermissionBit } from "@/constants";
import { getBlockDBItem } from "@/syapi/custom";
import { showPluginMessage } from "../common";
import { getNotebookInfoLocallyF } from "@/syapi";
import { lang } from "../lang";


export async function showPermissionSetterDialog(ids: string[], isNotebook: boolean): Promise<void> {
    const isBatch = ids.length > 1;
    let permissionCode: number = 0;
    let permissionFromId: string = "";

    let targetName = "";

    // 获取权限状态（仅针对单个 ID）
    if (!isBatch) {
        const id = ids[0];
        if (isNotebook) {
            const status = await getNotebookPermissionStatus(id);
            const notebookInfo = await getNotebookInfoLocallyF(id);
            targetName = notebookInfo ? notebookInfo.name : "unknown";
            permissionCode = status.permissionCode;
            permissionFromId = status.permissionFromId;
        } else {
            const dbItem = await getBlockDBItem(id);
            if (!dbItem) {
                showPluginMessage(lang("permission_doc_not_exist"));
                return;
            }
            const status = await getBlockPermissionStatus(dbItem);
            targetName = dbItem.content;
            permissionCode = status.permissionCode;
            permissionFromId = status.permissionFromId;
        }
    }
    let permissionFromTypeText = "default";
    let permissionFromIdClean = permissionFromId;
    let jumpToPermissionSourceHtml = `<button class="b3-button b3-button--outline fn__flex-center" id='og-mcp-jumptosource'>${lang("permission_jump_to")}</button>`;
    if (permissionFromId.startsWith("D ")) {
        permissionFromTypeText = lang("permission_doc");
        permissionFromIdClean = permissionFromId.substring(2);
    } else if (permissionFromId.startsWith("N ")) {
        permissionFromTypeText = lang("permission_notebook");
        permissionFromIdClean = permissionFromId.substring(2);
    } else {
        jumpToPermissionSourceHtml = "";
    }
    if (permissionFromIdClean === ids[0]) {
        permissionFromTypeText = lang("permission_itself");
        jumpToPermissionSourceHtml = "";
    }

    // 构建对话框信息部分
    const headerHtml = isBatch 
        ? `<div style="margin-bottom: 16px; padding: 8px; background: var(--b3-theme-surface-light); border-radius: 4px;">
             ${lang("permission_batch_operation").replace("{count}", ids.length)}
           </div>`
        : `<div style="margin-bottom: 16px; font-size: 0.9em; opacity: 0.8; line-height: 1.6;">
             <div>id: <code style="word-break: break-all;">${ids[0]}</code></div>
             <div>${lang("permission_name")}：${targetName}</div>
             <div>${lang("permission_inherit_from")}: ${permissionFromTypeText} ${permissionFromIdClean} ${jumpToPermissionSourceHtml} </div>
             <div>${lang("permission_cur_per_code")}: <b class="ft__highlight">${permissionCode}</b></div>
           </div>`;

    const dialog = new Dialog({
        title: `${lang("permission_mcp_dialog_title")} ${isBatch ? '' : targetName}`,
        content: `
<div class="b3-dialog__content" style="padding: 20px;">
    ${headerHtml}

    <div class="fn__hr"></div>

    <div style="display: flex; gap: 20px; margin: 20px 0;">
        <label class="fn__flex"><input type="checkbox" class="b3-switch" id="og-mcp-p-read" ${(!isBatch && (permissionCode & PermissionBit.Read)) ? 'checked' : ''}> <span style="margin-left:8px">${lang("permission_r")}</span></label>
        <label class="fn__flex"><input type="checkbox" class="b3-switch" id="og-mcp-p-write" ${(!isBatch && (permissionCode & PermissionBit.Write)) ? 'checked' : ''}> <span style="margin-left:8px">${lang("permission_w")}</span></label>
        <label class="fn__flex"><input type="checkbox" class="b3-switch" id="og-mcp-p-admin" ${(!isBatch && (permissionCode & PermissionBit.Destructive)) ? 'checked' : ''}> <span style="margin-left:8px">${lang("permission_d")}</span></label>
    </div>

    <div class="b3-dialog__action">
        <button class="b3-button b3-button--error fn__flex-center" id="og-mcp-btn-delete">${lang("permission_delete_itself")}</button>
        <div class="fn__flex-1"></div>
        <button class="b3-button b3-button--cancel" id="og-mcp-btn-cancel">${lang("history_msg_clean_cancel")}</button>
        <div class="fn__space"></div>
        <button class="b3-button b3-button--main" id="og-mcp-btn-save">${lang("apply")}</button>
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
        const msg = (isBatch ? lang("permission_confirm_delete_batch").replace('{count}', ids.length) : lang("permission_confirm_delete").replace('{name}', targetName)) + " " + lang("permission_confirm_delete_desp");
        confirm(lang("permission_confirm_delete_title"), msg, async () => {
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

    contentElement.querySelector("#og-mcp-jumptosource")?.addEventListener("click", () => {
        if (permissionFromId.startsWith("D ")) {
            const blockId = permissionFromId.substring(2);
            showPermissionSetterDialog([blockId], false);
        } else if (permissionFromId.startsWith("N ")) {
            const notebookId = permissionFromId.substring(2);
            showPermissionSetterDialog([notebookId], true);
        }
        dialog.destroy();
    });
}