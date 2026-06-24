<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

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
