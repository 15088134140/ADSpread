<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ t('program.title') }}</span>
          <el-button type="primary" @click="openCreate">{{ t('program.createProgram') }}</el-button>
        </div>
      </template>

      <el-form :inline="true" :model="query">
        <el-form-item :label="t('program.search.keyword')">
          <el-input v-model="query.keyword" :placeholder="t('program.search.keywordPlaceholder')" clearable />
        </el-form-item>
        <el-form-item :label="t('program.search.status')">
          <el-select v-model="query.status" :placeholder="t('program.search.all')" clearable style="width: 140px">
            <el-option :label="t('program.status.draft')" :value="0" />
            <el-option :label="t('program.status.published')" :value="1" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchData">{{ t('common.query') }}</el-button>
          <el-button @click="resetQuery">{{ t('common.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="list">
        <el-table-column prop="id" :label="t('common.id')" width="80" />
        <el-table-column prop="name" :label="t('program.table.name')" />
        <el-table-column :label="t('program.table.screenOrientation')">
          <template #default="{ row }">{{ getOrientationLabel(row.screenOrientation) }}</template>
        </el-table-column>
        <el-table-column :label="t('program.table.splitType')">
          <template #default="{ row }">{{ getSplitTypeLabel(row.splitType) }}</template>
        </el-table-column>
        <el-table-column :label="t('program.table.status')">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? t('program.status.published') : t('program.status.draft') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('program.table.publishedAt')">
          <template #default="{ row }">{{ formatDateTime(row.publishedAt) }}</template>
        </el-table-column>
        <el-table-column :label="t('program.table.createdAt')">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column :label="t('program.table.operation')" width="240">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">{{ t('program.table.edit') }}</el-button>
            <el-button link type="success" @click="handlePublish(row)" v-if="row.status === 0">{{ t('program.table.publish') }}</el-button>
            <el-button link type="danger" @click="handleDelete(row)">{{ t('program.table.delete') }}</el-button>
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

    <el-dialog v-model="dialogVisible" :title="form.id ? t('program.editProgram') : t('program.createProgram')" width="720px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item :label="t('program.form.name')" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item :label="t('program.form.screenOrientation')" prop="screenOrientation">
          <el-select v-model="form.screenOrientation" style="width: 100%">
            <el-option v-for="item in screenOrientationOptions" :key="item.value" :label="t(item.label)" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('program.form.splitType')" prop="splitType">
          <el-select v-model="form.splitType" style="width: 100%" @change="onSplitTypeChange">
            <el-option v-for="item in splitTypeOptions" :key="item.value" :label="t(item.label)" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('program.form.regionConfig')" v-if="regionIds.length > 0">
          <div class="regions-wrapper">
            <el-card v-for="regionId in regionIds" :key="regionId" class="region-card" shadow="never">
              <template #header>{{ regionId }}</template>
              <div v-for="(item, index) in getRegionMaterials(regionId)" :key="index" class="material-row">
                <el-select v-model="item.materialId" :placeholder="t('program.form.selectMaterial')" style="width: 240px" filterable>
                  <el-option v-for="m in availableMaterials" :key="m.id" :label="m.name" :value="m.id" />
                </el-select>
                <el-input-number v-model="item.duration" :min="1" :max="3600" controls-position="right" />
                <span class="duration-unit">{{ t('program.form.durationUnit') }}</span>
                <el-button link type="danger" @click="removeMaterial(regionId, index)">{{ t('program.form.removeMaterial') }}</el-button>
              </div>
              <el-button link type="primary" @click="addMaterial(regionId)">{{ t('program.form.addMaterial') }}</el-button>
            </el-card>
          </div>
        </el-form-item>
        <el-alert v-if="form.splitType === 'ANY'" type="info" :closable="false" :title="t('program.form.anySplitTypeAlert')" />
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button @click="submitForm(false)">{{ t('program.saveDraft') }}</el-button>
        <el-button type="primary" @click="submitForm(true)" v-if="form.splitType !== 'ANY'">{{ t('program.saveAndPublish') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { programApi, type Program, type Region } from '@/api/program';
import { materialApi, type Material } from '@/api/material';
import { screenOrientationOptions, splitTypeOptions } from '@/utils/options';
import { dateUtils } from '@/utils/date';

const { t } = useI18n();
const { formatDateTime } = dateUtils;

const loading = ref(false);
const list = ref<Program[]>([]);
const total = ref(0);
const availableMaterials = ref<Material[]>([]);

const query = reactive({
  keyword: '',
  status: undefined as number | undefined,
  page: 1,
  pageSize: 20,
});

const dialogVisible = ref(false);
const formRef = ref<FormInstance>();

interface MaterialItem { materialId: number | undefined; duration: number; }
interface RegionState { regionId: string; materials: MaterialItem[]; }

const form = reactive({
  id: 0,
  name: '',
  screenOrientation: 'LANDSCAPE',
  splitType: 'SPLIT_1',
  regions: [] as RegionState[],
  status: 0,
});

const rules = computed<FormRules>(() => ({
  name: [{ required: true, message: t('validation.programName'), trigger: 'blur' }],
  screenOrientation: [{ required: true, message: t('validation.screenOrientation'), trigger: 'change' }],
  splitType: [{ required: true, message: t('validation.splitType'), trigger: 'change' }],
}));

const regionIds = computed(() => getRegionIds(form.splitType));

function getRegionIds(splitType: string): string[] {
  if (splitType === 'SPLIT_1') return ['region1'];
  if (splitType === 'SPLIT_2') return ['region1', 'region2'];
  if (splitType === 'SPLIT_3' || splitType === 'SPLIT_3_1') return ['region1', 'region2', 'region3'];
  if (splitType === 'SPLIT_4') return ['region1', 'region2', 'region3', 'region4'];
  return [];
}

function onSplitTypeChange() {
  const ids = regionIds.value;
  form.regions = ids.map((regionId) => {
    const existing = form.regions.find((r) => r.regionId === regionId);
    return existing || { regionId, materials: [] };
  });
}

function getRegionMaterials(regionId: string): MaterialItem[] {
  let region = form.regions.find((r) => r.regionId === regionId);
  if (!region) {
    region = { regionId, materials: [] };
    form.regions.push(region);
  }
  return region.materials;
}

function addMaterial(regionId: string) {
  getRegionMaterials(regionId).push({ materialId: undefined, duration: 10 });
}

function removeMaterial(regionId: string, index: number) {
  getRegionMaterials(regionId).splice(index, 1);
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
    if (typeof query.status === 'number') params.status = query.status;
    const result = await programApi.getList(params as any);
    list.value = result.list;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

async function loadAvailableMaterials() {
  availableMaterials.value = await materialApi.getAvailable();
}

function resetQuery() {
  query.keyword = '';
  query.status = undefined;
  query.page = 1;
  fetchData();
}

function resetForm() {
  form.id = 0;
  form.name = '';
  form.screenOrientation = 'LANDSCAPE';
  form.splitType = 'SPLIT_1';
  form.regions = [];
  form.status = 0;
  onSplitTypeChange();
}

function openCreate() {
  resetForm();
  loadAvailableMaterials();
  dialogVisible.value = true;
}

function openEdit(row: Program) {
  form.id = row.id;
  form.name = row.name;
  form.screenOrientation = row.screenOrientation;
  form.splitType = row.splitType;
  form.status = row.status;
  const regions = row.layoutConfig?.regions || [];
  form.regions = regions.map((r) => ({
    regionId: r.regionId,
    materials: (r.materials || []).map((m) => ({ materialId: m.materialId, duration: m.duration })),
  }));
  onSplitTypeChange();
  loadAvailableMaterials();
  dialogVisible.value = true;
}

async function submitForm(publish: boolean) {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    try {
      const regions: Region[] = form.regions
        .filter((r) => r.materials.length > 0)
        .map((r) => ({
          regionId: r.regionId,
          materials: r.materials
            .filter((m) => m.materialId !== undefined)
            .map((m) => ({ materialId: m.materialId as number, duration: m.duration })),
        }));

      const data = {
        name: form.name,
        screenOrientation: form.screenOrientation,
        splitType: form.splitType,
        regions,
        status: publish ? 1 : 0,
      };

      if (form.id) {
        await programApi.update(form.id, data);
        if (publish) {
          await programApi.publish(form.id, { regions });
        }
        ElMessage.success(publish ? t('common.messages.publishSuccess') : t('common.messages.saveSuccess'));
      } else {
        const created = await programApi.create(data);
        if (publish) {
          await programApi.publish(created.id, { regions });
        }
        ElMessage.success(publish ? t('common.messages.publishSuccess') : t('common.messages.saveSuccess'));
      }
      dialogVisible.value = false;
      fetchData();
    } catch {
      // handled by interceptor
    }
  });
}

async function handlePublish(row: Program) {
  try {
    await ElMessageBox.confirm(t('program.messages.confirmPublish', { name: row.name }), t('common.tip'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'success',
    });
    const regions = (row.layoutConfig?.regions || []) as Region[];
    await programApi.publish(row.id, { regions });
    ElMessage.success(t('common.messages.publishSuccess'));
    fetchData();
  } catch {
    // cancelled
  }
}

async function handleDelete(row: Program) {
  try {
    await ElMessageBox.confirm(t('program.messages.confirmDelete', { name: row.name }), t('common.tip'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
    });
    await programApi.delete(row.id);
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

.regions-wrapper {
  width: 100%;
}

.region-card {
  margin-bottom: 12px;
}

.material-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.duration-unit {
  color: #909399;
}
</style>
