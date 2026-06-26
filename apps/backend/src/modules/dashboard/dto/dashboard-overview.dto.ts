/**
 * 仪表盘概览响应 DTO（字段与设计规格 §5.3 完全一致）。
 *
 * 注意：`recentLogs[].durationMs` 对应 `OperationLog.time`（耗时 ms），
 * 仅在本响应内重命名以提升语义，不改动表字段。
 */

export interface DashboardDeviceOverview {
  /** 全部设备 */
  total: number;
  /** status=1 的设备 */
  enabled: number;
  /** 启用且在线（status=1 且 lastActiveAt 在阈值内） */
  online: number;
  /** 启用且离线（enabled - online） */
  offline: number;
  /** storeId IS NULL 的设备（含禁用） */
  unbound: number;
  /** online / enabled，保留 3 位小数；enabled=0 时为 0 */
  onlineRate: number;
}

export interface DashboardMaterialOverview {
  pending: number;
  approved: number;
  rejected: number;
}

export interface DashboardProgramOverview {
  /** status=0 草稿 */
  draft: number;
  /** status=1 已发布 */
  published: number;
}

export interface DashboardPublishOverview {
  /** status=1 启用 */
  active: number;
  /** status=0 停用 */
  inactive: number;
  /** 近 7 天 PushMessageLog 总数 */
  recentPushTotal: number;
  /** 近 7 天推送成功数 */
  recentPushSuccess: number;
  /** 近 7 天推送失败数 */
  recentPushFail: number;
  /** 近 7 天推送成功率，保留 3 位小数；recentPushTotal=0 时为 0 */
  pushSuccessRate: number;
}

export interface DashboardStoreOverview {
  total: number;
  /** status=1 */
  active: number;
}

export interface DashboardTodoOverview {
  /** 等于 material.pending */
  pendingMaterial: number;
  /** 等于 publish.recentPushFail */
  pushFail: number;
  /** 等于 device.unbound */
  unboundDevice: number;
}

export interface DashboardRecentLog {
  id: number;
  username: string;
  operation: string;
  status: number;
  /** 耗时(ms)，对应 OperationLog.time */
  durationMs: number;
  /** ISO 字符串 */
  createdAt: string;
}

export interface DashboardOverview {
  device: DashboardDeviceOverview;
  material: DashboardMaterialOverview;
  program: DashboardProgramOverview;
  publish: DashboardPublishOverview;
  store: DashboardStoreOverview;
  todo: DashboardTodoOverview;
  /** 最近 10 条操作日志；当前用户无 log:list 权限时为 [] */
  recentLogs: DashboardRecentLog[];
}
