<template>
  <div class="task-history">
    <h2>任务历史记录</h2>
    <el-table :data="tasks" style="width: 100%" v-loading="loading">
      <el-table-column prop="id" label="任务ID" width="80" />
      <el-table-column prop="taskType" label="类型" width="120" />
      <el-table-column prop="modifiedId" label="修改内容ID" width="180" />
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
            @click="openDoc(row.modifiedId)"
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
      <el-table-column prop="content" label="修改内容" />
    </el-table>
  </div>
</template>

<script setup lang="ts" >
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { taskManager } from '../utils/historyTaskHelper'; // 请根据你的文件路径调整

const tasks = ref([]);
const loading = ref(true);

const TASK_STATUS = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: -1,
};

// 获取所有任务并更新列表
const fetchTasks = async () => {
  loading.value = true;
  await taskManager.init();
  tasks.value = taskManager.listAll();
  loading.value = false;
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
 * @param {string} docId - 文档的唯一ID
 */
const openDoc = (docId) => {
  console.log(`正在打开文档，ID为: ${docId}`);
  // TODO: 在这里实现你的具体跳转或弹窗逻辑
  // 例如: router.push({ name: 'DocumentDetail', params: { id: docId } });
  // 或者: showDocumentModal(docId);
  ElMessage.success(`已触发查看文档操作，ID为: ${docId}`);
};

/**
 * 处理批准或拒绝任务的逻辑
 * @param {number} taskId - 任务ID
 * @param {string} action - 'solve' 或 'reject'
 */
const handleAction = async (taskId, action) => {
  try {
    if (action === 'solve') {
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