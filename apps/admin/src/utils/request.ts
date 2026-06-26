import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { ElMessage } from 'element-plus';
import router from '@/router';
import { useUserStore } from '@/stores/user';

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

    ElMessage.error(message || 'Request failed');
    return Promise.reject(new Error(message || 'Request failed'));
  },
  (error) => {
    const userStore = useUserStore();

    if (error.response) {
      const { status } = error.response;

      switch (status) {
        case 401:
          ElMessage.error('登录已过期，请重新登录');
          userStore.logout();
          router.push('/login');
          break;
        case 403:
          ElMessage.error('没有权限访问该资源');
          break;
        case 404:
          ElMessage.error('请求的资源不存在');
          break;
        case 500:
          ElMessage.error('服务器内部错误');
          break;
        default:
          ElMessage.error(error.response.data?.message || '请求失败');
      }
    } else if (error.request) {
      ElMessage.error('网络错误，请检查网络连接');
    } else {
      ElMessage.error(error.message || '请求失败');
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
