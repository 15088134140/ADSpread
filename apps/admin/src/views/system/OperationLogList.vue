<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ t('system.log.title') }}</span>
        </div>
      </template>

      <el-form :inline="true" :model="query">
        <el-form-item :label="t('system.log.search.username')">
          <el-input v-model="query.username" :placeholder="t('system.log.search.username')" clearable />
        </el-form-item>
        <el-form-item :label="t('system.log.search.operation')">
          <el-input v-model="query.operation" :placeholder="t('system.log.search.operation')" clearable />
        </el-form-item>
        <el-form-item :label="t('system.log.search.timeRange')">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            :start-placeholder="t('system.log.search.timeRange')"
            :end-placeholder="t('system.log.search.timeRange')"
            clearable
          />
        </el-form-item>
        <el-form-item :label="t('system.log.filter.status')">
          <el-select v-model="query.status" :placeholder="t('common.all')" clearable style="width: 120px">
            <el-option :label="t('system.log.status.success')" :value="1" />
            <el-option :label="t('system.log.status.failure')" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSearch">{{ t('common.query') }}</el-button>
          <el-button @click="resetQuery">{{ t('common.reset') }}</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="list">
        <el-table-column prop="username" :label="t('system.log.table.username')" />
        <el-table-column prop="operation" :label="t('system.log.table.operation')" />
        <el-table-column prop="method" :label="t('system.log.table.method')" width="90" />
        <el-table-column prop="ip" :label="t('system.log.table.ip')" width="140" />
        <el-table-column :label="t('system.log.table.duration')" width="120">
          <template #default="{ row }">{{ row.time }}</template>
        </el-table-column>
        <el-table-column :label="t('system.log.table.status')" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? t('system.log.status.success') : t('system.log.status.failure') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('system.log.table.createdAt')" width="170">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column :label="t('common.operation')" width="100" fixed="right">
          <template #default="{ row }">
            <el-button v-permission="'log:list'" link type="primary" @click="openDetail(row)">{{ t('system.log.table.detail') }}</el-button>
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

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" :title="t('system.log.detail.title')" width="640px">
      <div v-loading="false">
        <h4 class="detail-section-title">{{ t('system.log.table.params') }}</h4>
        <pre class="detail-pre">{{ formatJson(currentLog?.params) || t('system.log.detail.empty') }}</pre>

        <h4 class="detail-section-title">{{ t('system.log.table.errorMsg') }}</h4>
        <pre class="detail-pre">{{ currentLog?.errorMsg || t('system.log.detail.empty') }}</pre>

        <el-descriptions :column="2" border style="margin-top: 16px">
          <el-descriptions-item :label="t('system.log.table.username')">{{ currentLog?.username }}</el-descriptions-item>
          <el-descriptions-item :label="t('system.log.table.operation')">{{ currentLog?.operation }}</el-descriptions-item>
          <el-descriptions-item :label="t('system.log.table.method')">{{ currentLog?.method || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('system.log.table.ip')">{{ currentLog?.ip || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="t('system.log.table.duration')">{{ currentLog?.time }}</el-descriptions-item>
          <el-descriptions-item :label="t('system.log.table.status')">
            <el-tag :type="currentLog?.status === 1 ? 'success' : 'danger'" size="small">
              {{ currentLog?.status === 1 ? t('system.log.status.success') : t('system.log.status.failure') }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import type { OperationLog } from '@adspread/types';
import { operationLogApi } from '@/api/operationLog';
import { dateUtils } from '@/utils/date';

const { t } = useI18n();
const { formatDateTime } = dateUtils;

const loading = ref(false);
const list = ref<OperationLog[]>([]);
const total = ref(0);

const query = reactive({
  username: '',
  operation: '',
  status: undefined as number | undefined,
  startTime: undefined as string | undefined,
  endTime: undefined as string | undefined,
  page: 1,
  pageSize: 20,
});

const dateRange = ref<[string, string] | null>(null);

async function fetchData() {
  loading.value = true;
  try {
    // 同步日期范围到查询参数
    if (dateRange.value && dateRange.value.length === 2) {
      query.startTime = `${dateRange.value[0]}T00:00:00.000Z`;
      query.endTime = `${dateRange.value[1]}T23:59:59.999Z`;
    } else {
      query.startTime = undefined;
      query.endTime = undefined;
    }
    const params: Record<string, unknown> = { page: query.page, pageSize: query.pageSize };
    if (query.username) params.username = query.username;
    if (query.operation) params.operation = query.operation;
    if (query.startTime) params.startTime = query.startTime;
    if (query.endTime) params.endTime = query.endTime;
    if (typeof query.status === 'number') params.status = query.status;
    const result = await operationLogApi.getList(params as any);
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
  query.operation = '';
  query.status = undefined;
  query.startTime = undefined;
  query.endTime = undefined;
  dateRange.value = null;
  query.page = 1;
  fetchData();
}

// ===== 详情 =====
const detailVisible = ref(false);
const currentLog = ref<OperationLog | null>(null);

function openDetail(row: OperationLog) {
  currentLog.value = row;
  detailVisible.value = true;
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
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

.detail-section-title {
  margin: 12px 0 8px;
  font-size: 14px;
  font-weight: 600;
}

.detail-pre {
  margin: 0;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  max-height: 220px;
  overflow: auto;
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
