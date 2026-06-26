<template>
  <el-config-provider :locale="elementLocale">
    <router-view />
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { ElConfigProvider } from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import en from 'element-plus/es/locale/lang/en';
import ja from 'element-plus/es/locale/lang/ja';
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();

const elementLocaleMap = {
  ja,
  'zh-CN': zhCn,
  en,
};

const elementLocale = computed(() => elementLocaleMap[appStore.locale]);

onMounted(() => {
  console.log('🚀 ADSpread Admin started');
});
</script>

<style>
#app {
  width: 100%;
  height: 100%;
}
</style>
