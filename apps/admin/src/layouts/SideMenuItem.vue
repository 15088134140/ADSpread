<template>
  <!-- 目录：递归渲染子菜单 -->
  <el-sub-menu
    v-if="node.type === MenuType.DIRECTORY"
    :index="String(node.id)"
  >
    <template #title>
      <el-icon v-if="node.icon"><component :is="node.icon" /></el-icon>
      <span>{{ t(`${i18nKey}.label`) }}</span>
    </template>
    <side-menu-item
      v-for="child in node.children"
      :key="child.id"
      :node="child"
      :i18n-prefix="i18nKey"
    />
  </el-sub-menu>
  <!-- 菜单：可点击跳转（el-menu router 模式下 index 即路由 path） -->
  <el-menu-item
    v-else-if="node.type === MenuType.MENU"
    :index="node.path || String(node.id)"
  >
    <el-icon v-if="node.icon"><component :is="node.icon" /></el-icon>
    <template #title>{{ t(`${i18nKey}.label`) }}</template>
  </el-menu-item>
  <!-- type=3（按钮）不在侧边栏渲染，仅用于按钮级权限校验 -->
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { MenuType, type MenuTreeNode } from '@adspread/types';
import { menuNameToSlug } from './menu-i18n';

defineOptions({ name: 'SideMenuItem' });

const props = defineProps<{
  node: MenuTreeNode;
  i18nPrefix: string;
}>();

const { t } = useI18n();

/**
 * 当前节点的 i18n key 前缀，由父级前缀与节点 name 对应的 slug 拼接而成。
 * 后端菜单 name 为中文，通过 menuNameToSlug 映射到 locales/menu.ts 的英文 key 段；
 * 节点文案取 `${i18nKey}.label`。未命中映射时回退使用 name 本身。
 */
const i18nKey = computed(() => `${props.i18nPrefix}.${menuNameToSlug(props.node.name)}`);
</script>
