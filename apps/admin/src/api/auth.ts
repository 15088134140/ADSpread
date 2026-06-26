import { http } from '@/utils/request';

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

export const authApi = {
  login: (data: LoginParams): Promise<LoginResult> => {
    return http.post('/auth/login', data);
  },

  logout: (): Promise<void> => {
    return http.post('/auth/logout');
  },
};
