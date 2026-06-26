import { http } from '@/utils/request';

export interface TargetStore {
  id: number;
  name: string;
  deviceCount: number;
}

export interface PublishPlan {
  id: number;
  name: string;
  programId: number;
  programName?: string;
  targetStoreIds: number[];
  targetStores?: TargetStore[];
  startTime: string;
  endTime?: string;
  playDays: number[];
  status: number;
  lastPushedAt?: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublishQuery {
  keyword?: string;
  programId?: number;
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

export interface CreatePublishParams {
  name: string;
  programId: number;
  targetStoreIds: number[];
  startTime: string;
  endTime?: string;
  playDays: number[];
  status?: number;
}

export interface UpdatePublishParams extends Partial<CreatePublishParams> {}

export interface UpdateStatusParams {
  status: number;
}

export interface PushResult {
  id: number;
  pushLogId: number;
  targetDeviceCount: number;
  lastPushedAt?: string;
}

export const publishApi = {
  getList: (params: PublishQuery): Promise<PaginatedData<PublishPlan>> => {
    return http.get('/publish', { params });
  },

  getById: (id: number): Promise<PublishPlan> => {
    return http.get(`/publish/${id}`);
  },

  create: (data: CreatePublishParams): Promise<PublishPlan> => {
    return http.post('/publish', data);
  },

  update: (id: number, data: UpdatePublishParams): Promise<PublishPlan> => {
    return http.put(`/publish/${id}`, data);
  },

  delete: (id: number): Promise<void> => {
    return http.delete(`/publish/${id}`);
  },

  updateStatus: (id: number, data: UpdateStatusParams): Promise<PublishPlan> => {
    return http.put(`/publish/${id}/status`, data);
  },

  push: (id: number): Promise<PushResult> => {
    return http.post(`/publish/${id}/push`);
  },

  batchPush: (ids: number[]): Promise<PushResult[]> => {
    return http.post('/publish/batch-push', { ids });
  },
};
