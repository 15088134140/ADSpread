import { http } from '@/utils/request';

export interface Material {
  id: number;
  name: string;
  type: string;
  fileUrl: string;
  fileSize: number;
  fileExtension: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailUrl?: string;
  auditStatus: string;
  auditUserId?: number;
  auditTime?: string;
  auditReason?: string;
  createdBy: number;
  creatorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialQuery {
  keyword?: string;
  type?: string;
  auditStatus?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedData<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApproveParams {
  note?: string;
}

export interface RejectParams {
  reason: string;
}

export const materialApi = {
  getList: (params: MaterialQuery): Promise<PaginatedData<Material>> => {
    return http.get('/materials', { params });
  },

  getAvailable: (): Promise<Material[]> => {
    return http.get('/materials/available');
  },

  getById: (id: number): Promise<Material> => {
    return http.get(`/materials/${id}`);
  },

  create: (data: FormData): Promise<Material> => {
    return http.post('/materials/upload', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  update: (
    id: number,
    data: Partial<Omit<Material, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Material> => {
    return http.put(`/materials/${id}`, data);
  },

  delete: (id: number): Promise<void> => {
    return http.delete(`/materials/${id}`);
  },

  approve: (id: number, data?: ApproveParams): Promise<Material> => {
    return http.put(`/materials/${id}/approve`, data);
  },

  reject: (id: number, data: RejectParams): Promise<Material> => {
    return http.put(`/materials/${id}/reject`, data);
  },
};
