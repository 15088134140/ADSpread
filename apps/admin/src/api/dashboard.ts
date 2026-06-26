import { http } from '@/utils/request';

/**
 * 仪表盘聚合数据，对应后端 GET /dashboard/overview 返回的 data。
 * 字段结构与后端 DashboardOverview DTO 完全一致
 *（apps/backend/src/modules/dashboard/dto/dashboard-overview.dto.ts）。
 */
export interface DashboardDeviceStats {
  /** 全部设备 */
  total: number;
  /** status=1 的设备 */
  enabled: number;
  /** 启用且在线 */
  online: number;
  /** 启用且离线 */
  offline: number;
  /** storeId IS NULL 的设备（含禁用） */
  unbound: number;
  /** online / enabled，0~1；enabled=0 时为 0 */
  onlineRate: number;
}

export interface DashboardMaterialStats {
  /** 待审核数 */
  pending: number;
  /** 已通过数 */
  approved: number;
  /** 已驳回数 */
  rejected: number;
}

export interface DashboardProgramStats {
  /** 草稿数 */
  draft: number;
  /** 已发布数 */
  published: number;
}

export interface DashboardPublishStats {
  /** 启用中数 */
  active: number;
  /** 停用数 */
  inactive: number;
  /** 近 7 天 PushMessageLog 总数 */
  recentPushTotal: number;
  /** 近 7 天推送成功数 */
  recentPushSuccess: number;
  /** 近 7 天推送失败数 */
  recentPushFail: number;
  /** 近 7 天推送成功率，0~1；recentPushTotal=0 时为 0 */
  pushSuccessRate: number;
}

export interface DashboardStoreStats {
  /** 门店总数 */
  total: number;
  /** status=1 的门店 */
  active: number;
}

export interface DashboardTodo {
  /** 待审核素材数 */
  pendingMaterial: number;
  /** 推送失败数 */
  pushFail: number;
  /** 未绑定门店的设备数 */
  unboundDevice: number;
}

export interface DashboardRecentLog {
  id: number;
  username: string;
  operation: string;
  /** 1=成功，0=失败 */
  status: number;
  /** 耗时（毫秒） */
  durationMs: number;
  createdAt: string;
}

export interface DashboardOverview {
  device: DashboardDeviceStats;
  material: DashboardMaterialStats;
  program: DashboardProgramStats;
  publish: DashboardPublishStats;
  store: DashboardStoreStats;
  todo: DashboardTodo;
  recentLogs: DashboardRecentLog[];
}

export const dashboardApi = {
  getOverview: (): Promise<DashboardOverview> => {
    return http.get('/dashboard/overview');
  },
};
