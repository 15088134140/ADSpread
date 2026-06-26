import { http } from '@/utils/request';
import type { Menu, MenuTreeNode } from '@adspread/types';
import type { PaginatedData } from './admin';

export interface MenuQuery {
  name?: string;
  status?: number;
  type?: number;
  page?: number;
  pageSize?: number;
}

export interface MenuOption {
  id: number;
  name: string;
}

export interface CreateMenuPayload {
  parentId?: number;
  name: string;
  path?: string;
  component?: string;
  icon?: string;
  sort?: number;
  type?: number;
  permission?: string;
  status?: number;
}

export interface UpdateMenuPayload {
  parentId?: number;
  name?: string;
  path?: string;
  component?: string;
  icon?: string;
  sort?: number;
  type?: number;
  permission?: string;
  status?: number;
}

export const menuApi = {
  getList: (params: MenuQuery): Promise<PaginatedData<Menu>> => {
    return http.get('/admin/menus', { params });
  },

  getTree: (): Promise<MenuTreeNode[]> => {
    return http.get('/admin/menus/tree');
  },

  getOptions: (): Promise<MenuOption[]> => {
    return http.get('/admin/menus/options');
  },

  create: (data: CreateMenuPayload): Promise<Menu> => {
    return http.post('/admin/menus', data);
  },

  update: (id: number, data: UpdateMenuPayload): Promise<Menu> => {
    return http.put(`/admin/menus/${id}`, data);
  },

  remove: (id: number): Promise<void> => {
    return http.delete(`/admin/menus/${id}`);
  },
};
