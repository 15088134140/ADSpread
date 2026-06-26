<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ t('device.title') }}</span>
          <div class="card-header-actions">
            <el-button v-permission="'device:import'" @click="importDialogVisible = true">
              {{ t('device.batchImport') }}
            </el-button>
            <el-button type="primary" @click="openCreate">{{ t('device.createDevice') }}</el-button>
          </div>
        </div>
      </template>

      <el-form :inline="true" :model="query">
        <el-form-item :label="t('device.search.keyword')">
          <el-input v-model="query.keyword" :placeholder="t('device.search.keywordPlaceholder')" clearable />
        </el-form-item>
        <el-form-item :label="t('device.search.store')">
          <el-select v-model="query.storeId" :placeholder="t('device.search.all')" clearable style="width: 180px">
            <el-option v-for="item in storeOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('device.search.status')">
          <el-select v-model="query.status" :placeholder="t('device.search.all')" clearable style="width: 120px">
            <el-option :label="t('common.enabled')" :value="1" />
            <el-option :label="t('common.disabled')" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchData">{{ t('common.query') }}</el-button>
          <el-button @click="resetQuery">{{ t('common.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="list">
        <el-table-column prop="id" :label="t('common.id')" width="80" />
        <el-table-column prop="name" :label="t('device.table.name')" />
        <el-table-column prop="code" :label="t('device.table.code')" />
        <el-table-column :label="t('device.table.store')">
          <template #default="{ row }">{{ row.store?.name || t('device.search.unbound') }}</template>
        </el-table-column>
        <el-table-column :label="t('device.table.screenOrientation')">
          <template #default="{ row }">{{ getOrientationLabel(row.screenOrientation) }}</template>
        </el-table-column>
        <el-table-column prop="screenResolution" :label="t('device.table.screenResolution')" />
        <el-table-column :label="t('device.table.splitType')">
          <template #default="{ row }">{{ getSplitTypeLabel(row.splitType) }}</template>
        </el-table-column>
        <el-table-column :label="t('device.table.status')">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">{{ row.status === 1 ? t('common.enabled') : t('common.disabled') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('device.table.createdAt')">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column :label="t('device.table.operation')" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">{{ t('common.edit') }}</el-button>
            <el-button link type="danger" @click="handleDelete(row)">{{ t('common.delete') }}</el-button>
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

    <el-dialog v-model="dialogVisible" :title="form.id ? t('device.editDevice') : t('device.createDevice')" width="560px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item :label="t('device.form.name')" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item :label="t('device.form.code')" prop="code"><el-input v-model="form.code" /></el-form-item>
        <el-form-item :label="t('device.form.store')">
          <el-select v-model="form.storeId" :placeholder="t('device.form.storePlaceholder')" clearable style="width: 100%">
            <el-option v-for="item in storeOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('device.form.screenOrientation')" prop="screenOrientation">
          <el-select v-model="form.screenOrientation" style="width: 100%" @change="onOrientationChange">
            <el-option v-for="item in screenOrientationOptions" :key="item.value" :label="t(item.label)" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('device.form.screenResolution')" prop="screenResolution">
          <el-select v-model="form.screenResolution" :placeholder="t('device.form.screenResolutionPlaceholder')" style="width: 100%" filterable allow-create>
            <el-option v-for="item in resolutions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('device.form.splitType')" prop="splitType">
          <el-select v-model="form.splitType" style="width: 100%">
            <el-option v-for="item in currentSplitTypeOptions" :key="item.value" :label="t(item.label)" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('device.form.remark')"><el-input v-model="form.remark" type="textarea" /></el-form-item>
        <el-form-item :label="t('device.form.status')"><el-switch v-model="form.status" :active-value="1" :inactive-value="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitForm">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>

    <ExcelImportDialog v-model="importDialogVisible" @success="fetchData" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { deviceApi, type Device } from '@/api/device';
import { storeApi } from '@/api/store';
import { screenOrientationOptions, splitTypeOptions, getDeviceSplitTypeOptions } from '@/utils/options';
import { dateUtils } from '@/utils/date';
import { ScreenOrientation, SplitType } from '@adspread/types';
import ExcelImportDialog from '@/components/business/ExcelImportDialog.vue';

const { t } = useI18n();
const { formatDateTime } = dateUtils;

const importDialogVisible = ref(false);

const loading = ref(false);
const list = ref<Device[]>([]);
const total = ref(0);
const storeOptions = ref<{ id: number; name: string; code: string }[]>([]);
const resolutions = ref<string[]>([]);

const query = reactive({
  keyword: '',
  storeId: undefined as number | undefined,
  status: undefined as number | undefined,
  page: 1,
  pageSize: 20,
});

const dialogVisible = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({
  id: 0,
  name: '',
  code: '',
  storeId: undefined as number | undefined,
  screenOrientation: ScreenOrientation.LANDSCAPE as string,
  screenResolution: '',
  splitType: SplitType.SPLIT_1 as string | undefined,
  remark: '',
  status: 1,
});

const rules = computed<FormRules>(() => ({
  name: [{ required: true, message: t('validation.deviceName'), trigger: 'blur' }],
  code: [{ required: true, message: t('validation.deviceCode'), trigger: 'blur' }],
  screenOrientation: [{ required: true, message: t('validation.screenOrientation'), trigger: 'change' }],
  screenResolution: [{ required: true, message: t('validation.screenResolution'), trigger: 'change' }],
  splitType: [{ required: true, message: t('validation.splitType'), trigger: 'change' }],
}));

const currentSplitTypeOptions = computed(() => {
  if (!form.screenOrientation) return splitTypeOptions;
  return getDeviceSplitTypeOptions(form.screenOrientation as ScreenOrientation);
});

watch(
  () => form.screenOrientation,
  (orientation) => {
    const allowed = getDeviceSplitTypeOptions(orientation as ScreenOrientation).map((item) => item.value);
    if (form.splitType && !allowed.includes(form.splitType)) {
      form.splitType = undefined;
    }
  },
);

function onOrientationChange() {
  // watcher handles splitType reset
}

function getOrientationLabel(value: string): string {
  const item = screenOrientationOptions.find((o) => o.value === value);
  return item ? t(item.label) : value;
}

function getSplitTypeLabel(value: string): string {
  const item = splitTypeOptions.find((o) => o.value === value);
  return item ? t(item.label) : value;
}

async function fetchData() {
  loading.value = true;
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize };
    if (query.keyword) params.keyword = query.keyword;
    if (typeof query.storeId === 'number') params.storeId = query.storeId;
    if (typeof query.status === 'number') params.status = query.status;
    const result = await deviceApi.getList(params as any);
    list.value = result.list;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

async function loadOptions() {
  const [stores, res] = await Promise.all([storeApi.getOptions(), deviceApi.getResolutions()]);
  storeOptions.value = stores;
  resolutions.value = res;
}

function resetQuery() {
  query.keyword = '';
  query.storeId = undefined;
  query.status = undefined;
  query.page = 1;
  fetchData();
}

function resetForm() {
  form.id = 0;
  form.name = '';
  form.code = '';
  form.storeId = undefined;
  form.screenOrientation = ScreenOrientation.LANDSCAPE;
  form.screenResolution = '';
  form.splitType = SplitType.SPLIT_1;
  form.remark = '';
  form.status = 1;
}

function openCreate() {
  resetForm();
  dialogVisible.value = true;
}

function openEdit(row: Device) {
  form.id = row.id;
  form.name = row.name;
  form.code = row.code;
  form.storeId = row.storeId || undefined;
  form.screenOrientation = row.screenOrientation;
  form.screenResolution = row.screenResolution;
  form.splitType = row.splitType;
  form.remark = row.remark || '';
  form.status = row.status;
  dialogVisible.value = true;
}

async function submitForm() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    try {
      const data = {
        name: form.name,
        code: form.code,
        storeId: form.storeId,
        screenOrientation: form.screenOrientation,
        screenResolution: form.screenResolution,
        splitType: form.splitType,
        remark: form.remark,
        status: form.status,
      };
      if (form.id) {
        await deviceApi.update(form.id, data as any);
        ElMessage.success(t('common.messages.updateSuccess'));
      } else {
        await deviceApi.create(data as any);
        ElMessage.success(t('common.messages.createSuccess'));
      }
      dialogVisible.value = false;
      fetchData();
    } catch (error) {
      // handled by interceptor
    }
  });
}

async function handleDelete(row: Device) {
  try {
    await ElMessageBox.confirm(t('device.messages.confirmDelete', { name: row.name }), t('common.tip'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
    });
    await deviceApi.delete(row.id);
    ElMessage.success(t('common.messages.deleteSuccess'));
    fetchData();
  } catch {
    // cancelled
  }
}

onMounted(() => {
  loadOptions();
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

.card-header-actions {
  display: flex;
  gap: 8px;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
