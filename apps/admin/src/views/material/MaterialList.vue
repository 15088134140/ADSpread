<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ t('material.title') }}</span>
          <el-upload
            :action="uploadAction"
            :headers="uploadHeaders"
            :show-file-list="false"
            :on-success="handleUploadSuccess"
            :on-error="handleUploadError"
          >
            <el-button type="primary">{{ t('material.uploadMaterial') }}</el-button>
          </el-upload>
        </div>
      </template>

      <el-form :inline="true" :model="query">
        <el-form-item :label="t('material.search.keyword')">
          <el-input v-model="query.keyword" :placeholder="t('material.search.keywordPlaceholder')" clearable />
        </el-form-item>
        <el-form-item :label="t('material.search.type')">
          <el-select v-model="query.type" :placeholder="t('material.search.all')" clearable style="width: 140px">
            <el-option v-for="item in materialTypeOptions" :key="item.value" :label="t(item.label)" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('material.search.auditStatus')">
          <el-select v-model="query.auditStatus" :placeholder="t('material.search.all')" clearable style="width: 140px">
            <el-option v-for="item in auditStatusOptions" :key="item.value" :label="t(item.label)" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchData">{{ t('common.query') }}</el-button>
          <el-button @click="resetQuery">{{ t('common.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="list">
        <el-table-column prop="name" :label="t('material.table.name')" />
        <el-table-column :label="t('material.table.type')">
          <template #default="{ row }">{{ getMaterialTypeLabel(row.type) }}</template>
        </el-table-column>
        <el-table-column :label="t('material.table.size')">
          <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
        </el-table-column>
        <el-table-column prop="fileExtension" :label="t('material.table.fileExtension')" />
        <el-table-column :label="t('material.table.auditStatus')">
          <template #default="{ row }">
            <el-tag :type="getAuditTagType(row.auditStatus)">{{ getAuditStatusLabel(row.auditStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('material.table.auditTime')">
          <template #default="{ row }">{{ formatDateTime(row.auditTime) }}</template>
        </el-table-column>
        <el-table-column prop="auditReason" :label="t('material.table.auditReason')" show-overflow-tooltip />
        <el-table-column :label="t('material.table.createdAt')">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column :label="t('material.table.operation')" width="240">
          <template #default="{ row }">
            <el-button link type="primary" @click="openPreview(row)">{{ t('material.table.preview') }}</el-button>
            <el-button link type="success" @click="openApprove(row)" v-if="row.auditStatus === 'PENDING'">{{ t('material.table.approve') }}</el-button>
            <el-button link type="warning" @click="openReject(row)" v-if="row.auditStatus === 'PENDING'">{{ t('material.table.reject') }}</el-button>
            <el-button link type="danger" @click="handleDelete(row)">{{ t('material.table.delete') }}</el-button>
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

    <el-dialog v-model="rejectDialogVisible" :title="t('material.rejectMaterial')" width="480px" :close-on-click-modal="false">
      <el-form :model="rejectForm" label-width="80px">
        <el-form-item :label="t('material.form.rejectReason')">
          <el-input v-model="rejectForm.reason" type="textarea" :rows="4" :placeholder="t('material.form.rejectReasonPlaceholder')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="confirmReject">{{ t('material.form.confirmReject') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="previewDialogVisible" :title="previewMaterial?.name || t('material.previewTitle')" width="640px" top="6vh">
      <div v-if="previewMaterial" class="preview-container">
        <div class="preview-media">
          <img
            v-if="previewMaterial.type === 'IMAGE'"
            :src="getFullUrl(previewMaterial.fileUrl)"
            :alt="previewMaterial.name"
            class="preview-image"
          />
          <video
            v-else-if="previewMaterial.type === 'VIDEO'"
            :src="getFullUrl(previewMaterial.fileUrl)"
            controls
            autoplay
            class="preview-video"
          />
          <el-empty v-else :description="t('material.preview.unsupported')" />
        </div>
        <el-descriptions :column="2" border size="small" class="preview-info">
          <el-descriptions-item :label="t('material.preview.name')">{{ previewMaterial.name }}</el-descriptions-item>
          <el-descriptions-item :label="t('material.preview.type')">{{ getMaterialTypeLabel(previewMaterial.type) }}</el-descriptions-item>
          <el-descriptions-item :label="t('material.preview.fileExtension')">{{ previewMaterial.fileExtension }}</el-descriptions-item>
          <el-descriptions-item :label="t('material.preview.size')">{{ formatFileSize(previewMaterial.fileSize) }}</el-descriptions-item>
          <el-descriptions-item :label="t('material.preview.auditStatus')">
            <el-tag :type="getAuditTagType(previewMaterial.auditStatus)">{{ getAuditStatusLabel(previewMaterial.auditStatus) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('material.preview.createdAt')">{{ formatDateTime(previewMaterial.createdAt) }}</el-descriptions-item>
          <el-descriptions-item :label="t('material.preview.fileUrl')" :span="2">
            <el-link :href="getFullUrl(previewMaterial.fileUrl)" target="_blank" type="primary">{{ getFullUrl(previewMaterial.fileUrl) }}</el-link>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { materialApi, type Material } from '@/api/material';
import { materialTypeOptions, auditStatusOptions } from '@/utils/options';
import { dateUtils } from '@/utils/date';
import { fileUtils } from '@/utils/file';
import { useUserStore } from '@/stores/user';

const { t } = useI18n();
const { formatDateTime } = dateUtils;
const userStore = useUserStore();

const loading = ref(false);
const list = ref<Material[]>([]);
const total = ref(0);

const query = reactive({
  keyword: '',
  type: '',
  auditStatus: '',
  page: 1,
  pageSize: 20,
});

const uploadAction = computed(() => `${import.meta.env.VITE_API_BASE_URL || '/api'}/materials/upload`);
const uploadHeaders = computed(() => ({ Authorization: `Bearer ${userStore.token}` }));

const rejectDialogVisible = ref(false);
const rejectForm = reactive({ id: 0, reason: '' });

const previewDialogVisible = ref(false);
const previewMaterial = ref<Material | null>(null);

/**
 * 素材 fileUrl 形如 "/uploads/materials/xxx.jpg"，是后端静态资源路径。
 * 前端代理仅转发 /api，因此需拼接后端 origin 指向 3000 端口。
 */
function getFullUrl(fileUrl: string): string {
  if (!fileUrl) return '';
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  const apiBase = import.meta.env.VITE_API_BASE_URL || '/api';
  // apiBase 形如 "/api" 或 "http://host:3000/api"，去掉末尾 "/api" 得到后端 origin
  const base = apiBase.replace(/\/api\/?$/, '');
  return `${base}${fileUrl}`;
}

function openPreview(row: Material) {
  previewMaterial.value = row;
  previewDialogVisible.value = true;
}

function getMaterialTypeLabel(value: string): string {
  const item = materialTypeOptions.find((o) => o.value === value);
  return item ? t(item.label) : value;
}

function getAuditStatusLabel(value: string): string {
  const item = auditStatusOptions.find((o) => o.value === value);
  return item ? t(item.label) : value;
}

function getAuditTagType(value: string): string {
  if (value === 'APPROVED') return 'success';
  if (value === 'REJECTED') return 'danger';
  return 'warning';
}

function formatFileSize(bytes: number): string {
  return fileUtils.formatFileSize(bytes);
}

async function fetchData() {
  loading.value = true;
  try {
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize };
    if (query.keyword) params.keyword = query.keyword;
    if (query.type) params.type = query.type;
    if (query.auditStatus) params.auditStatus = query.auditStatus;
    const result = await materialApi.getList(params as any);
    list.value = result.list;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

function resetQuery() {
  query.keyword = '';
  query.type = '';
  query.auditStatus = '';
  query.page = 1;
  fetchData();
}

function handleUploadSuccess() {
  ElMessage.success(t('common.messages.uploadSuccess'));
  fetchData();
}

function handleUploadError() {
  ElMessage.error(t('common.messages.uploadFailed'));
}

async function openApprove(row: Material) {
  try {
    await ElMessageBox.confirm(t('material.messages.confirmApprove', { name: row.name }), t('common.tip'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'success',
    });
    await materialApi.approve(row.id);
    ElMessage.success(t('material.messages.approved'));
    fetchData();
  } catch {
    // cancelled
  }
}

function openReject(row: Material) {
  rejectForm.id = row.id;
  rejectForm.reason = '';
  rejectDialogVisible.value = true;
}

async function confirmReject() {
  if (rejectForm.reason.length < 10) {
    ElMessage.warning(t('material.messages.rejectReasonMinLength'));
    return;
  }
  try {
    await materialApi.reject(rejectForm.id, { reason: rejectForm.reason });
    ElMessage.success(t('material.messages.rejected'));
    rejectDialogVisible.value = false;
    fetchData();
  } catch {
    // handled by interceptor
  }
}

async function handleDelete(row: Material) {
  try {
    await ElMessageBox.confirm(t('material.messages.confirmDelete', { name: row.name }), t('common.tip'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
    });
    await materialApi.delete(row.id);
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

.preview-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-media {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  max-height: 480px;
  overflow: hidden;
  background: #f5f7fa;
  border-radius: 4px;
}

.preview-image {
  max-width: 100%;
  max-height: 480px;
  object-fit: contain;
}

.preview-video {
  max-width: 100%;
  max-height: 480px;
}

.preview-info {
  margin-top: 4px;
}
</style>
