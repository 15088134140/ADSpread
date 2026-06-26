<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ t('store.title') }}</span>
          <el-button type="primary" @click="openCreate">{{ t('store.createStore') }}</el-button>
        </div>
      </template>

      <el-form :inline="true" :model="query">
        <el-form-item :label="t('store.search.keyword')">
          <el-input v-model="query.keyword" :placeholder="t('store.search.keywordPlaceholder')" clearable />
        </el-form-item>
        <el-form-item :label="t('store.search.industryCategory')">
          <el-select v-model="query.industryCategory" :placeholder="t('store.search.all')" clearable style="width: 160px">
            <el-option v-for="item in industryOptions" :key="item.value" :label="t(item.label)" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('store.search.status')">
          <el-select v-model="query.status" :placeholder="t('store.search.all')" clearable style="width: 120px">
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
        <el-table-column prop="name" :label="t('store.table.name')" />
        <el-table-column prop="code" :label="t('store.table.code')" />
        <el-table-column :label="t('store.table.industryCategory')">
          <template #default="{ row }">{{ getIndustryLabel(row.industryCategory) }}</template>
        </el-table-column>
        <el-table-column prop="address" :label="t('store.table.address')" />
        <el-table-column prop="contactPerson" :label="t('store.table.contactPerson')" />
        <el-table-column prop="contactPhone" :label="t('store.table.contactPhone')" />
        <el-table-column :label="t('store.table.status')">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">{{ row.status === 1 ? t('common.enabled') : t('common.disabled') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="deviceCount" :label="t('store.table.deviceCount')" />
        <el-table-column :label="t('store.table.createdAt')">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column :label="t('store.table.operation')" width="160">
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

    <el-dialog v-model="dialogVisible" :title="form.id ? t('store.editStore') : t('store.createStore')" width="520px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item :label="t('store.form.name')" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item :label="t('store.form.code')" prop="code"><el-input v-model="form.code" /></el-form-item>
        <el-form-item :label="t('store.form.industryCategory')" prop="industryCategory">
          <el-select v-model="form.industryCategory" style="width: 100%">
            <el-option v-for="item in industryOptions" :key="item.value" :label="t(item.label)" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('store.form.address')"><el-input v-model="form.address" /></el-form-item>
        <el-form-item :label="t('store.form.contactPerson')"><el-input v-model="form.contactPerson" /></el-form-item>
        <el-form-item :label="t('store.form.contactPhone')"><el-input v-model="form.contactPhone" /></el-form-item>
        <el-form-item :label="t('store.form.status')"><el-switch v-model="form.status" :active-value="1" :inactive-value="0" /></el-form-item>
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
import { storeApi, type Store } from '@/api/store';
import { industryCategoryOptions } from '@/utils/options';
import { dateUtils } from '@/utils/date';

const { t } = useI18n();
const { formatDateTime } = dateUtils;

const loading = ref(false);
const list = ref<Store[]>([]);
const total = ref(0);
const industryOptions = industryCategoryOptions;

const query = reactive({
  keyword: '',
  industryCategory: '',
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
  industryCategory: '',
  address: '',
  contactPerson: '',
  contactPhone: '',
  status: 1,
});

const rules = computed<FormRules>(() => ({
  name: [{ required: true, message: t('validation.storeName'), trigger: 'blur' }],
  code: [{ required: true, message: t('validation.storeCode'), trigger: 'blur' }],
  industryCategory: [{ required: true, message: t('validation.industryCategory'), trigger: 'change' }],
}));

function getIndustryLabel(value: string): string {
  const item = industryOptions.find((o) => o.value === value);
  return item ? t(item.label) : value;
}

async function fetchData() {
  loading.value = true;
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize };
    if (query.keyword) params.keyword = query.keyword;
    if (query.industryCategory) params.industryCategory = query.industryCategory;
    if (typeof query.status === 'number') params.status = query.status;
    const result = await storeApi.getList(params as any);
    list.value = result.list;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

function resetQuery() {
  query.keyword = '';
  query.industryCategory = '';
  query.status = undefined;
  query.page = 1;
  fetchData();
}

function resetForm() {
  form.id = 0;
  form.name = '';
  form.code = '';
  form.industryCategory = '';
  form.address = '';
  form.contactPerson = '';
  form.contactPhone = '';
  form.status = 1;
}

function openCreate() {
  resetForm();
  dialogVisible.value = true;
}

function openEdit(row: Store) {
  form.id = row.id;
  form.name = row.name;
  form.code = row.code;
  form.industryCategory = row.industryCategory;
  form.address = row.address || '';
  form.contactPerson = row.contactPerson || '';
  form.contactPhone = row.contactPhone || '';
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
        industryCategory: form.industryCategory,
        address: form.address,
        contactPerson: form.contactPerson,
        contactPhone: form.contactPhone,
        status: form.status,
      };
      if (form.id) {
        await storeApi.update(form.id, data);
        ElMessage.success(t('common.messages.updateSuccess'));
      } else {
        await storeApi.create(data as any);
        ElMessage.success(t('common.messages.createSuccess'));
      }
      dialogVisible.value = false;
      fetchData();
    } catch (error) {
      // handled by interceptor
    }
  });
}

async function handleDelete(row: Store) {
  try {
    await ElMessageBox.confirm(t('store.messages.confirmDelete', { name: row.name }), t('common.tip'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
    });
    await storeApi.delete(row.id);
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
</style>
