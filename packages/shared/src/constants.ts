// ==================== 分页常量 ====================

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ==================== 状态常量 ====================

export const STATUS_ENABLED = 1;
export const STATUS_DISABLED = 0;

// ==================== 设备状态 ====================

export const DEVICE_STATUS_ONLINE = 1;
export const DEVICE_STATUS_OFFLINE = 0;
export const DEVICE_STATUS_DISABLED = -1;

// ==================== 节目状态 ====================

export const PROGRAM_STATUS_DRAFT = 1;
export const PROGRAM_STATUS_PUBLISHED = 2;

// ==================== 发布计划状态 ====================

export const PUBLISH_STATUS_PENDING = 1;
export const PUBLISH_STATUS_PUSHED = 2;
export const PUBLISH_STATUS_EXPIRED = 3;

// ==================== 菜单类型 ====================

export const MENU_TYPE_DIRECTORY = 1;
export const MENU_TYPE_MENU = 2;
export const MENU_TYPE_BUTTON = 3;

// ==================== 操作日志状态 ====================

export const LOG_STATUS_SUCCESS = 1;
export const LOG_STATUS_FAILED = 0;

// ==================== 文件上传 ====================

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const ALLOWED_IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
export const ALLOWED_VIDEO_TYPES = ['mp4', 'webm', 'avi'];
export const ALLOWED_FILE_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

// ==================== 时间常量 ====================

export const ONE_SECOND = 1000;
export const ONE_MINUTE = 60 * ONE_SECOND;
export const ONE_HOUR = 60 * ONE_MINUTE;
export const ONE_DAY = 24 * ONE_HOUR;

// ==================== 正则表达式 ====================

export const REGEX_PHONE = /^1[3-9]\d{9}$/;
export const REGEX_EMAIL = /^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/;
export const REGEX_USERNAME = /^[a-zA-Z0-9_]{4,20}$/;
export const REGEX_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*#?&]{8,}$/;
