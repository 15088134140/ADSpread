<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>设备管理</span>
          <div class="card-header-actions">
            <el-button v-permission="'device:import'" @click="importDialogVisible = true">
              {{ t('device.batchImport') }}
            </el-button>
            <el-button type="primary" @click="openCreate">新增设备</el-button>
          </div>
        </div>
      </template>

      <el-form :inline="true" :model="query">
        <el-form-item label="关键词">
          <el-input v-model="query.keyword" placeholder="设备名称/编码" clearable />
        </el-form-item>
        <el-form-item label="所属门店">
          <el-select v-model="query.storeId" placeholder="全部" clearable style="width: 180px">
            <el-option v-for="item in storeOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchData">查询</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="list">
        <el-table-column prop="name" label="设备名称" />
        <el-table-column prop="code" label="设备编码" />
        <el-table-column label="所属门店">
          <template #default="{ row }">{{ row.store?.name || '未绑定' }}</template>
        </el-table-column>
        <el-table-column label="屏幕方向">
          <template #default="{ row }">{{ getOrientationLabel(row.screenOrientation) }}</template>
        </el-table-column>
        <el-table-column prop="screenResolution" label="分辨率" />
        <el-table-column label="分屏类型">
          <template #default="{ row }">{{ getSplitTypeLabel(row.splitType) }}</template>
        </el-table-column>
        <el-table-column label="状态">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
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

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑设备' : '新增设备'" width="560px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="设备名称" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="设备编码" prop="code"><el-input v-model="form.code" /></el-form-item>
        <el-form-item label="所属门店">
          <el-select v-model="form.storeId" placeholder="请选择门店" clearable style="width: 100%">
            <el-option v-for="item in storeOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="屏幕方向" prop="screenOrientation">
          <el-select v-model="form.screenOrientation" style="width: 100%" @change="onOrientationChange">
            <el-option v-for="item in screenOrientationOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="分辨率" prop="screenResolution">
          <el-select v-model="form.screenResolution" placeholder="请选择分辨率" style="width: 100%" filterable allow-create>
            <el-option v-for="item in resolutions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="分屏类型" prop="splitType">
          <el-select v-model="form.splitType" style="width: 100%">
            <el-option v-for="item in currentSplitTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" /></el-form-item>
        <el-form-item label="状态"><el-switch v-model="form.status" :active-value="1" :inactive-value="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
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

const rules: FormRules = {
  name: [{ required: true, message: '请输入设备名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入设备编码', trigger: 'blur' }],
  screenOrientation: [{ required: true, message: '请选择屏幕方向', trigger: 'change' }],
  screenResolution: [{ required: true, message: '请选择分辨率', trigger: 'change' }],
  splitType: [{ required: true, message: '请选择分屏类型', trigger: 'change' }],
};

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
  return screenOrientationOptions.find((item) => item.value === value)?.label || value;
}

function getSplitTypeLabel(value: string): string {
  return splitTypeOptions.find((item) => item.value === value)?.label || value;
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
        ElMessage.success('更新成功');
      } else {
        await deviceApi.create(data as any);
        ElMessage.success('创建成功');
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
    await ElMessageBox.confirm(`确定要删除设备 "${row.name}" 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await deviceApi.delete(row.id);
    ElMessage.success('删除成功');
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
