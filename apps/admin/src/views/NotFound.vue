<template>
  <div class="not-found">
    <div class="content">
      <h1>404</h1>
      <p>{{ t('common.pageNotFound') }}</p>
      <el-button type="primary" @click="$router.push('/')">{{ t('common.backHome') }}</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<style scoped lang="scss">
.not-found {
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f0f2f5;

  .content {
    text-align: center;

    h1 {
      font-size: 120px;
      font-weight: bold;
      color: #409eff;
      margin-bottom: 20px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
    }

    p {
      font-size: 18px;
      color: #666;
      margin-bottom: 30px;
    }
  }
}
</style>
