import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

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
        path: 'system',
        redirect: '/system/admin',
        meta: { title: 'menu.system', icon: 'Setting' },
        children: [
          {
            path: 'admin',
            name: 'SystemAdmin',
            component: () => import('@/views/system/AdminList.vue'),
            meta: { title: 'menu.admin' },
          },
          {
            path: 'role',
            name: 'SystemRole',
            component: () => import('@/views/system/RoleList.vue'),
            meta: { title: 'menu.role' },
          },
          {
            path: 'menu',
            name: 'SystemMenu',
            component: () => import('@/views/system/MenuList.vue'),
            meta: { title: 'menu.menu' },
          },
          {
            path: 'log',
            name: 'SystemLog',
            component: () => import('@/views/system/LogList.vue'),
            meta: { title: 'menu.log' },
          },
        ],
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
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');

  if (to.meta.requiresAuth && !token) {
    next('/login');
  } else if (to.path === '/login' && token) {
    next('/');
  } else {
    next();
  }
});

export default router;
