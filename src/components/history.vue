<template>
  <div class="task-history">
    <h2>新增/修改类任务历史记录</h2>
    <div style="margin-bottom: 12px; display: flex; gap: 12px; align-items: center;">
      <el-button size="small" type="primary" @click="toggleShowAll">{{ showAll ? '只看待审' : '显示全部' }}</el-button>
      <span>排序：</span>
      <el-radio-group v-model="sortOrder" @change="refreshTasks">
        <el-radio-button label="desc">最新优先</el-radio-button>
        <el-radio-button label="asc">最早优先</el-radio-button>
      </el-radio-group>
    </div>
    <el-table :data="tasks" style="width: 100%" v-loading="loading">
      <el-table-column prop="id" label="任务ID" width="80" />
      <el-table-column prop="taskType" label="类型" width="120" />
      <el-table-column label="新增/修改对象ID" width="180">
        <template #default="{ row }">
          <div>
            <span v-for="(id, idx) in limitedIds(row.modifiedIds)" :key="id" style="margin-right: 4px;">
              <el-tag size="small" @click.stop="openSingleDoc(id)" style="cursor:pointer;">{{ id }}</el-tag>
            </span>
            <span v-if="row.modifiedIds.length > 5">
              <el-tag size="small" type="info" style="cursor:pointer;" @click.stop="showAllIds(row.modifiedIds)">+{{ row.modifiedIds.length - 5 }} 更多</el-tag>
            </span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag
            :type="getStatusType(row.status)"
            effect="dark"
          >
            {{ getStatusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">
          {{ new Date(row.createdAt).toLocaleString() }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button
            size="small"
            type="primary"
            @click="openDocs(row.modifiedIds)"
          >
            查看
          </el-button>
          <el-button
            v-if="row.status === 0"
            size="small"
            type="success"
            @click="handleAction(row.id, 'solve')"
          >
            批准
          </el-button>
          <el-button
            v-if="row.status === 0"
            size="small"
            type="danger"
            @click="handleAction(row.id, 'reject')"
          >
            拒绝
          </el-button>
        </template>
      </el-table-column>
      <el-table-column label="修改内容">
        <template #default="{ row }">
          <span>
            {{ getShortContent(row.content) }}
            <el-link v-if="isContentLong(row.content)" type="primary" @click.stop="showFullContent(row.content)" style="margin-left:8px;">查看全部</el-link>
          </span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts" >
import { ElMessageBox, ElDialog } from 'element-plus';
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { taskManager } from '../utils/historyTaskHelper'; // 请根据你的文件路径调整
import { openTab } from 'siyuan';
import { getPluginInstance } from '@/utils/pluginHelper';
import { auditRedo } from '@/audit/auditRedoer';

const tasks = ref([]);
const loading = ref(true);
const showAll = ref(false);
const sortOrder = ref('desc');

const MAX_CONTENT_LENGTH = 60;
const fullContentDialog = ref(false);
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
      return '待审阅';
    case TASK_STATUS.APPROVED:
      return '已批准';
    case TASK_STATUS.REJECTED:
      return '已拒绝';
    default:
      return '未知';
  }
};

/**
 * 处理打开文档的逻辑
 * @param {string[]} docIds - 文档的唯一ID数组
 */
const openDocs = (docIds: string[]) => {
  if (!Array.isArray(docIds)) return;
  openTab({
      app: getPluginInstance().app,
      doc: { id: docIds[0] }
  });
};

// 单个ID点击打开文档
const openSingleDoc = (docId: string) => {
  openTab({
    app: getPluginInstance().app,
    doc: { id: docId }
  });
};
// 展示全部ID弹窗
const showAllIds = (ids: string[]) => {
  ElMessageBox({
    title: '全部修改内容ID',
    message: ids.map(id => `<span style='margin-right:8px;cursor:pointer;color:#409EFF;' onclick='window.og_mcp_openIdFromDialog && window.og_mcp_openIdFromDialog("${id}")'>${id}</span>`).join(''),
    dangerouslyUseHTMLString: true,
    showCancelButton: false,
    confirmButtonText: '关闭',
    callback: () => {}
  });
  // @ts-ignore
  window.og_mcp_openIdFromDialog = (id: string) => {
    openSingleDoc(id);
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
      ElMessage.success('任务已批准');
    } else if (action === 'reject') {
      await taskManager.reject(taskId);
      ElMessage.info('任务已拒绝');
    }
    // 操作成功后刷新列表
    fetchTasks();
  } catch (error) {
    ElMessage.error('操作失败，请重试');
    console.error('任务操作失败:', error);
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
  ElMessageBox({
    title: '完整内容',
    message: `<pre style='white-space:pre-wrap;word-break:break-all;'>${fullContent.value.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>`,
    dangerouslyUseHTMLString: true,
    showCancelButton: false,
    confirmButtonText: '关闭',
    callback: () => {}
  });
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