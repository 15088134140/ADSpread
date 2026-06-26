<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>门店管理</span>
          <el-button type="primary" @click="openCreate">新增门店</el-button>
        </div>
      </template>

      <el-form :inline="true" :model="query">
        <el-form-item label="关键词">
          <el-input v-model="query.keyword" placeholder="门店名称/编码" clearable />
        </el-form-item>
        <el-form-item label="行业分类">
          <el-select v-model="query.industryCategory" placeholder="全部" clearable style="width: 160px">
            <el-option v-for="item in industryOptions" :key="item.value" :label="item.label" :value="item.value" />
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
        <el-table-column prop="name" label="门店名称" />
        <el-table-column prop="code" label="门店编码" />
        <el-table-column label="行业分类">
          <template #default="{ row }">{{ getIndustryLabel(row.industryCategory) }}</template>
        </el-table-column>
        <el-table-column prop="address" label="地址" />
        <el-table-column prop="contactPerson" label="联系人" />
        <el-table-column prop="contactPhone" label="联系电话" />
        <el-table-column label="状态">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="deviceCount" label="设备数" />
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

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑门店' : '新增门店'" width="520px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="门店名称" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="门店编码" prop="code"><el-input v-model="form.code" /></el-form-item>
        <el-form-item label="行业分类" prop="industryCategory">
          <el-select v-model="form.industryCategory" style="width: 100%">
            <el-option v-for="item in industryOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="地址"><el-input v-model="form.address" /></el-form-item>
        <el-form-item label="联系人"><el-input v-model="form.contactPerson" /></el-form-item>
        <el-form-item label="联系电话"><el-input v-model="form.contactPhone" /></el-form-item>
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
import { storeApi, type Store } from '@/api/store';
import { industryCategoryOptions } from '@/utils/options';
import { dateUtils } from '@/utils/date';

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

const rules: FormRules = {
  name: [{ required: true, message: '请输入门店名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入门店编码', trigger: 'blur' }],
  industryCategory: [{ required: true, message: '请选择行业分类', trigger: 'change' }],
};

function getIndustryLabel(value: string): string {
  return industryOptions.find((item) => item.value === value)?.label || value;
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
        ElMessage.success('更新成功');
      } else {
        await storeApi.create(data as any);
        ElMessage.success('创建成功');
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
    await ElMessageBox.confirm(`确定要删除门店 "${row.name}" 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await storeApi.delete(row.id);
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
</style>
