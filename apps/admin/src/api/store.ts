import { http } from '@/utils/request';

export interface Store {
  id: number;
  name: string;
  code: string;
  industryCategory: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  status: number;
  remark?: string;
  deviceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoreQuery {
  keyword?: string;
  industryCategory?: string;
  status?: number;
  page?: number;
  pageSize?: number;
}

export interface PaginatedData<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const storeApi = {
  getList: (params: StoreQuery): Promise<PaginatedData<Store>> => {
    return http.get('/stores', { params });
  },

  getOptions: (): Promise<{ id: number; name: string; code: string }[]> => {
    return http.get('/stores/options');
  },

  getById: (id: number): Promise<Store> => {
    return http.get(`/stores/${id}`);
  },

  create: (data: Omit<Store, 'id' | 'createdAt' | 'updatedAt'>): Promise<Store> => {
    return http.post('/stores', data);
  },

  update: (
    id: number,
    data: Partial<Omit<Store, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Store> => {
    return http.put(`/stores/${id}`, data);
  },

  delete: (id: number): Promise<void> => {
    return http.delete(`/stores/${id}`);
  },

  getIndustryCategories: (): Promise<{ value: string; label: string }[]> => {
    return http.get('/stores/industry-categories');
  },
};
