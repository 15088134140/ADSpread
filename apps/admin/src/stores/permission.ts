import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { MenuTreeNode } from '@adspread/types';
import { authApi } from '@/api/auth';

/**
 * 权限 store：负责动态菜单树与按钮级权限集合。
 * 菜单数据由后端 GET /auth/menus 返回，登录后加载。
 */
export const usePermissionStore = defineStore('permission', () => {
  const menuTree = ref<MenuTreeNode[]>([]);
  const permissions = ref<Set<string>>(new Set());

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
   * 拉取当前用户可见菜单，构建菜单树与权限集合。
   */
  async function fetchMenus(): Promise<void> {
    const menus = await authApi.getMenus();
    menuTree.value = menus ?? [];
    const set = new Set<string>();
    collectPermissions(menuTree.value, set);
    permissions.value = set;
  }

  /**
   * 判断当前用户是否拥有指定权限码。
   */
  function hasPermission(code: string): boolean {
    return permissions.value.has(code);
  }

  /**
   * 重置菜单与权限（登出时调用）。
   */
  function reset(): void {
    menuTree.value = [];
    permissions.value = new Set();
  }

  return {
    menuTree,
    permissions,
    fetchMenus,
    hasPermission,
    reset,
  };
});
