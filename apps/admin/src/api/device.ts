import { http } from '@/utils/request';

export interface Device {
  id: number;
  name: string;
  code: string;
  storeId: number;
  storeName?: string;
  screenOrientation: string;
  screenResolution: string;
  splitType: string;
  remark?: string;
  status: number;
  lastActiveAt?: string;
  ipAddress?: string;
  macAddress?: string;
  appVersion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceQuery {
  keyword?: string;
  storeId?: number;
  status?: number;
  screenOrientation?: string;
  splitType?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedData<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const deviceApi = {
  getList: (params: DeviceQuery): Promise<PaginatedData<Device>> => {
    return http.get('/devices', { params });
  },

  getOptions: (): Promise<{ id: number; name: string; code: string }[]> => {
    return http.get('/devices/options');
  },

  getById: (id: number): Promise<Device> => {
    return http.get(`/devices/${id}`);
  },

  create: (data: Omit<Device, 'id' | 'createdAt' | 'updatedAt'>): Promise<Device> => {
    return http.post('/devices', data);
  },

  update: (
    id: number,
    data: Partial<Omit<Device, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Device> => {
    return http.put(`/devices/${id}`, data);
  },

  delete: (id: number): Promise<void> => {
    return http.delete(`/devices/${id}`);
  },

  getResolutions: (): Promise<string[]> => {
    return http.get('/devices/resolutions');
  },

  getSplitTypes: (): Promise<string[]> => {
    return http.get('/devices/split-types');
  },
};
