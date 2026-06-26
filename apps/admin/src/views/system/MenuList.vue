<template>
  <div class="page-placeholder">
    <el-empty :description="`${t('menu.system.menu.label')} - TODO (Task 12)`" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<style scoped>
.page-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}
</style>
