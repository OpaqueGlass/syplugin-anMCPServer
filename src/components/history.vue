<template>
  <div :class="{'task-history': true, 'dark': darkModeFlag}">
    <h2>{{ lang("history_title") }}</h2>
    <div style="margin-bottom: 12px; display: flex; gap: 12px; align-items: center;">
      <el-button size="small" type="primary" @click="toggleShowAll">{{ showAll ? lang("history_btn_pending") : lang("history_btn_all") }}</el-button>
      <el-button size="small" type="danger" @click="rejectAll">{{ lang("history_btn_reject_all") }}</el-button>
      <el-button size="small" type="success" @click="approveAll">{{ lang("history_btn_approve_all") }}</el-button>
      <el-button size="small" type="warning" @click="cleanTasks">{{ lang("history_btn_clean") }}</el-button>
      <span>{{ lang("history_sort") }}：</span>
      <el-radio-group v-model="sortOrder" @change="refreshTasks">
        <el-radio-button label="desc">{{ lang("history_sort_desc") }}</el-radio-button>
        <el-radio-button label="asc">{{ lang("history_sort_asc") }}</el-radio-button>
      </el-radio-group>
    </div>
    <el-table :data="tasks" style="width: 100%" v-loading="loading">
      <el-table-column prop="id" :label="lang('history_col_id')" width="80" />
      <el-table-column prop="taskType" :label="lang('history_col_type')" width="120" />
      <el-table-column :label="lang('history_col_objid')" width="180">
        <template #default="{ row }">
          <div>
            <span v-for="id in limitedIds(row.modifiedIds)" :key="id" style="margin-right: 4px;">
              <el-tag size="small" @click.stop="openSingleDoc(id)" style="cursor:pointer;">{{ id }}</el-tag>
            </span>
            <span v-if="row.modifiedIds.length > 5">
              <el-tag size="small" type="info" style="cursor:pointer;" @click.stop="showAllIds(row.modifiedIds)">+{{ row.modifiedIds.length - 5 }} {{ lang('history_more') }}</el-tag>
            </span>
          </div>
        </template>
      </el-table-column>
      <el-table-column :label="lang('history_col_status')" width="100">
        <template #default="{ row }">
          <el-tag
            :type="getStatusType(row.status)"
            effect="dark"
          >
            {{ getStatusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="lang('history_col_created')" width="180">
        <template #default="{ row }">
          {{ new Date(row.createdAt).toLocaleString() }}
        </template>
      </el-table-column>
      <el-table-column :label="lang('history_col_action')" width="200">
        <template #default="{ row }">
          <el-button
            size="small"
            type="primary"
            v-if="row.status === 0"
            @click="diffDocs(row.modifiedIds, row.id)"
          >
            {{ lang('history_btn_view') }}
          </el-button>
          <el-button
            v-if="row.status === 0"
            size="small"
            type="success"
            @click="handleAction(row.id, 'solve')"
          >
            {{ lang('history_btn_approve') }}
          </el-button>
          <el-button
            v-if="row.status === 0"
            size="small"
            type="danger"
            @click="handleAction(row.id, 'reject')"
          >
            {{ lang('history_btn_reject') }}
          </el-button>
        </template>
      </el-table-column>
      <el-table-column :label="lang('history_col_content')">
        <template #default="{ row }">
          <span>
            {{ getShortContent(row.content) }}
            <el-link v-if="isContentLong(row.content)" type="primary" @click.stop="showFullContent(row.content)" style="margin-left:8px;">{{ lang('history_dialog_fullcontent') }}</el-link>
          </span>
        </template>
      </el-table-column>
    </el-table>
    <el-dialog
      v-model="dialogVisible"
      :title="lang('history_dialog_diff')"
      width="70vw"
      higth="60vh"
    >
      <CodeDiff
        :old-string="diffOldValue"
        :new-string="diffNewValue"
        :output-format="diffFormat"
        :theme="darkModeFlag ? 'dark' : 'light'"
      />
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">{{ lang('history_dialog_close') }}</el-button>
        </div>
      </template>
    </el-dialog>
    <el-dialog
      v-model="cleanDialogVisible"
      :title="lang('history_msg_clean_title')"
    >
      <div>
        <p>{{ lang('history_msg_clean_prompt') }}</p>
        <el-input v-model="cleanDays" :placeholder="lang('history_msg_clean_placeholder')" />
      </div>
      <template #footer>
        <el-button @click="cleanDialogVisible = false">{{ lang('history_msg_clean_cancel') }}</el-button>
        <el-button type="primary" @click="confirmClean">{{ lang('history_msg_clean_confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" >
import { ref, onMounted } from 'vue';
import { taskManager } from '../utils/historyTaskHelper'; // 请根据你的文件路径调整
import { Constants, Dialog, openTab } from 'siyuan';
import { getPluginInstance } from '@/utils/pluginHelper';
import { getKramdown, isDarkMode } from '@/syapi';
import { CodeDiff } from 'v-code-diff';
import { lang } from '@/utils/lang';
import { auditRedo } from '@/audit/auditRedoer';
import { showPluginMessage } from '@/utils/common';
import { getBlockDBItem } from '@/syapi/custom';
import { CONSTANTS } from '@/constants';

const tasks = ref([]);
const loading = ref(true);
const showAll = ref(false);
const sortOrder = ref('desc');

const darkModeFlag = ref(isDarkMode())

const dialogVisible = ref(false);
const diffFormat = ref("side-by-side")

const diffOldValue = ref("")
const diffNewValue = ref("")

const MAX_CONTENT_LENGTH = 60;
const fullContent = ref('');

const TASK_STATUS = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: -1,
};

const limitedIds = (ids: string[]) => ids.slice(0, 5);

// 获取任务并更新列表
const fetchTasks = async () => {
  loading.value = true;
  if (showAll.value) {
    tasks.value = taskManager.listAll(sortOrder.value);
  } else {
    tasks.value = taskManager.list(sortOrder.value);
  }
  loading.value = false;
};

const refreshTasks = () => {
  fetchTasks();
};

const toggleShowAll = () => {
  showAll.value = !showAll.value;
  fetchTasks();
};

// 根据状态码返回标签类型
const getStatusType = (status) => {
  switch (status) {
    case TASK_STATUS.PENDING:
      return 'info';
    case TASK_STATUS.APPROVED:
      return 'success';
    case TASK_STATUS.REJECTED:
      return 'danger';
    default:
      return '';
  }
};

// 根据状态码返回文本
const getStatusText = (status) => {
  switch (status) {
    case TASK_STATUS.PENDING:
      return lang('history_status_pending');
    case TASK_STATUS.APPROVED:
      return lang('history_status_approved');
    case TASK_STATUS.REJECTED:
      return lang('history_status_rejected');
    default:
      return lang('history_status_unknown');
  }
};

/**
 * 单个ID点击打开文档
 * @param {string} docId - 文档的唯一ID
 */
const openSingleDoc = async (docId: string) => {
  if (!await getBlockDBItem(docId)) {
    showPluginMessage(lang("message_id_not_exist"));
    return;
  }
  openTab({
    app: getPluginInstance().app,
    doc: { 
      id: docId,
      action: [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL]
     }
  });
};
// 展示全部ID弹窗
const showAllIds = (ids: string[]) => {
  const syDialog = new Dialog({
    height: "40vh",
    title: lang("history_dialog_allids"),
    content: `<ul style='margin: 2em 3em; max-height: 100%; overflow-y: auto;'>${ids.map(id => `<li style='margin-bottom: 8px;'><span style='cursor:pointer;color:#409EFF;' onclick='window.og_mcp_openIdFromDialog && window.og_mcp_openIdFromDialog("${id}")'>${id}</span></li>`).join('')}</ul>`
  });
  // @ts-ignore
  window.og_mcp_openIdFromDialog = (id: string) => {
    openSingleDoc(id);
    syDialog.destroy();
  };
};

/**
 * 处理批准或拒绝任务的逻辑
 * @param {number} taskId - 任务ID
 * @param {string} action - 'solve' 或 'reject'
 */
const handleAction = async (taskId, action) => {
  try {
    if (action === 'solve') {
      await auditRedo(taskManager.getTask(taskId));
      await taskManager.solve(taskId);
      showPluginMessage(lang('history_msg_approve_success'), 6000);
    } else if (action === 'reject') {
      await taskManager.reject(taskId);
      showPluginMessage(lang('history_msg_reject_success'), 6000);
    }
    fetchTasks();
  } catch (error) {
    showPluginMessage(lang('history_msg_action_error'), 6000);
    console.error(lang('history_msg_action_error'), error);
  }
};

const getShortContent = (content: string) => {
  if (!content) return '';
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  return str.length > MAX_CONTENT_LENGTH ? str.slice(0, MAX_CONTENT_LENGTH) + '...' : str;
};

const isContentLong = (content: string) => {
  if (!content) return false;
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  return str.length > MAX_CONTENT_LENGTH;
};

const showFullContent = (content: string) => {
  fullContent.value = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  diffOldValue.value = "";
  diffNewValue.value = content;
  diffFormat.value = "line-by-line";
  dialogVisible.value = true;
};

const diffDocs = async (modifiedIds, taskId) => {
  const blockId = modifiedIds[0];
  const oriContent = await getKramdown(blockId);
  const newContent = taskManager.getTask(taskId);
  diffOldValue.value = oriContent;
  diffNewValue.value = newContent["content"];
  diffFormat.value = "side-by-side";
  dialogVisible.value = true;
}

const rejectAll = async () => {
  try {
    for (let task of tasks.value) {
      if (task.status !== TASK_STATUS.PENDING) continue;
      await handleAction(task.id, 'reject');
    }
    showPluginMessage(lang("history_msg_reject_all_success"));
    fetchTasks();
  } catch (error) {
    showPluginMessage(lang("history_msg_reject_all_error"), 6000, 'error');
    console.error(error);
  }
};

const approveAll = async () => {
  try {
    for (let task of tasks.value) {
      if (task.status !== TASK_STATUS.PENDING) continue;
      await handleAction(task.id, 'solve');
    }
    showPluginMessage(lang("history_msg_approve_all_success"));
    fetchTasks();
  } catch (error) {
    showPluginMessage(lang("history_msg_approve_all_error"), 6000, 'error');
    console.error(error);
  }
};

const cleanDialogVisible = ref(false);
const cleanDays = ref('');

const confirmClean = async () => {
  try {
    const days = parseInt(cleanDays.value);
    if (isNaN(days) || days <= 0) {
      showPluginMessage(lang('history_msg_clean_invalid'));
      return;
    }
    cleanDialogVisible.value = false;
    await taskManager.clean(days, true);
    showPluginMessage(lang('history_msg_clean_success'));
    fetchTasks();
  } catch (error) {
    showPluginMessage(lang('history_msg_clean_error'));
    console.error(error);
  }
};

const cleanTasks = () => {
  cleanDialogVisible.value = true;
};

// 组件挂载时加载数据
onMounted(() => {
  fetchTasks();
});
</script>

<style scoped>
.task-history {
  padding: 20px;
}
</style>