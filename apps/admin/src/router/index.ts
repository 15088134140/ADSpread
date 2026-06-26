import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { usePermissionStore } from '@/stores/permission';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/Login.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: 'menu.dashboard', icon: 'Odometer' },
      },
      {
        path: 'store',
        name: 'Store',
        component: () => import('@/views/store/StoreList.vue'),
        meta: { title: 'menu.store', icon: 'Shop' },
      },
      {
        path: 'device',
        name: 'Device',
        component: () => import('@/views/device/DeviceList.vue'),
        meta: { title: 'menu.device', icon: 'Monitor' },
      },
      {
        path: 'material',
        name: 'Material',
        component: () => import('@/views/material/MaterialList.vue'),
        meta: { title: 'menu.material', icon: 'Picture' },
      },
      {
        path: 'program',
        name: 'Program',
        component: () => import('@/views/program/ProgramList.vue'),
        meta: { title: 'menu.program', icon: 'Film' },
      },
      {
        path: 'publish',
        name: 'Publish',
        component: () => import('@/views/publish/PublishList.vue'),
        meta: { title: 'menu.publish', icon: 'Promotion' },
      },
      {
        path: 'system/admin',
        name: 'SystemAdmin',
        component: () => import('@/views/system/AdminList.vue'),
        meta: { title: 'menu.system.admin', icon: 'User', permission: 'admin:list' },
      },
      {
        path: 'system/role',
        name: 'SystemRole',
        component: () => import('@/views/system/RoleList.vue'),
        meta: { title: 'menu.system.role', icon: 'Setting', permission: 'role:list' },
      },
      {
        path: 'system/menu',
        name: 'SystemMenu',
        component: () => import('@/views/system/MenuList.vue'),
        meta: { title: 'menu.system.menu', icon: 'Menu', permission: 'menu:list' },
      },
      {
        path: 'system/log',
        name: 'SystemLog',
        component: () => import('@/views/system/OperationLogList.vue'),
        meta: { title: 'menu.system.log', icon: 'Document', permission: 'log:list' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigation guard
router.beforeEach(async (to, _from, next) => {
  const token = localStorage.getItem('token');

  // 需要认证但未登录
  if (to.meta.requiresAuth && !token) {
    next('/login');
    return;
  }

  // 已登录访问登录页 → 跳首页
  if (to.path === '/login' && token) {
    next('/');
    return;
  }

  // 已登录访问受保护路由：确保菜单已加载并校验权限
  if (to.meta.requiresAuth && token) {
    const permissionStore = usePermissionStore();
    if (permissionStore.menuTree.length === 0) {
      try {
        await permissionStore.fetchMenus();
      } catch {
        // 菜单加载失败时继续放行，由权限校验限制访问
      }
    }
    const required = to.meta.permission as string | undefined;
    if (required && !permissionStore.hasPermission(required)) {
      next('/dashboard');
      return;
    }
  }

  next();
});

export default router;
