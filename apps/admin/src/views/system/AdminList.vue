<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ t('system.admin.title') }}</span>
          <el-button v-permission="'admin:create'" type="primary" @click="openCreate">
            {{ t('system.admin.createAdmin') }}
          </el-button>
        </div>
      </template>

      <el-form :inline="true" :model="query">
        <el-form-item :label="t('system.admin.filter.username')">
          <el-input v-model="query.username" :placeholder="t('system.admin.filter.username')" clearable />
        </el-form-item>
        <el-form-item :label="t('system.admin.filter.name')">
          <el-input v-model="query.name" :placeholder="t('system.admin.filter.name')" clearable />
        </el-form-item>
        <el-form-item :label="t('system.admin.filter.status')">
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
        <el-table-column prop="username" :label="t('system.admin.table.username')" />
        <el-table-column prop="name" :label="t('system.admin.table.name')" />
        <el-table-column :label="t('system.admin.table.role')">
          <template #default="{ row }">{{ row.role?.name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="phone" :label="t('system.admin.table.phone')" />
        <el-table-column :label="t('system.admin.table.status')" width="100">
          <template #default="{ row }">
            <el-switch
              :model-value="row.status === 1"
              :active-value="true"
              :inactive-value="false"
              @change="(val: boolean) => handleToggleStatus(row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column :label="t('system.admin.table.lastLoginAt')" width="170">
          <template #default="{ row }">{{ formatDateTime(row.lastLoginAt) }}</template>
        </el-table-column>
        <el-table-column :label="t('system.admin.table.createdAt')" width="170">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column :label="t('common.operation')" width="220" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'admin:update'" link type="primary" @click="openEdit(row)">
              {{ t('common.edit') }}
            </el-button>
            <el-button v-permission="'admin:reset-password'" link type="warning" @click="openResetPassword(row)">
              {{ t('system.admin.resetPassword') }}
            </el-button>
            <el-button v-permission="'admin:update'" link type="danger" @click="handleDelete(row)">
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
      :title="form.id ? t('system.admin.editAdmin') : t('system.admin.createAdmin')"
      width="560px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item :label="t('system.admin.form.username')" prop="username">
          <el-input v-model="form.username" />
        </el-form-item>
        <el-form-item :label="t('system.admin.form.name')" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item :label="t('system.admin.form.role')" prop="roleId">
          <el-select v-model="form.roleId" :placeholder="t('system.admin.form.rolePlaceholder')" style="width: 100%">
            <el-option v-for="item in roleOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('system.admin.form.phone')" prop="phone">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item :label="t('system.admin.form.email')" prop="email">
          <el-input v-model="form.email" />
        </el-form-item>
        <template v-if="!form.id">
          <el-form-item :label="t('system.admin.form.password')" prop="password">
            <el-input v-model="form.password" type="password" show-password :placeholder="t('system.admin.form.passwordPlaceholder')" />
          </el-form-item>
          <el-form-item :label="t('system.admin.form.confirmPassword')" prop="confirmPassword">
            <el-input v-model="form.confirmPassword" type="password" show-password />
          </el-form-item>
        </template>
        <el-form-item :label="t('system.admin.form.status')">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="submitForm">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码弹窗 -->
    <el-dialog
      v-model="resetDialogVisible"
      :title="t('system.admin.resetPassword')"
      width="460px"
      :close-on-click-modal="false"
    >
      <el-form ref="resetFormRef" :model="resetPwdForm" :rules="resetRules" label-width="120px">
        <el-form-item :label="t('system.admin.form.password')" prop="newPassword">
          <el-input v-model="resetPwdForm.newPassword" type="password" show-password :placeholder="t('system.admin.form.passwordPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('system.admin.form.confirmPassword')" prop="confirmPassword">
          <el-input v-model="resetPwdForm.confirmPassword" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="resetSubmitting" @click="submitResetPassword">
          {{ t('common.confirm') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import type { Admin } from '@adspread/types';
import { adminApi } from '@/api/admin';
import { roleApi, type RoleOption } from '@/api/role';
import { dateUtils } from '@/utils/date';

const { t } = useI18n();
const { formatDateTime } = dateUtils;

/** 密码强度规则：至少 8 位，含大写字母、小写字母与数字（与后端一致）。 */
const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const loading = ref(false);
const list = ref<Admin[]>([]);
const total = ref(0);
const roleOptions = ref<RoleOption[]>([]);

const query = reactive({
  username: '',
  name: '',
  status: undefined as number | undefined,
  page: 1,
  pageSize: 20,
});

const dialogVisible = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({
  id: 0,
  username: '',
  name: '',
  roleId: undefined as number | undefined,
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  status: 1,
});

const validatePassword = (_rule: any, value: string, callback: (error?: Error) => void) => {
  if (!form.id && !value) {
    callback(new Error(t('validation.password')));
    return;
  }
  if (value && !PASSWORD_STRENGTH_REGEX.test(value)) {
    callback(new Error(t('validation.passwordStrength')));
    return;
  }
  callback();
};

const validateConfirmPassword = (_rule: any, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback(new Error(t('validation.password')));
    return;
  }
  if (value !== form.password) {
    callback(new Error(t('validation.passwordMismatch')));
    return;
  }
  callback();
};

const rules = computed<FormRules>(() => ({
  username: [{ required: true, message: t('validation.username'), trigger: 'blur' }],
  name: [{ required: true, message: t('validation.pleaseInput'), trigger: 'blur' }],
  roleId: [{ required: true, message: t('system.admin.form.rolePlaceholder'), trigger: 'change' }],
  password: [{ validator: validatePassword, trigger: 'blur' }],
  confirmPassword: [{ validator: validateConfirmPassword, trigger: 'blur' }],
}));

async function fetchData() {
  loading.value = true;
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize };
    if (query.username) params.username = query.username;
    if (query.name) params.name = query.name;
    if (typeof query.status === 'number') params.status = query.status;
    const result = await adminApi.getList(params as any);
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
  query.username = '';
  query.name = '';
  query.status = undefined;
  query.page = 1;
  fetchData();
}

async function loadRoleOptions() {
  roleOptions.value = await roleApi.getOptions();
}

function resetForm() {
  form.id = 0;
  form.username = '';
  form.name = '';
  form.roleId = undefined;
  form.phone = '';
  form.email = '';
  form.password = '';
  form.confirmPassword = '';
  form.status = 1;
}

function openCreate() {
  resetForm();
  dialogVisible.value = true;
}

function openEdit(row: Admin) {
  form.id = row.id;
  form.username = row.username;
  form.name = row.name;
  form.roleId = row.roleId;
  form.phone = row.phone || '';
  form.email = row.email || '';
  form.password = '';
  form.confirmPassword = '';
  form.status = row.status;
  dialogVisible.value = true;
}

async function submitForm() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    try {
      if (form.id) {
        await adminApi.update(form.id, {
          username: form.username,
          name: form.name,
          roleId: form.roleId,
          phone: form.phone,
          email: form.email,
          status: form.status,
        });
        ElMessage.success(t('common.messages.updateSuccess'));
      } else {
        await adminApi.create({
          username: form.username,
          password: form.password,
          name: form.name,
          roleId: form.roleId!,
          phone: form.phone,
          email: form.email,
          status: form.status,
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

async function handleToggleStatus(row: Admin, enabled: boolean) {
  const newStatus = enabled ? 1 : 0;
  try {
    await adminApi.update(row.id, { status: newStatus });
    row.status = newStatus;
    ElMessage.success(t('common.messages.updateSuccess'));
  } catch {
    // 状态切换失败时保持原值（row.status 未改）
  }
}

async function handleDelete(row: Admin) {
  try {
    await ElMessageBox.confirm(t('system.admin.messages.confirmDelete', { name: row.name }), t('common.tip'), {
      confirmButtonText: t('common.confirmButtonText'),
      cancelButtonText: t('common.cancelButtonText'),
      type: 'warning',
    });
    await adminApi.remove(row.id);
    ElMessage.success(t('common.messages.deleteSuccess'));
    fetchData();
  } catch {
    // cancelled
  }
}

// ===== 重置密码 =====
const resetDialogVisible = ref(false);
const resetFormRef = ref<FormInstance>();
const resetSubmitting = ref(false);
const resetTarget = ref<Admin | null>(null);

const resetPwdForm = reactive({
  newPassword: '',
  confirmPassword: '',
});

const validateResetConfirm = (_rule: any, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback(new Error(t('validation.password')));
    return;
  }
  if (value !== resetPwdForm.newPassword) {
    callback(new Error(t('validation.passwordMismatch')));
    return;
  }
  callback();
};

const resetRules = computed<FormRules>(() => ({
  newPassword: [
    { required: true, message: t('validation.password'), trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void) => {
        if (value && !PASSWORD_STRENGTH_REGEX.test(value)) {
          callback(new Error(t('validation.passwordStrength')));
          return;
        }
        callback();
      },
      trigger: 'blur',
    },
  ],
  confirmPassword: [{ validator: validateResetConfirm, trigger: 'blur' }],
}));

function openResetPassword(row: Admin) {
  resetTarget.value = row;
  resetPwdForm.newPassword = '';
  resetPwdForm.confirmPassword = '';
  resetDialogVisible.value = true;
}

async function submitResetPassword() {
  if (!resetFormRef.value || !resetTarget.value) return;
  await resetFormRef.value.validate(async (valid) => {
    if (!valid) return;
    resetSubmitting.value = true;
    try {
      await adminApi.resetPassword(resetTarget.value!.id, { newPassword: resetPwdForm.newPassword });
      ElMessage.success(t('system.admin.messages.resetPasswordSuccess'));
      resetDialogVisible.value = false;
    } catch {
      // handled by interceptor
    } finally {
      resetSubmitting.value = false;
    }
  });
}

onMounted(() => {
  loadRoleOptions();
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
