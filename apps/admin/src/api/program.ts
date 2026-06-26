import { http } from '@/utils/request';

export interface MaterialItem {
  materialId: number;
  duration: number;
}

export interface Region {
  regionId: string;
  materials: MaterialItem[];
}

export interface Program {
  id: number;
  name: string;
  screenOrientation: string;
  splitType: string;
  status: number;
  publishedAt?: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  layoutConfig: {
    regions: Region[];
  };
}

export interface ProgramQuery {
  keyword?: string;
  screenOrientation?: string;
  splitType?: string;
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

export interface CreateProgramParams {
  name: string;
  screenOrientation: string;
  splitType: string;
  regions: Region[];
  status?: number;
}

export interface UpdateProgramParams extends Partial<CreateProgramParams> {}

export interface PublishProgramParams {
  regions: Region[];
}

export const programApi = {
  getList: (params: ProgramQuery): Promise<PaginatedData<Program>> => {
    return http.get('/programs', { params });
  },

  getById: (id: number): Promise<Program> => {
    return http.get(`/programs/${id}`);
  },

  create: (data: CreateProgramParams): Promise<Program> => {
    return http.post('/programs', data);
  },

  update: (id: number, data: UpdateProgramParams): Promise<Program> => {
    return http.put(`/programs/${id}`, data);
  },

  delete: (id: number): Promise<void> => {
    return http.delete(`/programs/${id}`);
  },

  publish: (id: number, data: PublishProgramParams): Promise<Program> => {
    return http.put(`/programs/${id}/publish`, data);
  },
};
