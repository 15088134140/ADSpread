import { http } from '@/utils/request';
import type { Admin } from '@adspread/types';

export interface PaginatedData<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminQuery {
  username?: string;
  name?: string;
  status?: number;
  roleId?: number;
  page?: number;
  pageSize?: number;
}

export interface CreateAdminPayload {
  username: string;
  password: string;
  name: string;
  roleId: number;
  status?: number;
  phone?: string;
  email?: string;
  avatar?: string;
}

export interface UpdateAdminPayload {
  username?: string;
  name?: string;
  roleId?: number;
  status?: number;
  phone?: string;
  email?: string;
  avatar?: string;
}

export interface ResetPasswordPayload {
  newPassword: string;
}

export const adminApi = {
  getList: (params: AdminQuery): Promise<PaginatedData<Admin>> => {
    return http.get('/admin/admins', { params });
  },

  create: (data: CreateAdminPayload): Promise<Admin> => {
    return http.post('/admin/admins', data);
  },

  update: (id: number, data: UpdateAdminPayload): Promise<Admin> => {
    return http.put(`/admin/admins/${id}`, data);
  },

  remove: (id: number): Promise<{ id: number }> => {
    return http.delete(`/admin/admins/${id}`);
  },

  resetPassword: (id: number, data: ResetPasswordPayload): Promise<{ id: number }> => {
    return http.post(`/admin/admins/${id}/reset-password`, data);
  },
};
