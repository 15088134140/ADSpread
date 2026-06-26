<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>素材管理</span>
          <el-upload
            :action="uploadAction"
            :headers="uploadHeaders"
            :show-file-list="false"
            :on-success="handleUploadSuccess"
            :on-error="handleUploadError"
          >
            <el-button type="primary">上传素材</el-button>
          </el-upload>
        </div>
      </template>

      <el-form :inline="true" :model="query">
        <el-form-item label="关键词">
          <el-input v-model="query.keyword" placeholder="素材名称" clearable />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="query.type" placeholder="全部" clearable style="width: 140px">
            <el-option v-for="item in materialTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="审核状态">
          <el-select v-model="query.auditStatus" placeholder="全部" clearable style="width: 140px">
            <el-option v-for="item in auditStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchData">查询</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="list">
        <el-table-column prop="name" label="素材名称" />
        <el-table-column label="类型">
          <template #default="{ row }">{{ getMaterialTypeLabel(row.type) }}</template>
        </el-table-column>
        <el-table-column label="大小">
          <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
        </el-table-column>
        <el-table-column prop="fileExtension" label="格式" />
        <el-table-column label="审核状态">
          <template #default="{ row }">
            <el-tag :type="getAuditTagType(row.auditStatus)">{{ getAuditStatusLabel(row.auditStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="审核时间">
          <template #default="{ row }">{{ formatDateTime(row.auditTime) }}</template>
        </el-table-column>
        <el-table-column prop="auditReason" label="驳回原因" show-overflow-tooltip />
        <el-table-column label="创建时间">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="240">
          <template #default="{ row }">
            <el-button link type="primary" @click="openPreview(row)">预览</el-button>
            <el-button link type="success" @click="openApprove(row)" v-if="row.auditStatus === 'PENDING'">通过</el-button>
            <el-button link type="warning" @click="openReject(row)" v-if="row.auditStatus === 'PENDING'">驳回</el-button>
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

    <el-dialog v-model="rejectDialogVisible" title="驳回素材" width="480px" :close-on-click-modal="false">
      <el-form :model="rejectForm" label-width="80px">
        <el-form-item label="驳回原因">
          <el-input v-model="rejectForm.reason" type="textarea" :rows="4" placeholder="请输入驳回原因（至少10个字符）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmReject">确定驳回</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="previewDialogVisible" :title="previewMaterial?.name || '素材预览'" width="640px" top="6vh">
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
          <el-empty v-else description="不支持预览该类型素材" />
        </div>
        <el-descriptions :column="2" border size="small" class="preview-info">
          <el-descriptions-item label="素材名称">{{ previewMaterial.name }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ getMaterialTypeLabel(previewMaterial.type) }}</el-descriptions-item>
          <el-descriptions-item label="格式">{{ previewMaterial.fileExtension }}</el-descriptions-item>
          <el-descriptions-item label="大小">{{ formatFileSize(previewMaterial.fileSize) }}</el-descriptions-item>
          <el-descriptions-item label="审核状态">
            <el-tag :type="getAuditTagType(previewMaterial.auditStatus)">{{ getAuditStatusLabel(previewMaterial.auditStatus) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDateTime(previewMaterial.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="文件地址" :span="2">
            <el-link :href="getFullUrl(previewMaterial.fileUrl)" target="_blank" type="primary">{{ getFullUrl(previewMaterial.fileUrl) }}</el-link>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { materialApi, type Material } from '@/api/material';
import { materialTypeOptions, auditStatusOptions } from '@/utils/options';
import { dateUtils } from '@/utils/date';
import { fileUtils } from '@/utils/file';
import { useUserStore } from '@/stores/user';

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
  return materialTypeOptions.find((item) => item.value === value)?.label || value;
}

function getAuditStatusLabel(value: string): string {
  return auditStatusOptions.find((item) => item.value === value)?.label || value;
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
  ElMessage.success('上传成功');
  fetchData();
}

function handleUploadError() {
  ElMessage.error('上传失败');
}

async function openApprove(row: Material) {
  try {
    await ElMessageBox.confirm(`确定通过素材 "${row.name}" 的审核吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'success',
    });
    await materialApi.approve(row.id);
    ElMessage.success('审核通过');
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
    ElMessage.warning('驳回原因至少10个字符');
    return;
  }
  try {
    await materialApi.reject(rejectForm.id, { reason: rejectForm.reason });
    ElMessage.success('已驳回');
    rejectDialogVisible.value = false;
    fetchData();
  } catch {
    // handled by interceptor
  }
}

async function handleDelete(row: Material) {
  try {
    await ElMessageBox.confirm(`确定要删除素材 "${row.name}" 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await materialApi.delete(row.id);
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
