// ==================== 枚举类型 ====================

export enum IndustryCategory {
  CATERING = 'CATERING',
  RETAIL = 'RETAIL',
  BEAUTY = 'BEAUTY',
  HOTEL = 'HOTEL',
  EDUCATION = 'EDUCATION',
  AUTOMOTIVE = 'AUTOMOTIVE',
  LIFE_SERVICE = 'LIFE_SERVICE',
  OTHER = 'OTHER',
}

export enum ScreenOrientation {
  LANDSCAPE = 'LANDSCAPE',
  PORTRAIT = 'PORTRAIT',
  ANY = 'ANY',
}

export enum SplitType {
  SPLIT_1 = 'SPLIT_1',
  SPLIT_2 = 'SPLIT_2',
  SPLIT_3 = 'SPLIT_3',
  SPLIT_3_1 = 'SPLIT_3_1',
  SPLIT_4 = 'SPLIT_4',
  ANY = 'ANY',
}

export enum Status {
  DISABLED = 0,
  ENABLED = 1,
}

export enum ProgramStatus {
  DRAFT = 0,
  PUBLISHED = 1,
}

export enum PublishPlanStatus {
  DISABLED = 0,
  ENABLED = 1,
}

export enum MaterialType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
}

export enum AuditStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// ==================== 基础实体类型 ====================

export interface BaseEntity {
  id: number;
  createdAt: string;
  updatedAt: string;
}

// ==================== 系统管理模块 ====================

export interface Admin extends BaseEntity {
  username: string;
  name: string;
  roleId?: number;
  status: number;
  avatar?: string;
  phone?: string;
  email?: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
  role?: Role;
}

export interface Role extends BaseEntity {
  name: string;
  remark?: string;
  status: number;
  menuIds?: number[];
}

export interface Menu extends BaseEntity {
  parentId?: number;
  name: string;
  path?: string;
  component?: string;
  icon?: string;
  sort: number;
  type: number;
  permission?: string;
  status: number;
  children?: Menu[];
}

export interface OperationLog extends BaseEntity {
  adminId?: number;
  username: string;
  operation: string;
  method?: string;
  params?: Record<string, any>;
  time: number;
  ip?: string;
  userAgent?: string;
  status: number;
  errorMsg?: string;
}

// ==================== 门店管理模块 ====================

export interface Store extends BaseEntity {
  name: string;
  code: string;
  industryCategory: IndustryCategory;
  address?: string;
  contactPerson?: string;
  contactPhone?: string;
  status: number;
  remark?: string;
  devices?: Device[];
}

// ==================== 设备管理模块 ====================

export interface Device extends BaseEntity {
  storeId: number;
  name: string;
  code: string;
  screenOrientation: ScreenOrientation;
  screenResolution?: string;
  splitType: SplitType;
  remark?: string;
  status: number;
  lastActiveAt?: string;
  ipAddress?: string;
  macAddress?: string;
  appVersion?: string;
  store?: Store;
}

// ==================== 素材管理模块 ====================

export interface Material extends BaseEntity {
  name: string;
  type: MaterialType;
  fileUrl: string;
  fileSize: number;
  fileExtension: string;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailUrl?: string;
  auditStatus: AuditStatus;
  auditUserId?: number;
  auditTime?: string;
  auditReason?: string;
  createdBy: number;
}

// ==================== 节目制作模块 ====================

export interface Program extends BaseEntity {
  name: string;
  screenOrientation: ScreenOrientation;
  splitType: SplitType;
  layoutConfig: Record<string, any>;
  status: number;
  publishedAt?: string;
  createdBy: number;
}

// ==================== 发布管理模块 ====================

export interface PublishPlan extends BaseEntity {
  programId: number;
  name: string;
  targetStoreIds: number[];
  startTime: string;
  endTime?: string;
  playDays?: number[];
  status: number;
  lastPushedAt?: string;
  createdBy: number;
  program?: Program;
}

// ==================== API 响应类型 ====================

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

// ==================== 认证相关 ====================

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  userInfo: Admin;
}

// ==================== 枚举标签映射 ====================

export const IndustryCategoryLabels: Record<IndustryCategory, string> = {
  [IndustryCategory.CATERING]: '餐饮',
  [IndustryCategory.RETAIL]: '零售',
  [IndustryCategory.BEAUTY]: '美妆',
  [IndustryCategory.HOTEL]: '酒旅',
  [IndustryCategory.EDUCATION]: '教育',
  [IndustryCategory.AUTOMOTIVE]: '汽车',
  [IndustryCategory.LIFE_SERVICE]: '本地生活',
  [IndustryCategory.OTHER]: '其他',
};

export const ScreenOrientationLabels: Record<ScreenOrientation, string> = {
  [ScreenOrientation.LANDSCAPE]: '横屏',
  [ScreenOrientation.PORTRAIT]: '竖屏',
  [ScreenOrientation.ANY]: '任意',
};

export const AuditStatusLabels: Record<AuditStatus, string> = {
  [AuditStatus.PENDING]: '待审核',
  [AuditStatus.APPROVED]: '审核通过',
  [AuditStatus.REJECTED]: '审核驳回',
};
