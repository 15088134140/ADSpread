import { http } from '@/utils/request';
import type { Admin, MenuTreeNode } from '@adspread/types';

export interface LoginParams {
  username: string;
  password: string;
}

export interface UserInfo {
  id: number;
  username: string;
  name: string;
  roleId: number;
  avatar?: string;
  email?: string;
  phone?: string;
  status: number;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResult {
  token: string;
  userInfo: UserInfo;
}

export interface ChangePasswordPayload {
  oldPassword: string;
  newPassword: string;
}

export const authApi = {
  login: (data: LoginParams): Promise<LoginResult> => {
    return http.post('/auth/login', data);
  },

  logout: (): Promise<void> => {
    return http.post('/auth/logout');
  },

  getMe: (): Promise<Admin> => {
    return http.get('/auth/me');
  },

  getMenus: (): Promise<MenuTreeNode[]> => {
    return http.get('/auth/menus');
  },

  changePassword: (data: ChangePasswordPayload): Promise<void> => {
    return http.post('/auth/change-password', data);
  },
};
