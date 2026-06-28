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
    name: 'Layout',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    // 子路由由 permissionStore.fetchMenus 动态注册（router.addRoute('Layout', ...)）
    children: [],
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

  // 已登录访问首页 / → 跳 /dashboard（redirect 移出 route config 以避免未登录时也被 redirect）
  if (to.path === '/' && token) {
    next('/dashboard');
    return;
  }

  // 已登录但动态路由尚未注册：拉取菜单并注册，然后重新解析当前导航
  // 使新注册的动态路由生效（避免刷新后落到 NotFound）。
  // 必须用 path 而非展开 ...to：刷新时动态路由未注册，to 已被 :pathMatch(.*)*
  // 解析为 NotFound（to.name === 'NotFound'），展开会带 name 优先按名解析，
  // 重新导航仍落 NotFound。用 path 强制按路径重新匹配已注册的动态路由。
  const permissionStore = usePermissionStore();
  if (token && !permissionStore.isRoutesAdded) {
    try {
      await permissionStore.fetchMenus();
      next({ path: to.path, query: to.query, hash: to.hash, replace: true });
      return;
    } catch {
      // 菜单加载失败：放行避免卡死，由 NotFound/权限校验兜底；
      // isRoutesAdded 保持 false，下次导航会重试。
    }
  }

  // 已登录访问受保护路由：校验按钮级权限（防御性）
  if (to.meta.requiresAuth && token) {
    const required = to.meta.permission as string | undefined;
    if (required && !permissionStore.hasPermission(required)) {
      next('/dashboard');
      return;
    }
  }

  next();
});

export default router;
