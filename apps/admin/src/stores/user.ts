import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Admin } from '@adspread/types';
import { usePermissionStore } from '@/stores/permission';

export const useUserStore = defineStore('user', () => {
  const token = ref<string>('');
  const userInfo = ref<Partial<Admin>>({});

  const isLoggedIn = computed(() => !!token.value);

  function setToken(newToken: string) {
    token.value = newToken;
    localStorage.setItem('token', newToken);
  }

  function setUserInfo(info: Partial<Admin>) {
    userInfo.value = info;
    localStorage.setItem('userInfo', JSON.stringify(info));
  }

  /**
   * 登录成功后调用：保存凭据并加载当前用户菜单/权限。
   */
  async function login(newToken: string, info: Partial<Admin>) {
    setToken(newToken);
    setUserInfo(info);
    const permissionStore = usePermissionStore();
    await permissionStore.fetchMenus();
  }

  function initFromStorage() {
    const storedToken = localStorage.getItem('token');
    const storedUserInfo = localStorage.getItem('userInfo');

    if (storedToken) {
      token.value = storedToken;
    }
    if (storedUserInfo) {
      try {
        userInfo.value = JSON.parse(storedUserInfo);
      } catch {
        // ignore
      }
    }
  }

  function logout() {
    token.value = '';
    userInfo.value = {};
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    const permissionStore = usePermissionStore();
    permissionStore.reset();
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    setToken,
    setUserInfo,
    login,
    initFromStorage,
    logout,
  };
});
