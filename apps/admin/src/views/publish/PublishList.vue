<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ t('publish.title') }}</span>
          <div>
            <el-button type="success" :disabled="selectedIds.length === 0" @click="handleBatchPush">{{ t('publish.batchPush') }}</el-button>
            <el-button type="primary" @click="openCreate">{{ t('publish.createPlan') }}</el-button>
          </div>
        </div>
      </template>

      <el-form :inline="true" :model="query">
        <el-form-item :label="t('publish.search.keyword')">
          <el-input v-model="query.keyword" :placeholder="t('publish.search.keywordPlaceholder')" clearable />
        </el-form-item>
        <el-form-item :label="t('publish.search.status')">
          <el-select v-model="query.status" :placeholder="t('publish.search.all')" clearable style="width: 140px">
            <el-option :label="t('publish.status.enabled')" :value="1" />
            <el-option :label="t('publish.status.disabled')" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchData">{{ t('common.query') }}</el-button>
          <el-button @click="resetQuery">{{ t('common.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="list" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="name" :label="t('publish.table.name')" />
        <el-table-column :label="t('publish.table.program')">
          <template #default="{ row }">{{ row.program?.name || row.programId }}</template>
        </el-table-column>
        <el-table-column :label="t('publish.table.targetStores')" min-width="200">
          <template #default="{ row }">
            <div v-if="row.targetStores && row.targetStores.length" class="store-list">
              <div v-for="store in row.targetStores" :key="store.id" class="store-item">
                <span class="store-name">{{ store.name }}</span>
                <span class="store-count">{{ t('publish.table.storeDeviceCount', { count: store.deviceCount }) }}</span>
              </div>
            </div>
            <span v-else class="empty-text">-</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('publish.table.startTime')">
          <template #default="{ row }">{{ formatDateTime(row.startTime) }}</template>
        </el-table-column>
        <el-table-column :label="t('publish.table.endTime')">
          <template #default="{ row }">{{ row.endTime ? formatDateTime(row.endTime) : t('publish.table.permanent') }}</template>
        </el-table-column>
        <el-table-column :label="t('publish.table.playDays')">
          <template #default="{ row }">{{ formatPlayDays(row.playDays) }}</template>
        </el-table-column>
        <el-table-column :label="t('publish.table.status')">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? t('publish.status.enabled') : t('publish.status.disabled') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('publish.table.lastPushedAt')">
          <template #default="{ row }">{{ formatDateTime(row.lastPushedAt) }}</template>
        </el-table-column>
        <el-table-column :label="t('publish.table.operation')" width="240">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">{{ t('publish.table.edit') }}</el-button>
            <el-button link type="success" @click="handlePush(row)">{{ t('publish.table.push') }}</el-button>
            <el-button link type="danger" @click="handleDelete(row)">{{ t('publish.table.delete') }}</el-button>
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

    <el-dialog v-model="dialogVisible" :title="form.id ? t('publish.editPlan') : t('publish.createPlan')" width="640px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item :label="t('publish.form.name')" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item :label="t('publish.form.program')" prop="programId">
          <el-select v-model="form.programId" :placeholder="t('publish.form.programPlaceholder')" style="width: 100%" filterable>
            <el-option v-for="item in programOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('publish.form.targetStores')" prop="targetStoreIds">
          <el-select v-model="form.targetStoreIds" :placeholder="t('publish.form.targetStoresPlaceholder')" style="width: 100%" multiple filterable>
            <el-option v-for="item in storeOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('publish.form.startTime')" prop="startTime">
          <el-date-picker v-model="form.startTime" type="datetime" :placeholder="t('publish.form.startTimePlaceholder')" style="width: 100%" value-format="YYYY-MM-DDTHH:mm:ss.000Z" />
        </el-form-item>
        <el-form-item :label="t('publish.form.endTime')">
          <el-date-picker v-model="form.endTime" type="datetime" :placeholder="t('publish.form.endTimePlaceholder')" style="width: 100%" value-format="YYYY-MM-DDTHH:mm:ss.000Z" />
        </el-form-item>
        <el-form-item :label="t('publish.form.playDays')" prop="playDays">
          <el-select v-model="form.playDays" :placeholder="t('publish.form.playDaysPlaceholder')" style="width: 100%" multiple>
            <el-option v-for="item in playDayOptions" :key="item.value" :label="t(item.label)" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('publish.form.status')"><el-switch v-model="form.status" :active-value="1" :inactive-value="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitForm">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { publishApi, type PublishPlan } from '@/api/publish';
import { programApi, type Program } from '@/api/program';
import { storeApi } from '@/api/store';
import { dateUtils } from '@/utils/date';

const { t } = useI18n();
const { formatDateTime } = dateUtils;

const playDayOptions = [
  { label: 'publish.playDays.monday', value: 1 },
  { label: 'publish.playDays.tuesday', value: 2 },
  { label: 'publish.playDays.wednesday', value: 3 },
  { label: 'publish.playDays.thursday', value: 4 },
  { label: 'publish.playDays.friday', value: 5 },
  { label: 'publish.playDays.saturday', value: 6 },
  { label: 'publish.playDays.sunday', value: 7 },
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

const rules = computed<FormRules>(() => ({
  name: [{ required: true, message: t('validation.planName'), trigger: 'blur' }],
  programId: [{ required: true, message: t('validation.program'), trigger: 'change' }],
  targetStoreIds: [{ required: true, type: 'array', min: 1, message: t('validation.targetStores'), trigger: 'change' }],
  startTime: [{ required: true, message: t('validation.startTime'), trigger: 'change' }],
  playDays: [{ required: true, type: 'array', min: 1, message: t('validation.playDays'), trigger: 'change' }],
}));

function formatPlayDays(days: number[]): string {
  if (!days || !days.length) return '-';
  return days
    .map((d) => {
      const o = playDayOptions.find((opt) => opt.value === d);
      return o ? t(o.label) : d;
    })
    .join(', ');
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
        ElMessage.success(t('common.messages.updateSuccess'));
      } else {
        await publishApi.create(data);
        ElMessage.success(t('common.messages.createSuccess'));
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
    await ElMessageBox.confirm(t('publish.messages.confirmPush', { name: row.name }), t('common.tip'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'success',
    });
    const result = await publishApi.push(row.id);
    ElMessage.success(
      t('publish.messages.pushSuccess', { deviceCount: result.targetDeviceCount, pushLogId: result.pushLogId })
    );
    fetchData();
  } catch {
    // cancelled
  }
}

async function handleBatchPush() {
  try {
    await ElMessageBox.confirm(
      t('publish.messages.confirmBatchPush', { count: selectedIds.value.length }),
      t('common.tip'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'success',
      }
    );
    await publishApi.batchPush(selectedIds.value);
    ElMessage.success(t('common.messages.batchPushCompleted'));
    fetchData();
  } catch {
    // cancelled
  }
}

async function handleDelete(row: PublishPlan) {
  try {
    await ElMessageBox.confirm(t('publish.messages.confirmDelete', { name: row.name }), t('common.tip'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
    });
    await publishApi.delete(row.id);
    ElMessage.success(t('common.messages.deleteSuccess'));
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
