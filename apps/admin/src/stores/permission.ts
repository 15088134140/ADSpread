import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { MenuTreeNode } from '@adspread/types';
import { authApi } from '@/api/auth';
import router from '@/router';
import { buildDynamicRoutes } from '@/router/dynamic';

/**
 * 权限 store：负责动态菜单树、按钮级权限集合，以及按菜单动态注册/移除路由。
 * 菜单数据由后端 GET /auth/menus 返回，登录后加载。
 *
 * 注意：本模块顶部 import router 会与 router/index.ts import 本 store 形成
 * 循环依赖，但双方均只在函数体内使用对方导出（运行时调用），模块求值阶段不
 * 访问，因此安全。
 */
export const usePermissionStore = defineStore('permission', () => {
  const menuTree = ref<MenuTreeNode[]>([]);
  const permissions = ref<Set<string>>(new Set());
  /** 动态路由是否已注册（用于守卫判断是否需要重新拉取并 addRoute）。 */
  const isRoutesAdded = ref(false);
  /** 已动态注册的路由 name 列表，登出时按名移除，避免再次登录同名冲突。 */
  const addedRouteNames = ref<string[]>([]);

  /**
   * 递归扁平化菜单节点，收集所有 permission 字段（过滤空值）。
   */
  function collectPermissions(nodes: MenuTreeNode[], set: Set<string>): void {
    for (const node of nodes) {
      if (node.permission) {
        set.add(node.permission);
      }
      if (node.children && node.children.length > 0) {
        collectPermissions(node.children, set);
      }
    }
  }

  /**
   * 拉取当前用户可见菜单，构建菜单树与权限集合，
   * 并按菜单树动态注册授权路由（作为 Layout 子路由）。
   */
  async function fetchMenus(): Promise<void> {
    const menus = await authApi.getMenus();
    menuTree.value = menus ?? [];
    const set = new Set<string>();
    collectPermissions(menuTree.value, set);
    permissions.value = set;

    if (!isRoutesAdded.value) {
      const dynamicRoutes = buildDynamicRoutes(menuTree.value);
      for (const route of dynamicRoutes) {
        if (route.name) {
          router.addRoute('Layout', route);
          addedRouteNames.value.push(String(route.name));
        }
      }
      isRoutesAdded.value = true;
    }
  }

  /**
   * 判断当前用户是否拥有指定权限码。
   */
  function hasPermission(code: string): boolean {
    return permissions.value.has(code);
  }

  /**
   * 重置菜单、权限并移除动态注册的路由（登出时调用）。
   */
  function reset(): void {
    for (const name of addedRouteNames.value) {
      router.removeRoute(name);
    }
    addedRouteNames.value = [];
    isRoutesAdded.value = false;

    menuTree.value = [];
    permissions.value = new Set();
  }

  return {
    menuTree,
    permissions,
    isRoutesAdded,
    fetchMenus,
    hasPermission,
    reset,
  };
});
