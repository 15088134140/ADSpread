/**
 * ADSpread 设备端 API 契约类型（前后端单一来源）。
 *
 * 本文件固化设备端（安卓展示端 ↔ 后端）的请求/响应 DTO 与 Socket.io 事件载荷。
 * 字段以后端 `apps/backend/src/modules/device-api/` 实际实现为准（Task 1–5 已冻结）。
 *
 * - 日期字段在 JSON 线上为 ISO 8601 字符串，故统一声明为 `string`。
 * - BigInt 字段（Material.fileSize、DeviceLog.id）经全局 `BigInt.prototype.toJSON` patch
 *   以**字符串**下发，故声明为 `string`（见 plan §K3）。
 * - 枚举值（screenOrientation/splitType/type 等）后端为 Prisma 枚举字符串，线上一律为 string。
 *
 * 消费方：
 * - 安卓端：按本文件移植为 Kotlin data class（字段名/类型一一对应）。
 * - 后端：DTO 已在 `apps/backend/src/modules/device-api/dto/` 实现，本文件为对照基准。
 * - 管理后台：远程指令下发消费 `CommandDispatchService`，事件载荷见本文件 Socket 部分。
 *
 * 本目录无 package.json/tsconfig，不参与构建；作为可 diff 的字段权威来源存在。
 * 若后续接入构建（如生成 OpenAPI 或 TS client），可在 packages/api-contracts 增加 tsconfig。
 */

// =============================================================================
// 通用：统一响应信封
// =============================================================================

/** 后端统一响应信封（TransformInterceptor 注入）。设备接口的 200 响应均包在此结构内。 */
export interface UnifiedResponse<T> {
  /** 0 表示成功，非 0 为业务错误码（400xx/401xx/403xx/404xx/500xx） */
  code: number;
  message: string;
  data: T;
  /** 毫秒级数字时间戳 */
  timestamp: number;
}

// =============================================================================
// 设备鉴权（plan §K1/K2）
// =============================================================================

/**
 * 设备令牌：无状态 JWT，复用与 admin 相同的 JWT_SECRET，claims 含 type/sub/code，有效期 90d。
 * 设备上行接口（除 /device/program、/device/bind 外）需在 `Authorization: Bearer <token>` 携带。
 * Socket.io 握手通过 `socket.handshake.auth.token` 或 Authorization 头携带。
 */
export interface DeviceTokenPayload {
  /** 固定 'device'，DeviceGuard/网关据此与 admin token 隔离 */
  type: 'device';
  /** 设备 ID */
  sub: number;
  /** 设备编码 */
  code: string;
  iat?: number;
  exp?: number;
}

/** DeviceGuard 鉴权后挂载的设备身份（storeId 可能为 null = 未绑定门店）。 */
export interface DeviceIdentity {
  id: number;
  code: string;
  storeId: number | null;
}

// =============================================================================
// POST /device/bind（@Public，无需 token）
// =============================================================================

/** 设备硬件信息。各字段 optional：首次绑定可能采集不全。
 *  mac/resolution/appVersion 对应 Device 表字段（macAddress/screenResolution/appVersion）会落库；
 *  androidId/model/androidVersion Device 表无对应列，仅做 DTO 校验不落库。
 *  ipAddress 由后端从请求 @Ip() 取，**不在 hardwareInfo 内**。 */
export interface HardwareInfoDto {
  mac?: string;
  androidId?: string;
  model?: string;
  /** 屏幕分辨率，如 '1920x1080' */
  resolution?: string;
  androidVersion?: string;
  appVersion?: string;
}

/** 设备自身配置，供客户端初始化。运行时为 Prisma 枚举字符串值。 */
export interface DeviceConfigDto {
  /** LANDSCAPE / PORTRAIT / ANY */
  screenOrientation: string;
  /** SPLIT_1 / SPLIT_2 / SPLIT_3 / SPLIT_3_1 / SPLIT_4 / ANY */
  splitType: string;
  /** 屏幕分辨率，如 '1920x1080' */
  screenResolution: string;
}

/** POST /device/bind 请求。code 为后台预建设备编码；hardwareInfo 必传（可空对象）。 */
export interface BindReq {
  code: string;
  hardwareInfo: HardwareInfoDto;
}

/** POST /device/bind 响应。允许重复绑定（重新签发 token + 刷新 hardwareInfo）。 */
export interface BindRes {
  /** 设备令牌（JWT，90d 有效期） */
  deviceToken: string;
  /** 所属门店 ID，未绑定门店为 null */
  storeId: number | null;
  deviceConfig: DeviceConfigDto;
}

// =============================================================================
// GET /device/program（@Public，无需 token）—— 既有接口，展开形式
// =============================================================================

/**
 * /device/program 返回的 layoutConfig 为**展开形式**：
 * 每个 material item 内嵌完整 Material 对象（`material` 字段），且 region 层注入 `bounds`。
 * 返回单个 Program 或 null（设备禁用/未绑定门店/无匹配计划时为 null）。
 *
 * 注意：此接口返回的是原始 Program 对象 spread，可能含管理域字段（createdBy/publishedAt/
 * createdAt/updatedAt 等），设备端**不应依赖**这些字段——播放所需字段见下。如需干净形式用 /device/sync。
 */
export interface RegionBounds {
  regionId: string;
  /** 比例值 0~1，客户端用 bounds.x * 屏幕宽 得像素偏移 */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** /device/program 展开形式中的完整素材对象（Material 实体投影）。 */
export interface ExpandedMaterial {
  id: number;
  name: string;
  /** IMAGE / VIDEO */
  type: string;
  fileUrl: string;
  /** BigInt → 字符串下发 */
  fileSize: string;
  fileExtension: string;
  width: number | null;
  height: number | null;
  /** 视频时长（秒），图片为 null */
  duration: number | null;
  thumbnailUrl: string | null;
  /** 审核状态（APPROVED 等），设备端一般不消费 */
  auditStatus: string;
}

/** /device/program 展开形式中的单个素材项。 */
export interface ExpandedMaterialItem {
  materialId: number;
  /** 展示时长，单位：秒。图片/跑马灯按此值展示，视频按 material.duration 播放 */
  duration: number;
  /** 后端展开的完整 Material 对象 */
  material: ExpandedMaterial;
}

/** /device/program 展开形式中的区域。bounds 注入在 region 层（applyForcedSplit），
 *  Task 0 已修复为按 region 索引取单个 RegionBounds；客户端**忽略**此字段本地计算（ADR-D）。 */
export interface ExpandedRegion {
  regionId: string;
  materials: ExpandedMaterialItem[];
  /** 后端注入的区域边界（比例值）。客户端忽略，本地按 (screenOrientation, splitType) + region 索引计算 */
  bounds?: RegionBounds;
}

/** /device/program 展开形式 layoutConfig。 */
export interface ExpandedLayoutConfig {
  regions: ExpandedRegion[];
}

// =============================================================================
// GET /device/sync（@Public + DeviceGuard）—— normalized 形式
// =============================================================================

/**
 * 发布计划投影。补齐 spec B5 缺口：客户端 LocalScheduleEngine 本地复算当前节目需要
 * startTime/endTime/playDays/targetStoreIds，故全量下发，由端侧按日级过滤。status=1 启用。
 */
export interface PublishPlanDto {
  id: number;
  programId: number;
  /** 目标门店 ID 列表 */
  targetStoreIds: number[];
  /** ISO 8601 开始时间 */
  startTime: string;
  /** ISO 8601 结束时间，null 表示无结束 */
  endTime: string | null;
  /** 播放星期列表（1=周一…7=周日） */
  playDays: number[];
  /** 1=启用, 0=停用 */
  status: number;
  /** ISO 8601 创建时间 */
  createdAt: string;
}

/**
 * /device/sync normalized 形式中的单个素材项：仅 materialId + duration，
 * **不**展开 material 对象，**无** bounds。客户端按 materialId 关联顶层 materials[]。
 */
export interface NormalizedMaterialItem {
  materialId: number;
  /** 展示时长，单位：秒 */
  duration: number;
}

/** /device/sync normalized 形式中的区域。 */
export interface NormalizedRegion {
  regionId: string;
  materials: NormalizedMaterialItem[];
}

/** /device/sync normalized 形式 layoutConfig。无 bounds、无展开 material。 */
export interface NormalizedLayoutConfig {
  regions: NormalizedRegion[];
}

/**
 * 节目投影（sync）。裁掉管理域字段（createdBy/publishedAt 等），仅保留设备播放所需。
 * layoutConfig 为 normalized 原始 JSON（regions[].materials[].materialId + duration）。
 */
export interface ProgramDto {
  id: number;
  name: string;
  screenOrientation: string;
  splitType: string;
  /** normalized 布局配置（不展开 material、无 bounds） */
  layoutConfig: NormalizedLayoutConfig;
  /** 1=已发布, 0=草稿 */
  status: number;
}

/** 素材元数据投影（sync）。fileSize 为 BigInt → 字符串。仅下发 APPROVED 素材。 */
export interface MaterialDto {
  id: number;
  name: string;
  /** IMAGE / VIDEO */
  type: string;
  /** 静态资源路径，支持 Range 断点续传（不在 /api 前缀下，无需鉴权） */
  fileUrl: string;
  /** 文件大小（字节，字符串，BigInt 序列化） */
  fileSize: string;
  fileExtension: string;
  width: number | null;
  height: number | null;
  /** 视频时长（秒），图片为 null */
  duration: number | null;
  thumbnailUrl: string | null;
}

/**
 * GET /device/sync 响应数据（统一信封 data 部分）。
 * version = 相关记录 updatedAt 最大值毫秒戳字符串，单调递增，作 ETag 值；无记录为 '0'。
 * 未绑定门店的设备 version='0' 且三数组为空。
 */
export interface SyncDto {
  /** 版本号（毫秒戳字符串），作 ETag */
  version: string;
  plans: PublishPlanDto[];
  programs: ProgramDto[];
  materials: MaterialDto[];
}

// =============================================================================
// POST /device/heartbeat（@Public + DeviceGuard）
// =============================================================================

/** 设备运行指标。V1 后端仅做 DTO 校验不落库，预留供后续超阈值告警。 */
export interface HeartbeatMetricsDto {
  /** CPU 使用率（百分比） */
  cpu?: number;
  /** 内存使用率（百分比） */
  mem?: number;
  /** 磁盘使用率（百分比） */
  disk?: number;
  /** 网络状态，如 'online' */
  net?: string;
}

/** POST /device/heartbeat 请求。V1 后端仅更新 lastActiveAt/ipAddress，其余字段仅校验不落库。 */
export interface HeartbeatReq {
  /** 设备自报运行状态，如 'playing'/'idle'/'error' */
  status: string;
  currentProgramId?: number;
  /** 各区域播放状态，结构由客户端定义，V1 仅校验不落库 */
  regionStates?: unknown[];
  metrics?: HeartbeatMetricsDto;
}

// =============================================================================
// POST /device/logs（@Public + DeviceGuard）
// =============================================================================

/** 单条设备日志/事件。 */
export interface LogEntryDto {
  /** 日志类型（play/event/error 等） */
  type: string;
  /** 日志载荷（JSON 对象） */
  payload: Record<string, unknown>;
  /** 严重级别 ERROR/WARN/INFO，默认 INFO（后端兜底） */
  severity?: string;
  /** 客户端日志 ID（去重用，缺失则后端用自增 id 回传） */
  clientLogId?: string;
}

/** POST /device/logs 请求。至少 1 条。 */
export interface LogBatchReq {
  entries: LogEntryDto[];
}

/** POST /device/logs 响应。acceptedIds 与请求 entries 顺序对应。 */
export interface LogBatchRes {
  /** 已接收日志 ID 列表：有 clientLogId 回传 clientLogId，无则回传自增 id（BigInt 转字符串） */
  acceptedIds: string[];
}

// =============================================================================
// POST /device/screenshot（@Public + DeviceGuard，multipart）
// =============================================================================

/** POST /device/screenshot 响应。请求为 multipart/form-data，字段名 `file`。 */
export interface ScreenshotRes {
  /** 截图访问 URL（静态资源路径，/uploads/screenshots/<deviceId>_<timestamp>.jpg） */
  url: string;
}

// =============================================================================
// POST /device/commands/:id/ack（@Public + DeviceGuard）
// =============================================================================

/** POST /device/commands/:id/ack 请求。
 *  result='success' → DeviceCommand.status=2（成功），其他值 → status=3（失败）。 */
export interface AckReq {
  /** 执行结果，'success' 表示成功 */
  result: string;
  /** 失败原因 */
  error?: string;
  /** 截图 URL（command:screenshot 成功时回传） */
  screenshotUrl?: string;
}

// =============================================================================
// 远程指令（DeviceCommand 表 / Socket.io 下发）
// =============================================================================

/** DeviceCommand 状态流转。 */
export const CommandStatus = {
  /** 待下发（离线设备入队） */
  PENDING: 0,
  /** 已下发（emit 成功） */
  DISPATCHED: 1,
  /** 已 ack 成功 */
  ACK_SUCCESS: 2,
  /** 失败（ack 非 success） */
  ACK_FAILED: 3,
  /** 过期 */
  EXPIRED: 4,
} as const;

/** 指令记录（供 GET /device/commands/pending 等后续接口，V1 未暴露 HTTP 拉取）。 */
export interface CommandDto {
  /** UUID，作指令唯一标识供设备 ack 闭环 */
  id: string;
  deviceId: number;
  /** 事件类型，如 'command:screenshot' */
  type: string;
  /** 事件载荷（不含 id，emit 时拼接 id） */
  payload: Record<string, unknown>;
  status: number;
  createdAt: string;
  expireAt: string | null;
}

// =============================================================================
// Socket.io 事件载荷（spec §6.2）
// =============================================================================

/** S→D：广告内容更新通知（沿用后端文档既有名，不入指令队列，离线设备重连后 SyncWorker 兜底）。 */
export interface AdUpdatePayload {
  version: string;
}

/** S→D：截图指令。 */
export interface CommandScreenshotPayload {
  id: string;
}

/** S→D：音量调节指令。 */
export interface CommandVolumePayload {
  id: string;
  /** 音量级别 */
  level: number;
}

/** S→D：亮度调节指令。 */
export interface CommandBrightnessPayload {
  id: string;
  /** 亮度级别 0~1 */
  level: number;
}

/** S→D：停止播放指令。 */
export interface CommandStopPayload {
  id: string;
}

/** S→D：恢复播放指令。 */
export interface CommandResumePayload {
  id: string;
}

/** S→D：强制全量同步 + 重建播放指令。 */
export interface CommandReloadPayload {
  id: string;
}

/** S→D：清素材缓存指令（保留当前）。 */
export interface CommandClearCachePayload {
  id: string;
}

/** S→D：拉取日志回传指令。 */
export interface CommandFetchLogsPayload {
  id: string;
  /** 日志级别 */
  level: string;
  /** 行数 */
  lines: number;
}

/** S→D：软重启 App 进程指令。 */
export interface CommandRestartAppPayload {
  id: string;
}

/** S→D：更新本地配置指令。 */
export interface CommandUpdateConfigPayload {
  id: string;
  /** 配置内容 */
  config: Record<string, unknown>;
}

/** S→D：强制切换指定节目指令。 */
export interface CommandSwitchProgramPayload {
  id: string;
  programId: number;
}

/** D→S：指令回执（与 HTTP POST /device/commands/:id/ack 等价，网关经 @SubscribeMessage 处理）。 */
export interface DeviceAckPayload {
  id: string;
  /** 'success' 表示成功，其他值视为失败 */
  result: string;
  error?: string;
  screenshotUrl?: string;
}

/** D→S：设备心跳（文档保留；V1 主路径为 HTTP POST /device/heartbeat，网关无对应处理器）。 */
export interface DeviceHeartbeatPayload {
  status: string;
  currentProgramId?: number;
  regionStates?: unknown[];
  metrics?: HeartbeatMetricsDto;
}

/** S→D 指令事件名集合（command:restart_device / command:power_schedule 后端拒绝，不在此列）。 */
export const DEVICE_COMMAND_EVENTS = [
  'command:screenshot',
  'command:volume',
  'command:brightness',
  'command:stop',
  'command:resume',
  'command:reload',
  'command:clear_cache',
  'command:fetch_logs',
  'command:restart_app',
  'command:update_config',
  'command:switch_program',
] as const;

/** 后端拒绝下发的指令类型（spec D1：普通盒子无系统签名不可行）。 */
export const REJECTED_COMMAND_EVENTS = [
  'command:restart_device',
  'command:power_schedule',
] as const;
