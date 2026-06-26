<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ t('system.menu.title') }}</span>
          <el-button v-permission="'menu:create'" type="primary" @click="openCreate(undefined)">
            {{ t('system.menu.createMenu') }}
          </el-button>
        </div>
      </template>

      <el-table
        v-loading="loading"
        :data="menuTree"
        row-key="id"
        :tree-props="{ children: 'children' }"
        default-expand-all
      >
        <el-table-column prop="name" :label="t('system.menu.table.name')" />
        <el-table-column :label="t('system.menu.table.type')" width="100">
          <template #default="{ row }">
            <el-tag :type="typeTagType(row.type)" size="small">{{ getTypeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="path" :label="t('system.menu.table.path')" />
        <el-table-column prop="permission" :label="t('system.menu.table.permission')" />
        <el-table-column prop="icon" :label="t('system.menu.table.icon')" width="100" />
        <el-table-column prop="sort" :label="t('system.menu.table.sort')" width="80" />
        <el-table-column :label="t('system.menu.table.status')" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? t('common.enabled') : t('common.disabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('common.operation')" width="220" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'menu:create'" link type="primary" @click="openCreate(row)">
              {{ t('common.add') }}
            </el-button>
            <el-button v-permission="'menu:update'" link type="primary" @click="openEdit(row)">
              {{ t('common.edit') }}
            </el-button>
            <el-button v-permission="'menu:delete'" link type="danger" @click="handleDelete(row)">
              {{ t('common.delete') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? t('system.menu.editMenu') : t('system.menu.createMenu')"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item :label="t('system.menu.form.parent')" prop="parentId">
          <el-tree-select
            v-model="form.parentId"
            :data="parentTreeData"
            :props="{ label: 'name', children: 'children' }"
            node-key="id"
            check-strictly
            :placeholder="t('system.menu.form.parentPlaceholder')"
            clearable
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item :label="t('system.menu.form.name')" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item :label="t('system.menu.form.type')" prop="type">
          <el-radio-group v-model="form.type">
            <el-radio :value="1">{{ t('system.menu.type.directory') }}</el-radio>
            <el-radio :value="2">{{ t('system.menu.type.menu') }}</el-radio>
            <el-radio :value="3">{{ t('system.menu.type.button') }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.type !== 3" :label="t('system.menu.form.path')" prop="path">
          <el-input v-model="form.path" />
        </el-form-item>
        <el-form-item v-if="form.type !== 3" :label="t('system.menu.form.component')" prop="component">
          <el-input v-model="form.component" />
        </el-form-item>
        <el-form-item v-if="form.type !== 3" :label="t('system.menu.form.icon')" prop="icon">
          <el-input v-model="form.icon" />
        </el-form-item>
        <el-form-item :label="t('system.menu.form.permission')" prop="permission">
          <el-input v-model="form.permission" />
        </el-form-item>
        <el-form-item :label="t('system.menu.form.sort')" prop="sort">
          <el-input-number v-model="form.sort" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item :label="t('system.menu.form.status')">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
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
import { type MenuTreeNode, MenuType } from '@adspread/types';
import { menuApi } from '@/api/menu';

const { t } = useI18n();

const loading = ref(false);
const menuTree = ref<MenuTreeNode[]>([]);

const dialogVisible = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({
  id: 0,
  parentId: undefined as number | undefined,
  name: '',
  type: 2 as number,
  path: '',
  component: '',
  icon: '',
  permission: '',
  sort: 0,
  status: 1,
});

const rules = computed<FormRules>(() => ({
  name: [{ required: true, message: t('validation.menuName'), trigger: 'blur' }],
  type: [{ required: true, message: t('validation.pleaseSelect'), trigger: 'change' }],
}));

/** 从菜单树中过滤掉按钮节点（按钮不能作为父菜单）。 */
function filterParentTree(nodes: MenuTreeNode[]): MenuTreeNode[] {
  return nodes
    .filter((n) => n.type !== MenuType.BUTTON)
    .map((n) => ({
      ...n,
      children: n.children && n.children.length > 0 ? filterParentTree(n.children) : undefined,
    }));
}

const parentTreeData = computed(() => filterParentTree(menuTree.value));

function getTypeLabel(type: number): string {
  if (type === MenuType.DIRECTORY) return t('system.menu.type.directory');
  if (type === MenuType.MENU) return t('system.menu.type.menu');
  return t('system.menu.type.button');
}

function typeTagType(type: number): '' | 'success' | 'info' | 'warning' | 'danger' {
  if (type === MenuType.DIRECTORY) return 'info';
  if (type === MenuType.MENU) return 'success';
  return 'warning';
}

async function fetchData() {
  loading.value = true;
  try {
    menuTree.value = (await menuApi.getTree()) ?? [];
  } finally {
    loading.value = false;
  }
}

function resetForm(parentId?: number) {
  form.id = 0;
  form.parentId = parentId;
  form.name = '';
  form.type = MenuType.MENU;
  form.path = '';
  form.component = '';
  form.icon = '';
  form.permission = '';
  form.sort = 0;
  form.status = 1;
}

/** 新增：传入父节点则在其下新增，否则顶级新增。 */
function openCreate(parent?: MenuTreeNode) {
  resetForm(parent?.id);
  dialogVisible.value = true;
}

function openEdit(row: MenuTreeNode) {
  form.id = row.id;
  form.parentId = row.parentId;
  form.name = row.name;
  form.type = row.type;
  form.path = row.path || '';
  form.component = row.component || '';
  form.icon = row.icon || '';
  form.permission = row.permission || '';
  form.sort = row.sort;
  form.status = row.status;
  dialogVisible.value = true;
}

async function submitForm() {
  if (!formRef.value) return;
  await formRef.value.validate(async (valid) => {
    if (!valid) return;
    try {
      const data = {
        parentId: form.parentId,
        name: form.name,
        type: form.type,
        path: form.path || undefined,
        component: form.component || undefined,
        icon: form.icon || undefined,
        permission: form.permission || undefined,
        sort: form.sort,
        status: form.status,
      };
      if (form.id) {
        await menuApi.update(form.id, data);
        ElMessage.success(t('common.messages.updateSuccess'));
      } else {
        await menuApi.create(data);
        ElMessage.success(t('common.messages.createSuccess'));
      }
      dialogVisible.value = false;
      fetchData();
    } catch {
      // handled by interceptor
    }
  });
}

async function handleDelete(row: MenuTreeNode) {
  try {
    await ElMessageBox.confirm(t('system.menu.messages.confirmDelete', { name: row.name }), t('common.tip'), {
      confirmButtonText: t('common.confirmButtonText'),
      cancelButtonText: t('common.cancelButtonText'),
      type: 'warning',
    });
    await menuApi.remove(row.id);
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
</style>
