<template>
  <el-dialog
    :model-value="modelValue"
    :title="title || t('device.batchImport')"
    width="640px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
    @close="resetState"
  >
    <div class="import-dialog-body">
      <div class="actions-bar">
        <el-button :loading="downloading" @click="downloadTemplate">
          {{ t('device.downloadTemplate') }}
        </el-button>
      </div>

      <el-upload
        drag
        :auto-upload="false"
        :limit="1"
        accept=".xlsx,.xls"
        :on-change="handleFileChange"
        :on-remove="handleFileRemove"
        :on-exceed="handleExceed"
        :file-list="fileList"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">{{ t('device.uploadAreaTip') }}</div>
        <template #tip>
          <div class="el-upload__tip">{{ t('device.uploadFormatTip') }}</div>
        </template>
      </el-upload>

      <div class="import-actions">
        <el-button
          type="primary"
          :loading="uploading"
          :disabled="!selectedFile"
          @click="doImport"
        >
          {{ t('device.startImport') }}
        </el-button>
      </div>

      <div v-if="result" class="import-result">
        <div class="result-summary">
          <el-tag type="success">{{ t('device.successCount') }}: {{ result.successCount }}</el-tag>
          <el-tag :type="result.failCount > 0 ? 'danger' : 'info'">
            {{ t('device.failCount') }}: {{ result.failCount }}
          </el-tag>
        </div>
        <div v-if="result.failures.length > 0" class="result-failures">
          <h4 class="failures-title">{{ t('device.failureDetail') }}</h4>
          <el-table :data="result.failures" max-height="240" border size="small">
            <el-table-column prop="row" :label="t('device.row')" width="80" />
            <el-table-column prop="field" :label="t('device.field')" width="140">
              <template #default="{ row }">{{ row.field || '-' }}</template>
            </el-table-column>
            <el-table-column prop="reason" :label="t('device.reason')" />
          </el-table>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ t('common.confirm') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, type UploadFile } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import type { ImportResult } from '@adspread/types';
import { deviceApi } from '@/api/device';

const props = defineProps<{
  modelValue: boolean;
  title?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  success: [];
}>();

const { t } = useI18n();

const fileList = ref<UploadFile[]>([]);
const selectedFile = ref<File | null>(null);
const uploading = ref(false);
const downloading = ref(false);
const result = ref<ImportResult | null>(null);

function resetState() {
  fileList.value = [];
  selectedFile.value = null;
  uploading.value = false;
  result.value = null;
}

// 弹窗打开时重置状态
watch(
  () => props.modelValue,
  (val) => {
    if (val) resetState();
  },
);

function handleFileChange(file: UploadFile) {
  if (file.raw) {
    selectedFile.value = file.raw;
    fileList.value = [file];
    result.value = null;
  }
}

function handleFileRemove() {
  selectedFile.value = null;
  fileList.value = [];
}

function handleExceed(files: File[]) {
  // limit=1 时替换为最新选择的文件
  const file = files[0];
  selectedFile.value = file;
  fileList.value = [{ name: file.name, uid: Date.now() } as UploadFile];
  result.value = null;
}

async function downloadTemplate() {
  downloading.value = true;
  try {
    const blob = await deviceApi.getImportTemplate();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'device-import-template.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    // handled by interceptor
  } finally {
    downloading.value = false;
  }
}

async function doImport() {
  if (!selectedFile.value) return;
  uploading.value = true;
  try {
    const res = await deviceApi.importDevices(selectedFile.value);
    result.value = res;
    if (res.failCount === 0 && res.successCount > 0) {
      ElMessage.success(t('common.messages.operateSuccess'));
      emit('success');
    } else if (res.failCount > 0) {
      ElMessage.warning(t('common.messages.operateFailed'));
    }
  } catch {
    // handled by interceptor
  } finally {
    uploading.value = false;
  }
}
</script>

<style scoped>
.actions-bar {
  margin-bottom: 12px;
}

.import-actions {
  margin-top: 16px;
  text-align: center;
}

.import-result {
  margin-top: 20px;
}

.result-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.failures-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
}
</style>
