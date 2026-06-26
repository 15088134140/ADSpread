import { http } from '@/utils/request';
import type { Role } from '@adspread/types';
import type { PaginatedData } from './admin';

/** 角色列表项：后端 findAll 返回关联管理员数 adminCount。 */
export interface RoleWithAdminCount extends Role {
  adminCount: number;
}

export interface RoleQuery {
  name?: string;
  status?: number;
  page?: number;
  pageSize?: number;
}

export interface RoleOption {
  id: number;
  name: string;
}

export interface CreateRolePayload {
  name: string;
  remark?: string;
  status?: number;
  menuIds?: number[];
}

export interface UpdateRolePayload {
  name?: string;
  remark?: string;
  status?: number;
  menuIds?: number[];
}

export interface AssignRoleMenusPayload {
  menuIds: number[];
}

export const roleApi = {
  getList: (params: RoleQuery): Promise<PaginatedData<RoleWithAdminCount>> => {
    return http.get('/admin/roles', { params });
  },

  getOptions: (): Promise<RoleOption[]> => {
    return http.get('/admin/roles/options');
  },

  create: (data: CreateRolePayload): Promise<Role> => {
    return http.post('/admin/roles', data);
  },

  update: (id: number, data: UpdateRolePayload): Promise<Role> => {
    return http.put(`/admin/roles/${id}`, data);
  },

  remove: (id: number): Promise<void> => {
    return http.delete(`/admin/roles/${id}`);
  },

  assignMenus: (id: number, data: AssignRoleMenusPayload): Promise<Role> => {
    return http.put(`/admin/roles/${id}/menus`, data);
  },
};
