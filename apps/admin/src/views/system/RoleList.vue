<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ t('system.role.title') }}</span>
          <el-button v-permission="'role:create'" type="primary" @click="openCreate">
            {{ t('system.role.createRole') }}
          </el-button>
        </div>
      </template>

      <el-form :inline="true" :model="query">
        <el-form-item :label="t('system.role.filter.name')">
          <el-input v-model="query.name" :placeholder="t('system.role.filter.name')" clearable />
        </el-form-item>
        <el-form-item :label="t('system.role.filter.status')">
          <el-select v-model="query.status" :placeholder="t('common.all')" clearable style="width: 120px">
            <el-option :label="t('common.enabled')" :value="1" />
            <el-option :label="t('common.disabled')" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSearch">{{ t('common.query') }}</el-button>
          <el-button @click="resetQuery">{{ t('common.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="list">
        <el-table-column prop="name" :label="t('system.role.table.name')" />
        <el-table-column prop="remark" :label="t('system.role.table.remark')" show-overflow-tooltip />
        <el-table-column :label="t('system.role.table.status')" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">
              {{ row.status === 1 ? t('common.enabled') : t('common.disabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="adminCount" :label="t('system.role.table.adminCount')" width="120" />
        <el-table-column :label="t('system.role.table.createdAt')" width="170">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column :label="t('common.operation')" width="280" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'role:update'" link type="primary" @click="openEdit(row)">
              {{ t('common.edit') }}
            </el-button>
            <el-button v-permission="'role:assign'" link type="primary" @click="openAssign(row)">
              {{ t('system.role.assignPermissions') }}
            </el-button>
            <el-button v-permission="'role:create'" link type="primary" @click="openCopy(row)">
              {{ t('system.role.copyRole') }}
            </el-button>
            <el-button v-permission="'role:delete'" link type="danger" @click="handleDelete(row)">
              {{ t('common.delete') }}
            </el-button>
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

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? t('system.role.editRole') : t('system.role.createRole')"
      width="520px"
      :close-on-click-modal="false"
    >
      <el-alert
        v-if="!form.id && form.menuIds.length > 0"
        :title="t('system.role.messages.copySuccess')"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      />
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item :label="t('system.role.form.name')" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item :label="t('system.role.form.remark')" prop="remark">
          <el-input v-model="form.remark" type="textarea" />
        </el-form-item>
        <el-form-item :label="t('system.role.form.status')">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitForm">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>

    <!-- 分配权限弹窗 -->
    <el-dialog
      v-model="assignDialogVisible"
      :title="t('system.role.assignDialog.title', { name: currentRole?.name || '' })"
      width="560px"
      :close-on-click-modal="false"
    >
      <p class="assign-tip">{{ t('system.role.assignDialog.tip') }}</p>
      <el-tree
        ref="treeRef"
        :data="menuTreeData"
        show-checkbox
        check-strictly
        node-key="id"
        :default-checked-keys="currentRoleMenuIds"
        :props="{ label: 'name', children: 'children' }"
        v-loading="menuTreeLoading"
      />
      <template #footer>
        <el-button @click="assignDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="assignSubmitting" @click="submitAssign">
          {{ t('common.save') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import type { MenuTreeNode } from '@adspread/types';
import { roleApi, type RoleWithAdminCount } from '@/api/role';
import { menuApi } from '@/api/menu';
import { dateUtils } from '@/utils/date';

const { t } = useI18n();
const { formatDateTime } = dateUtils;

const loading = ref(false);
const list = ref<RoleWithAdminCount[]>([]);
const total = ref(0);

const query = reactive({
  name: '',
  status: undefined as number | undefined,
  page: 1,
  pageSize: 20,
});

const dialogVisible = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({
  id: 0,
  name: '',
  remark: '',
  status: 1,
  // 复制角色时预填的权限菜单 id（仅新增时携带）
  menuIds: [] as number[],
});

const rules = computed<FormRules>(() => ({
  name: [{ required: true, message: t('validation.roleName'), trigger: 'blur' }],
}));

async function fetchData() {
  loading.value = true;
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize };
    if (query.name) params.name = query.name;
    if (typeof query.status === 'number') params.status = query.status;
    const result = await roleApi.getList(params as any);
    list.value = result.list;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  query.page = 1;
  fetchData();
}

function resetQuery() {
  query.name = '';
  query.status = undefined;
  query.page = 1;
  fetchData();
}

function resetForm() {
  form.id = 0;
  form.name = '';
  form.remark = '';
  form.status = 1;
  form.menuIds = [];
}

function openCreate() {
  resetForm();
  dialogVisible.value = true;
}

function openEdit(row: RoleWithAdminCount) {
  form.id = row.id;
  form.name = row.name;
  form.remark = row.remark || '';
  form.status = row.status;
  form.menuIds = [];
  dialogVisible.value = true;
}

function openCopy(row: RoleWithAdminCount) {
  resetForm();
  form.name = '';
  form.remark = row.remark || '';
  form.menuIds = row.menuIds ? [...row.menuIds] : [];
  dialogVisible.value = true;
}

async function submitForm() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    try {
      if (form.id) {
        await roleApi.update(form.id, {
          name: form.name,
          remark: form.remark,
          status: form.status,
        });
        ElMessage.success(t('common.messages.updateSuccess'));
      } else {
        await roleApi.create({
          name: form.name,
          remark: form.remark,
          status: form.status,
          menuIds: form.menuIds,
        });
        ElMessage.success(t('common.messages.createSuccess'));
      }
      dialogVisible.value = false;
      fetchData();
    } catch {
      // handled by interceptor
    }
  });
}

async function handleDelete(row: RoleWithAdminCount) {
  try {
    await ElMessageBox.confirm(t('system.role.messages.confirmDelete', { name: row.name }), t('common.tip'), {
      confirmButtonText: t('common.confirmButtonText'),
      cancelButtonText: t('common.cancelButtonText'),
      type: 'warning',
    });
    await roleApi.remove(row.id);
    ElMessage.success(t('common.messages.deleteSuccess'));
    fetchData();
  } catch {
    // cancelled
  }
}

// ===== 分配权限 =====
const assignDialogVisible = ref(false);
const treeRef = ref();
const menuTreeData = ref<MenuTreeNode[]>([]);
const menuTreeLoading = ref(false);
const assignSubmitting = ref(false);
const currentRole = ref<RoleWithAdminCount | null>(null);
const currentRoleMenuIds = ref<number[]>([]);

async function ensureMenuTree() {
  if (menuTreeData.value.length > 0) return;
  menuTreeLoading.value = true;
  try {
    menuTreeData.value = (await menuApi.getTree()) ?? [];
  } finally {
    menuTreeLoading.value = false;
  }
}

async function openAssign(row: RoleWithAdminCount) {
  currentRole.value = row;
  currentRoleMenuIds.value = row.menuIds ? [...row.menuIds] : [];
  assignDialogVisible.value = true;
  await ensureMenuTree();
  // el-tree 渲染后需重新设置勾选，避免 default-checked-keys 在数据加载前失效
  treeRef.value?.setCheckedKeys(currentRoleMenuIds.value, false);
}

async function submitAssign() {
  if (!currentRole.value || !treeRef.value) return;
  const menuIds = treeRef.value.getCheckedKeys() as number[];
  assignSubmitting.value = true;
  try {
    await roleApi.assignMenus(currentRole.value.id, { menuIds });
    ElMessage.success(t('system.role.messages.assignSuccess'));
    // 同步本地角色 menuIds
    currentRole.value.menuIds = menuIds;
    const target = list.value.find((r) => r.id === currentRole.value!.id);
    if (target) target.menuIds = menuIds;
    assignDialogVisible.value = false;
  } catch {
    // handled by interceptor
  } finally {
    assignSubmitting.value = false;
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

.assign-tip {
  margin: 0 0 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>
