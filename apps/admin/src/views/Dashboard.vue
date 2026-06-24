<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon store">
              <el-icon><Shop /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.storeCount }}</div>
              <div class="stat-label">门店总数</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon device">
              <el-icon><Monitor /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.deviceCount }}</div>
              <div class="stat-label">设备总数</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon material">
              <el-icon><Picture /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.materialCount }}</div>
              <div class="stat-label">素材总数</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon program">
              <el-icon><Film /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.onlineDeviceCount }}</div>
              <div class="stat-label">在线设备</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :xs="24" :md="16">
        <el-card title="最近操作">
          <el-table :data="recentLogs" style="width: 100%">
            <el-table-column prop="username" label="操作人" width="100" />
            <el-table-column prop="operation" label="操作内容" />
            <el-table-column prop="time" label="耗时(ms)" width="100" />
            <el-table-column prop="createdAt" label="时间" width="180">
              <template #default="{ row }">
                {{ formatDateTime(row.createdAt) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="8">
        <el-card title="快捷操作">
          <div class="quick-actions">
            <el-button type="primary" @click="$router.push('/store')" size="large" class="action-btn">
              <el-icon><Shop /></el-icon>
              <span>门店管理</span>
            </el-button>
            <el-button type="success" @click="$router.push('/device')" size="large" class="action-btn">
              <el-icon><Monitor /></el-icon>
              <span>设备管理</span>
            </el-button>
            <el-button type="warning" @click="$router.push('/material')" size="large" class="action-btn">
              <el-icon><Picture /></el-icon>
              <span>素材管理</span>
            </el-button>
            <el-button type="info" @click="$router.push('/program')" size="large" class="action-btn">
              <el-icon><Film /></el-icon>
              <span>节目制作</span>
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Shop, Monitor, Picture, Film } from '@element-plus/icons-vue';
import { formatDateTime } from '@adspread/shared';

const stats = ref({
  storeCount: 0,
  deviceCount: 0,
  materialCount: 0,
  onlineDeviceCount: 0,
});

const recentLogs = ref<any[]>([]);

onMounted(() => {
  // Mock data - will be replaced with actual API calls
  stats.value = {
    storeCount: 24,
    deviceCount: 156,
    materialCount: 342,
    onlineDeviceCount: 148,
  };

  recentLogs.value = [
    { id: 1, username: 'admin', operation: '创建门店 "北京朝阳店"', time: 120, createdAt: new Date().toISOString() },
    { id: 2, username: 'admin', operation: '上传素材 "促销海报.jpg"', time: 850, createdAt: new Date().toISOString() },
    { id: 3, username: 'admin', operation: '编辑节目 "春季新品"', time: 230, createdAt: new Date().toISOString() },
    { id: 4, username: 'admin', operation: '发布广告到 5 家门店', time: 1500, createdAt: new Date().toISOString() },
    { id: 5, username: 'admin', operation: '删除设备 "PAD-001"', time: 65, createdAt: new Date().toISOString() },
  ];
});
</script>

<style scoped lang="scss">
.stat-card {
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
    }
  }
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
}
</style>
