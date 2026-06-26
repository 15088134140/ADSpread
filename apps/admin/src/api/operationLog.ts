import { http } from '@/utils/request';
import type { OperationLog } from '@adspread/types';
import type { PaginatedData } from './admin';

export interface OperationLogQuery {
  username?: string;
  operation?: string;
  startTime?: string;
  endTime?: string;
  status?: number;
  page?: number;
  pageSize?: number;
}

export const operationLogApi = {
  getList: (params: OperationLogQuery): Promise<PaginatedData<OperationLog>> => {
    return http.get('/admin/logs', { params });
  },
};
