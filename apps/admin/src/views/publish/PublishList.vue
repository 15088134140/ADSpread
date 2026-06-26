<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>发布管理</span>
          <div>
            <el-button type="success" :disabled="selectedIds.length === 0" @click="handleBatchPush">批量推送</el-button>
            <el-button type="primary" @click="openCreate">创建发布计划</el-button>
          </div>
        </div>
      </template>

      <el-form :inline="true" :model="query">
        <el-form-item label="关键词">
          <el-input v-model="query.keyword" placeholder="计划名称" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 140px">
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchData">查询</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="list" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="name" label="计划名称" />
        <el-table-column label="节目">
          <template #default="{ row }">{{ row.program?.name || row.programId }}</template>
        </el-table-column>
        <el-table-column label="目标门店" min-width="200">
          <template #default="{ row }">
            <div v-if="row.targetStores && row.targetStores.length" class="store-list">
              <div v-for="store in row.targetStores" :key="store.id" class="store-item">
                <span class="store-name">{{ store.name }}</span>
                <span class="store-count">{{ store.deviceCount }}台</span>
              </div>
            </div>
            <span v-else class="empty-text">-</span>
          </template>
        </el-table-column>
        <el-table-column label="开始时间">
          <template #default="{ row }">{{ formatDateTime(row.startTime) }}</template>
        </el-table-column>
        <el-table-column label="结束时间">
          <template #default="{ row }">{{ row.endTime ? formatDateTime(row.endTime) : '永久' }}</template>
        </el-table-column>
        <el-table-column label="播放周期">
          <template #default="{ row }">{{ formatPlayDays(row.playDays) }}</template>
        </el-table-column>
        <el-table-column label="状态">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最后推送">
          <template #default="{ row }">{{ formatDateTime(row.lastPushedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="240">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="success" @click="handlePush(row)">推送</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          layout="total, sizes, prev, pager, next"
          :total="total"
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          @change="fetchData"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑发布计划' : '创建发布计划'" width="640px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="计划名称" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="节目" prop="programId">
          <el-select v-model="form.programId" placeholder="请选择已发布节目" style="width: 100%" filterable>
            <el-option v-for="item in programOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标门店" prop="targetStoreIds">
          <el-select v-model="form.targetStoreIds" placeholder="请选择门店" style="width: 100%" multiple filterable>
            <el-option v-for="item in storeOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始时间" prop="startTime">
          <el-date-picker v-model="form.startTime" type="datetime" placeholder="选择开始时间" style="width: 100%" value-format="YYYY-MM-DDTHH:mm:ss.000Z" />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker v-model="form.endTime" type="datetime" placeholder="选择结束时间" style="width: 100%" value-format="YYYY-MM-DDTHH:mm:ss.000Z" />
        </el-form-item>
        <el-form-item label="播放周期" prop="playDays">
          <el-select v-model="form.playDays" placeholder="请选择播放周期" style="width: 100%" multiple>
            <el-option v-for="item in playDayOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态"><el-switch v-model="form.status" :active-value="1" :inactive-value="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { publishApi, type PublishPlan } from '@/api/publish';
import { programApi, type Program } from '@/api/program';
import { storeApi } from '@/api/store';
import { dateUtils } from '@/utils/date';

const { formatDateTime } = dateUtils;

const playDayOptions = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 7 },
];

const loading = ref(false);
const list = ref<PublishPlan[]>([]);
const total = ref(0);
const selectedIds = ref<number[]>([]);
const programOptions = ref<Program[]>([]);
const storeOptions = ref<{ id: number; name: string; code: string }[]>([]);

const query = reactive({
  keyword: '',
  status: undefined as number | undefined,
  page: 1,
  pageSize: 20,
});

const dialogVisible = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({
  id: 0,
  name: '',
  programId: undefined as number | undefined,
  targetStoreIds: [] as number[],
  startTime: '',
  endTime: '',
  playDays: [] as number[],
  status: 1,
});

const rules: FormRules = {
  name: [{ required: true, message: '请输入计划名称', trigger: 'blur' }],
  programId: [{ required: true, message: '请选择节目', trigger: 'change' }],
  targetStoreIds: [{ required: true, type: 'array', min: 1, message: '请选择目标门店', trigger: 'change' }],
  startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  playDays: [{ required: true, type: 'array', min: 1, message: '请选择播放周期', trigger: 'change' }],
};

function formatPlayDays(days: number[]): string {
  if (!days || !days.length) return '-';
  return days.map((d) => playDayOptions.find((o) => o.value === d)?.label || d).join('、');
}

async function fetchData() {
  loading.value = true;
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize };
    if (query.keyword) params.keyword = query.keyword;
    if (typeof query.status === 'number') params.status = query.status;
    const result = await publishApi.getList(params as any);
    list.value = result.list;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

async function loadOptions() {
  const [programs, stores] = await Promise.all([
    programApi.getList({ status: 1, page: 1, pageSize: 100 }),
    storeApi.getOptions(),
  ]);
  programOptions.value = programs.list;
  storeOptions.value = stores;
}

function resetQuery() {
  query.keyword = '';
  query.status = undefined;
  query.page = 1;
  fetchData();
}

function handleSelectionChange(rows: PublishPlan[]) {
  selectedIds.value = rows.map((r) => r.id);
}

function resetForm() {
  form.id = 0;
  form.name = '';
  form.programId = undefined;
  form.targetStoreIds = [];
  form.startTime = '';
  form.endTime = '';
  form.playDays = [];
  form.status = 1;
}

function openCreate() {
  resetForm();
  loadOptions();
  dialogVisible.value = true;
}

function openEdit(row: PublishPlan) {
  form.id = row.id;
  form.name = row.name;
  form.programId = row.programId;
  form.targetStoreIds = [...(row.targetStoreIds || [])];
  form.startTime = row.startTime;
  form.endTime = row.endTime || '';
  form.playDays = [...(row.playDays || [])];
  form.status = row.status;
  loadOptions();
  dialogVisible.value = true;
}

async function submitForm() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    try {
      const data = {
        name: form.name,
        programId: form.programId as number,
        targetStoreIds: form.targetStoreIds,
        startTime: form.startTime,
        endTime: form.endTime || undefined,
        playDays: form.playDays,
        status: form.status,
      };
      if (form.id) {
        await publishApi.update(form.id, data);
        ElMessage.success('更新成功');
      } else {
        await publishApi.create(data);
        ElMessage.success('创建成功');
      }
      dialogVisible.value = false;
      fetchData();
    } catch {
      // handled by interceptor
    }
  });
}

async function handlePush(row: PublishPlan) {
  try {
    await ElMessageBox.confirm(`确定要推送计划 "${row.name}" 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'success',
    });
    const result = await publishApi.push(row.id);
    ElMessage.success(`推送成功，目标设备数：${result.targetDeviceCount}，推送记录ID：${result.pushLogId}`);
    fetchData();
  } catch {
    // cancelled
  }
}

async function handleBatchPush() {
  try {
    await ElMessageBox.confirm(`确定要批量推送 ${selectedIds.value.length} 个计划吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'success',
    });
    await publishApi.batchPush(selectedIds.value);
    ElMessage.success('批量推送完成');
    fetchData();
  } catch {
    // cancelled
  }
}

async function handleDelete(row: PublishPlan) {
  try {
    await ElMessageBox.confirm(`确定要删除计划 "${row.name}" 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await publishApi.delete(row.id);
    ElMessage.success('删除成功');
    fetchData();
  } catch {
    // cancelled
  }
}

onMounted(() => {
  fetchData();
});
</script>

<style scoped>
.page-container {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.store-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  line-height: 1.6;
}

.store-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.store-name {
  font-size: 13px;
  color: #303133;
}

.store-count {
  font-size: 12px;
  color: #909399;
}

.store-count::before {
  content: '·';
  margin-right: 4px;
  color: #c0c4cc;
}

.empty-text {
  color: #c0c4cc;
}
</style>
