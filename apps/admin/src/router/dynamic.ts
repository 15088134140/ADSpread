import type { RouteComponent, RouteRecordRaw } from 'vue-router';
import { MenuType, type MenuTreeNode } from '@adspread/types';

/**
 * 菜单 path（带前导斜杠，与后端 seed 一致）到懒加载组件的映射。
 * 仅这些 path 命中的 MENU 节点会动态注册为路由，确保未授权菜单对应路由不存在。
 */
const componentMap: Record<string, () => Promise<RouteComponent>> = {
  '/dashboard': () => import('@/views/Dashboard.vue'),
  '/store': () => import('@/views/store/StoreList.vue'),
  '/device': () => import('@/views/device/DeviceList.vue'),
  '/material': () => import('@/views/material/MaterialList.vue'),
  '/program': () => import('@/views/program/ProgramList.vue'),
  '/publish': () => import('@/views/publish/PublishList.vue'),
  '/system/admin': () => import('@/views/system/AdminList.vue'),
  '/system/role': () => import('@/views/system/RoleList.vue'),
  '/system/menu': () => import('@/views/system/MenuList.vue'),
  '/system/log': () => import('@/views/system/OperationLogList.vue'),
};

/**
 * 递归遍历菜单树，对 type=MENU 且 path 命中 componentMap 的节点
 * 生成作为 Layout 子路由的 RouteRecordRaw。
 * - path 去掉前导斜杠转为相对路径（Layout 父路由 path 为 '/'）。
 * - name 用 'menu_' + node.id 保证唯一，便于登出时按名移除。
 * - 目录(type=1)/按钮(type=3)节点跳过。
 * - title 取 node.name 作备用（侧边栏文案由 i18n 自行渲染）。
 */
export function buildDynamicRoutes(menuTree: MenuTreeNode[]): RouteRecordRaw[] {
  const routes: RouteRecordRaw[] = [];
  // MenuTreeNode.type 为 number，用 number 类型承接枚举值，避免 number 与枚举的不安全比较。
  const menuTypeMenu: number = MenuType.MENU;

  const walk = (nodes: MenuTreeNode[]): void => {
    for (const node of nodes) {
      if (node.type === menuTypeMenu && node.path && componentMap[node.path]) {
        routes.push({
          path: node.path.replace(/^\//, ''),
          name: `menu_${node.id}`,
          component: componentMap[node.path],
          meta: {
            title: node.name,
            icon: node.icon,
            permission: node.permission,
          },
        });
      }
      if (node.children && node.children.length > 0) {
        walk(node.children);
      }
    }
  };

  walk(menuTree);
  return routes;
}
