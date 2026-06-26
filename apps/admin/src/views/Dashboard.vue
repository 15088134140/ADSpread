<template>
  <div class="dashboard">
    <!-- 加载态 -->
    <el-skeleton v-if="loading" :rows="8" animated />

    <!-- 失败态 -->
    <el-empty v-else-if="error" :description="t('common.dashboard.loadFailed')">
      <el-button type="primary" @click="loadOverview">{{ t('common.refresh') }}</el-button>
    </el-empty>

    <!-- 正常态 -->
    <template v-else>
      <!-- 区块 A：核心指标卡 -->
      <el-row :gutter="20">
        <el-col v-if="hasPermission('device:list')" :xs="24" :sm="12" :md="6">
          <el-card
            class="stat-card is-clickable"
            shadow="hover"
            role="button"
            tabindex="0"
            @click="go('/device')"
            @keyup.enter="go('/device')"
          >
            <div class="stat-content">
              <div class="stat-icon device">
                <el-icon><Monitor /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">
                  {{ ((overview?.device.onlineRate ?? 0) * 100).toFixed(1) }}%
                </div>
                <div class="stat-label">{{ t('common.dashboard.deviceOnlineRate') }}</div>
                <div class="stat-sub">
                  {{ t('common.dashboard.online') }} {{ overview?.device.online ?? 0 }}
                  / {{ t('common.dashboard.offline') }} {{ overview?.device.offline ?? 0 }}
                  / {{ t('common.dashboard.unbound') }} {{ overview?.device.unbound ?? 0 }}
                </div>
              </div>
            </div>
          </el-card>
        </el-col>

        <el-col v-if="hasPermission('material:list')" :xs="24" :sm="12" :md="6">
          <el-card
            class="stat-card is-clickable"
            shadow="hover"
            role="button"
            tabindex="0"
            @click="go('/material?auditStatus=PENDING')"
            @keyup.enter="go('/material?auditStatus=PENDING')"
          >
            <div class="stat-content">
              <div class="stat-icon material">
                <el-icon><Picture /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ overview?.material.pending ?? 0 }}</div>
                <div class="stat-label">{{ t('common.dashboard.pendingMaterial') }}</div>
                <div class="stat-sub">
                  {{ t('common.dashboard.approved') }} {{ overview?.material.approved ?? 0 }}
                  / {{ t('common.dashboard.rejected') }} {{ overview?.material.rejected ?? 0 }}
                </div>
              </div>
            </div>
          </el-card>
        </el-col>

        <el-col v-if="hasPermission('publish:list')" :xs="24" :sm="12" :md="6">
          <el-card
            class="stat-card is-clickable"
            shadow="hover"
            role="button"
            tabindex="0"
            @click="go('/publish')"
            @keyup.enter="go('/publish')"
          >
            <div class="stat-content">
              <div class="stat-icon program">
                <el-icon><Promotion /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ overview?.publish.active ?? 0 }}</div>
                <div class="stat-label">{{ t('common.dashboard.activePublishPlan') }}</div>
                <div class="stat-sub">
                  {{ t('common.dashboard.inactive') }} {{ overview?.publish.inactive ?? 0 }}
                </div>
              </div>
            </div>
          </el-card>
        </el-col>

        <el-col :xs="24" :sm="12" :md="6">
          <el-card class="stat-card" shadow="hover">
            <div class="stat-content">
              <div class="stat-icon store">
                <el-icon><TrendCharts /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">
                  {{ ((overview?.publish.pushSuccessRate ?? 0) * 100).toFixed(1) }}%
                </div>
                <div class="stat-label">{{ t('common.dashboard.pushSuccessRate') }}</div>
                <div class="stat-sub">
                  {{ t('common.dashboard.successCount') }} {{ overview?.publish.recentPushSuccess ?? 0 }}
                  / {{ t('common.dashboard.failureCount') }} {{ overview?.publish.recentPushFail ?? 0 }}
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 区块 B：内容链路漏斗 -->
      <el-card class="section-card">
        <template #header>{{ t('common.dashboard.contentFunnel') }}</template>
        <div ref="funnelChartRef" class="funnel-chart"></div>
      </el-card>

      <!-- 区块 C：运营待办 -->
      <el-card v-if="todoItems.length > 0" class="section-card">
        <template #header>{{ t('common.dashboard.operationTodo') }}</template>
        <el-empty
          v-if="visibleTodos.length === 0"
          :description="t('common.dashboard.noTodo')"
          :image-size="80"
        />
        <el-row v-else :gutter="16" class="todo-list">
          <el-col v-for="item in visibleTodos" :key="item.key" :xs="24" :sm="8">
            <div
              class="todo-item"
              role="button"
              tabindex="0"
              @click="go(item.route)"
              @keyup.enter="go(item.route)"
            >
              <div class="todo-count">{{ item.count }}</div>
              <div class="todo-label">{{ t(item.labelKey) }}</div>
            </div>
          </el-col>
        </el-row>
      </el-card>

      <!-- 区块 D：最近操作日志 -->
      <el-card v-if="hasPermission('log:list')" class="section-card">
        <template #header>
          <div class="card-header">
            <span>{{ t('common.dashboard.recentLogs') }}</span>
            <el-button link type="primary" @click="go('/system/log')">
              {{ t('common.dashboard.viewAll') }}
            </el-button>
          </div>
        </template>
        <el-table :data="recentLogs" style="width: 100%">
          <el-table-column prop="username" :label="t('common.dashboard.operator')" width="120" />
          <el-table-column
            prop="operation"
            :label="t('common.dashboard.operationContent')"
            show-overflow-tooltip
          />
          <el-table-column :label="t('common.dashboard.durationMs')" width="120">
            <template #default="{ row }">{{ row.durationMs }}</template>
          </el-table-column>
          <el-table-column :label="t('common.status')" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
                {{ row.status === 1 ? t('common.success') : t('common.failure') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="t('common.dashboard.time')" width="180">
            <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Monitor, Picture, Promotion, TrendCharts } from '@element-plus/icons-vue';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, TitleComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { formatDateTime } from '@adspread/shared';
import { dashboardApi, type DashboardOverview, type DashboardRecentLog } from '@/api/dashboard';
import { usePermissionStore } from '@/stores/permission';

echarts.use([BarChart, GridComponent, TooltipComponent, TitleComponent, CanvasRenderer]);

const { t } = useI18n();
const router = useRouter();
const permissionStore = usePermissionStore();
const hasPermission = (code: string) => permissionStore.hasPermission(code);

const loading = ref(true);
const error = ref(false);
const overview = ref<DashboardOverview | null>(null);

const funnelChartRef = ref<HTMLElement | null>(null);
const chartInstance = ref<echarts.ECharts | null>(null);

interface TodoItem {
  key: 'pendingMaterial' | 'pushFail' | 'unboundDevice';
  count: number;
  route: string;
  labelKey: string;
}

// 待办项与权限码映射
const todoPermissionMap: Record<TodoItem['key'], string> = {
  pendingMaterial: 'material:audit',
  pushFail: 'publish:list',
  unboundDevice: 'device:list',
};

// 区块 C：按权限过滤后的全部待办项
const todoItems = computed<TodoItem[]>(() => {
  const o = overview.value;
  if (!o) return [];
  const items: TodoItem[] = [
    {
      key: 'pendingMaterial',
      count: o.todo.pendingMaterial,
      route: '/material?auditStatus=PENDING',
      labelKey: 'common.dashboard.pendingMaterial',
    },
    {
      key: 'pushFail',
      count: o.todo.pushFail,
      route: '/publish',
      labelKey: 'common.dashboard.pushFail',
    },
    {
      key: 'unboundDevice',
      count: o.todo.unboundDevice,
      route: '/device',
      labelKey: 'common.dashboard.unboundDevice',
    },
  ];
  return items.filter((it) => hasPermission(todoPermissionMap[it.key]));
});

// 仅展示待办数 > 0 的项；全部为 0 时展示“暂无待办”
const visibleTodos = computed(() => todoItems.value.filter((it) => it.count > 0));

const recentLogs = computed<DashboardRecentLog[]>(() =>
  (overview.value?.recentLogs ?? []).slice(0, 10)
);

async function loadOverview() {
  loading.value = true;
  error.value = false;
  try {
    overview.value = await dashboardApi.getOverview();
    loading.value = false;
    await nextTick();
    renderFunnel();
  } catch (e) {
    loading.value = false;
    error.value = true;
    ElMessage.error(t('common.dashboard.loadFailed'));
  }
}

function renderFunnel() {
  if (!funnelChartRef.value || !overview.value) return;
  if (!chartInstance.value) {
    chartInstance.value = echarts.init(funnelChartRef.value);
  }
  const o = overview.value;
  const sep = ' · ';
  const bars = [
    {
      name: `${t('common.dashboard.materialStage')}${sep}${t('common.dashboard.pending')}`,
      value: o.material.pending,
      color: '#f6c022',
    },
    {
      name: `${t('common.dashboard.materialStage')}${sep}${t('common.dashboard.approved')}`,
      value: o.material.approved,
      color: '#5ad8a6',
    },
    {
      name: `${t('common.dashboard.programStage')}${sep}${t('common.dashboard.draft')}`,
      value: o.program.draft,
      color: '#5b8ff9',
    },
    {
      name: `${t('common.dashboard.programStage')}${sep}${t('common.dashboard.published')}`,
      value: o.program.published,
      color: '#5ad8a6',
    },
    {
      name: `${t('common.dashboard.publishPlanStage')}${sep}${t('common.dashboard.active')}`,
      value: o.publish.active,
      color: '#5ad8a6',
    },
    {
      name: `${t('common.dashboard.publishPlanStage')}${sep}${t('common.dashboard.inactive')}`,
      value: o.publish.inactive,
      color: '#c2c8d5',
    },
    {
      name: `${t('common.dashboard.pushStage')}${sep}${t('common.dashboard.successCount')}`,
      value: o.publish.recentPushSuccess,
      color: '#5ad8a6',
    },
    {
      name: `${t('common.dashboard.pushStage')}${sep}${t('common.dashboard.failureCount')}`,
      value: o.publish.recentPushFail,
      color: '#f76b6c',
    },
  ];

  chartInstance.value.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 10, right: 60, top: 10, bottom: 10, containLabel: true },
    xAxis: { type: 'value', minInterval: 1 },
    yAxis: {
      type: 'category',
      inverse: true,
      data: bars.map((b) => b.name),
    },
    series: [
      {
        type: 'bar',
        data: bars.map((b) => ({ value: b.value, itemStyle: { color: b.color } })),
        barMaxWidth: 26,
        label: { show: true, position: 'right', formatter: '{c}' },
      },
    ],
  });
}

function handleResize() {
  chartInstance.value?.resize();
}

function go(path: string) {
  router.push(path);
}

onMounted(() => {
  loadOverview();
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  chartInstance.value?.dispose();
  chartInstance.value = null;
});
</script>

<style scoped lang="scss">
.dashboard {
  .section-card {
    margin-top: 20px;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .stat-card {
    &.is-clickable {
      cursor: pointer;
    }

    .stat-content {
      display: flex;
      align-items: center;

      .stat-icon {
        width: 60px;
        height: 60px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        color: #fff;
        margin-right: 20px;
        flex-shrink: 0;

        &.store {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        &.device {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }

        &.material {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }

        &.program {
          background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
        }
      }

      .stat-info {
        min-width: 0;

        .stat-value {
          font-size: 28px;
          font-weight: bold;
          color: #333;
        }

        .stat-label {
          font-size: 14px;
          color: #666;
          margin-top: 4px;
        }

        .stat-sub {
          font-size: 12px;
          color: #999;
          margin-top: 6px;
          line-height: 1.4;
        }
      }
    }
  }

  .funnel-chart {
    width: 100%;
    height: 360px;
  }

  .todo-list {
    margin-top: 0;

    .todo-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      border: 1px solid var(--el-border-color-light);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        border-color: var(--el-color-primary);
        background: var(--el-color-primary-light-9);
      }

      .todo-count {
        font-size: 28px;
        font-weight: bold;
        color: var(--el-color-warning);
      }

      .todo-label {
        font-size: 14px;
        color: #666;
        margin-top: 6px;
      }
    }
  }
}
</style>
