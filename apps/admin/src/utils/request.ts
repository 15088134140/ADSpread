import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { ElMessage } from 'element-plus';
import router from '@/router';
import { useUserStore } from '@/stores/user';
import i18n from '@/locales';

const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
service.interceptors.request.use(
  (config) => {
    const userStore = useUserStore();
    if (userStore.token) {
      config.headers.Authorization = `Bearer ${userStore.token}`;
    }
    // Accept-Language 取当前语言（直接读 localStorage 避免与 app store 形成循环依赖）
    const locale = localStorage.getItem('locale') || 'ja';
    config.headers['Accept-Language'] = locale;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
service.interceptors.response.use(
  (response: AxiosResponse) => {
    const { code, message, data } = response.data;

    if (code === 0) {
      return data;
    }

    // 后端业务错误消息保持后端原文显示（本轮后端错误消息未国际化）
    ElMessage.error(message || i18n.global.t('common.requestFailed'));
    return Promise.reject(new Error(message || 'Request failed'));
  },
  (error) => {
    const userStore = useUserStore();
    const t = i18n.global.t;

    if (error.response) {
      const { status } = error.response;

      switch (status) {
        case 401:
          ElMessage.error(t('common.sessionExpired'));
          userStore.logout();
          router.push('/login');
          break;
        case 403:
          ElMessage.error(t('common.forbidden'));
          break;
        case 404:
          ElMessage.error(t('common.notFoundResource'));
          break;
        case 500:
          ElMessage.error(t('common.serverError'));
          break;
        default:
          // 后端业务错误消息保持原文
          ElMessage.error(error.response.data?.message || t('common.requestFailed'));
      }
    } else if (error.request) {
      if (error.code === 'ECONNABORTED') {
        // 请求超时
        ElMessage.error(t('common.networkError'));
      } else {
        ElMessage.error(t('common.networkError'));
      }
    } else {
      ElMessage.error(error.message || t('common.requestFailed'));
    }

    return Promise.reject(error);
  }
);

// Request methods
export const http = {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return service.get(url, config);
  },

  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return service.post(url, data, config);
  },

  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return service.put(url, data, config);
  },

  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return service.delete(url, config);
  },
};

export default service;
