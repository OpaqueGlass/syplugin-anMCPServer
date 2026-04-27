<template>
  <div :class="{'task-history': true, 'dark': darkModeFlag, 'container': true}">

    <el-button link type="primary" @click="refreshDict">{{ lang("refresh") }}</el-button>
    <section class="table-section">
      <h3>{{ lang("permission_blocks") }}</h3>
      <div class="toolbar">
        <el-button type="danger" @click="clearInvalidIds(true)" :loading="loading">{{lang("permission_clean")}}</el-button>
      </div>
      
      <el-table :data="pagedBlockData" style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="ID" width="180" />
        <el-table-column prop="name" :label="lang('permission_name')" />
        <el-table-column :label="lang('permission_permission') + ' (R/W/D)'">
          <template #default="scope">
            <el-tag :type="scope.row.r ? 'success' : 'info'">R</el-tag>
            <el-tag :type="scope.row.w ? 'warning' : 'info'" class="mx-1">W</el-tag>
            <el-tag :type="scope.row.d ? 'danger' : 'info'">D</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="lang('permission_operation')" width="150">
          <template #default="scope">
            <el-button link type="primary" @click="handleEdit([scope.row.id], false)">{{ lang("permission_edit") }}</el-button>
            <el-button link type="danger" @click="handleDelete(scope.row.id, true)">{{ lang("permission_delete") }}</el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <el-pagination
        v-model:current-page="blockPage.currentPage"
        :page-size="blockPage.pageSize"
        layout="prev, pager, next"
        :total="blockDataList.length"
        class="mt-4"
      />
    </section>

    <el-divider />

    <section class="table-section">
      <h3>{{lang('permission_notebooks')}}</h3>
      <div class="toolbar">
        <el-button type="danger" @click="clearInvalidIds(false)" :loading="loading">{{ lang('permission_clean') }}</el-button>
      </div>

      <el-table :data="notebookDataList" style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="ID" width="180" />
        <el-table-column prop="name" :label="lang('permission_name')" />
        <el-table-column :label="lang('permission_permission') + '(R/W/D)'">
          <template #default="scope">
            <el-tag :type="scope.row.r ? 'success' : 'info'">R</el-tag>
            <el-tag :type="scope.row.w ? 'warning' : 'info'" class="mx-1">W</el-tag>
            <el-tag :type="scope.row.d ? 'danger' : 'info'">D</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="lang('permission_operation')" width="150">
          <template #default="scope">
            <el-button link type="primary" @click="handleEdit([scope.row.id], true)">{{ lang('permission_edit') }}</el-button>
            <el-button link type="danger" @click="handleDelete(scope.row.id, false)">{{ lang('permission_delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { isDarkMode, getNotebookInfoLocallyF  } from '@/syapi';
import { getBlockDBItem } from '@/syapi/custom';
import { showPluginMessage } from '@/utils/common';
import { JSONStorage } from '@/utils/jsonStorageUtil';
import { lang } from '@/utils/lang';
import { showPermissionSetterDialog } from '@/utils/permission/permissionDialogHelper';
import { useBlockPermissionJsonStorage, useNotebookPermissionJsonStorage } from '@/utils/permission/permissionStorageHelper';
import { ref, computed, onMounted, reactive } from 'vue';

// --- 类型定义 ---
interface PermissionItem {
  id: string;
  name: string;
  r: boolean;
  w: boolean;
  d: boolean;
  rawCode: number;
}

// --- 状态与存储 ---
let blockPermissionJsonStorage: JSONStorage<any> | null = null;
let notebookPermissionJsonStorage: JSONStorage<any> | null = null;

const blockDataList = ref<PermissionItem[]>([]);
const notebookDataList = ref<PermissionItem[]>([]);
const loading = ref(false);
const darkModeFlag = ref(isDarkMode());

// 分页状态
const blockPage = reactive({
  currentPage: 1,
  pageSize: 10
});

// --- 计算属性: 分页后的 Block 数据 ---
const pagedBlockData = computed(() => {
  const start = (blockPage.currentPage - 1) * blockPage.pageSize;
  return blockDataList.value.slice(start, start + blockPage.pageSize);
});

// --- 核心方法 ---

/**
 * 解析权限码 (十进制转 R4 W2 D1)
 */
const parsePermission = (code: number) => {
  return {
    r: (code & 4) !== 0,
    w: (code & 2) !== 0,
    d: (code & 1) !== 0
  };
};

/**
 * 刷新并解析数据
 */
const refreshDict = async function() {
  loading.value = true;
  try {
    const blockDict = await blockPermissionJsonStorage!.getAll();
    const notebookDict = await notebookPermissionJsonStorage!.getAll();

    // 并行处理 Block 列表
    blockDataList.value = await Promise.all(
      Object.keys(blockDict).map(async (id) => {
        const item = await getBlockDBItem(id);
        return {
          id,
          name: item?.content || '',
          ...parsePermission(blockDict[id]),
          rawCode: blockDict[id]
        };
      })
    );

    // 并行处理 Notebook 列表
    notebookDataList.value = await Promise.all(
      Object.keys(notebookDict).map(async (id) => {
        const info = await getNotebookInfoLocallyF(id);
        return {
          id,
          name: info?.name || '',
          ...parsePermission(notebookDict[id]),
          rawCode: notebookDict[id]
        };
      })
    );
  } finally {
    loading.value = false;
  }
};

/**
 * 编辑操作
 */
const handleEdit = (ids: string[], isNotebook: boolean) => {
  showPermissionSetterDialog(ids, isNotebook);
  // 通常对话框关闭后可能需要刷新，这里视 showPermissionSetterDialog 是否支持回调而定
};

/**
 * 单项删除
 */
const handleDelete = async (id: string, isBlock: boolean) => {
  const storage = isBlock ? blockPermissionJsonStorage : notebookPermissionJsonStorage;
  await storage!.set(id, undefined);
  await refreshDict();
};

/**
 * 批量清理无效 ID (名称为空的项)
 */
const clearInvalidIds = async (isBlock: boolean) => {
  const list = isBlock ? blockDataList.value : notebookDataList.value;
  const storage = isBlock ? blockPermissionJsonStorage : notebookPermissionJsonStorage;
  
  const invalidIds = list.filter(item => !item.name).map(item => item.id);
  
  if (invalidIds.length === 0) {
    showPluginMessage("没有发现无效 ID");
    return;
  }

  loading.value = true;
  for (const id of invalidIds) {
    await storage!.set(id, undefined);
  }
  await refreshDict();
};

onMounted(async () => {
  blockPermissionJsonStorage = await useBlockPermissionJsonStorage();
  notebookPermissionJsonStorage = await useNotebookPermissionJsonStorage();
  await refreshDict();
});
</script>

<style scoped>
.container { padding: 20px; }
.table-section { margin-bottom: 40px; }
.toolbar { margin-bottom: 15px; }
.mx-1 { margin-left: 4px; margin-right: 4px; }
.mt-4 { margin-top: 16px; }
/* .dark { background-color: #1d1d1d; color: #fff; } */
</style>