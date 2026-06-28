# ADSpread 安卓门店展示端 设计规格

> **文档类型**: Superpowers 设计文档（spec）
> **日期**: 2026-06-26
> **状态**: 已审查，已实现
> **范围**: `apps/android` 从零开发 V1 全部功能
> **依据**: `apps/android/README.md`、`docs/api/README.md`、`apps/backend/src/modules/device-api/*`、`apps/backend/src/common/utils/layout.ts`、`apps/backend/prisma/schema.prisma`、`docs/superpowers/specs/2026-06-25-adspread-admin-backend-mvp-design.md`、`docs/superpowers/specs/2026-06-26-adspread-dashboard-redesign-design.md` §5.2

---

## 0. 决策摘要（已与用户对齐）

本 spec 基于以下已确认决策撰写，不再作为待澄清项：

| # | 决策 | 选择 | 影响 |
|---|------|------|------|
| D1 | 目标硬件形态 | **普通安卓盒子（无系统签名）** | kiosk/开机自启/远程控制采用**标准档**：沉浸式 + `BootReceiver` + `FLAG_KEEP_SCREEN_ON`。远程重启设备、定时开关机**不可行**，降级为"软重启 App / 息屏休眠"。 |
| D2 | 设备端 Hermes Agent | **Hermes 是开发阶段 AI 工具，非设备端运行时组件** | **移除** README 中"Hermes Agent 集成"作为设备端能力。不预留接口、不引入抽象。其自我优化/诊断诉求由固定策略与异常上报覆盖。 |
| D3 | V1 范围 - OTA | **不做，列后续** | 不引入 `AppRelease` 表与升级流程。APK 更新走现场旁路安装。 |
| D4 | V1 范围 - 日内时段切换 | **不做，仅日级调度** | `LocalScheduleEngine` 仅按星期/日期范围过滤，与现有 `PublishPlan` schema 完全对齐，不扩展。日内仅区域素材轮播。 |
| D5 | 激活与绑定模型 | **手动录设备编码** | 对齐 PRD§5.3：后台先建 `Device` 生成 `code`，装机人员首启输入服务器地址 + 设备编码完成绑定。不做激活码流程。 |
| D6 | A/B 测试 | **不做，列后续** | 移除。 |
| D7 | 实现顺序 | **后端设备侧契约 PR 先行** | §1.2 契约是安卓端实现前提；先以独立 PR 推进后端设备侧接口 + `packages/api-contracts` DTO，再推进安卓端（先契约后实现）。 |

**V1 功能边界**：分屏布局渲染、广告播放引擎、离线与弱网、节目同步（HTTP 轮询 + Socket.io 推送）、设备管理与状态上报、远程控制（标准档能力集）、日志与异常上报、系统级能力（标准档）、现场运维入口、首启配置与设备绑定。

---

## 1. 已发现的契约缺口与偏差（必须先与后端收敛）

当前后端**仅有** `GET /api/device/program?deviceCode=` 一个 `@Public()` 公开接口，无法支撑离线 7 天播放、上行上报、实时指令。以下为 spec 落地前提。

### 1.1 后端 Bug / 偏差

| # | 位置 | 问题 | 处置 |
|---|------|------|------|
| B1 | `device-api.service.ts` `applyForcedSplit` | `bounds: getRegionBounds(...)` 把**整个 bounds 数组**塞进**每个** region，而非按索引取 `getRegionBounds(...)[i]`。后端下发的 per-region bounds 错误。 | **客户端不复用后端 bounds**，本地按 `(screenOrientation, splitType)` 用 `RegionBoundsMapper`（`layout.ts` 的 Kotlin 移植）按 region 索引计算。规避 bug 且支持离线。 |
| B2 | `apps/android/README.md` 分屏文案 vs `layout.ts` | README 称 SPLIT_3_1 为"左一右二 33%:67%"，实现是"左半屏满高 + 右半屏上下二分"。 | 客户端以 `layout.ts` 实现为权威；同步修订 README 文案。 |
| B3 | `docs/api/README.md` vs `apps/android/README.md` 事件名 | 后端文档：`device:status / publish:progress / ad:update / device:heartbeat`；安卓文档：`PROGRAM_UPDATE / COMMAND_*`。两套不一致。 | spec §6 定义**设备端权威事件集**，沿用后端 `a:b` 命名风格。 |
| B4 | Prisma `Device` 无令牌字段 | `Device` 仅有 `code`，无 `deviceToken / secret`。`/device/program` 是 `@Public`。 | 上行接口缺鉴权依据，需后端新增设备令牌模型与 `DeviceGuard`（见 §1.2）。 |
| B5 | `/device/program` 只返回单个当前节目 | 响应无 `startTime/endTime/playDays/targetStoreIds`，无法离线复算"下一个该播什么"。 | 需后端新增**全量同步接口**返回设备所属门店的全部生效计划 + 节目 + 素材元数据（带版本/ETag），作为离线调度数据源。 |
| B6 | `material.fileUrl` 鉴权未知 | 不清楚是公开静态资源、CDN 签名 URL，还是需鉴权。 | **待后端确认**。决定下载器是否带 token、是否处理签名过期。spec 按"公开静态资源 + Range 支持"假设。 |

### 1.2 需后端补齐契约清单（集中）

| 契约 | 用途 | 关键字段/事件 | 优先级 |
|------|------|--------------|--------|
| `Device` schema 扩展 | 持久化设备令牌 | **实施勘误（K1）**：`deviceToken` **不落库**，改为无状态 JWT（claims `{type:'device', sub:deviceId, code:deviceCode}`，90d 有效期，复用 `JWT_SECRET`）。DeviceGuard 解析 token 后查库校验设备 `status===1`；主动吊销 V1 不支持（列后续）。复用既有 `lastActiveAt` 作心跳时间戳（既有字段 `ipAddress/macAddress/appVersion/screenResolution` 已存在，未重复新增） | P0 |
| `POST /api/device/bind` | 设备编码绑定与令牌签发 | 入参 `{ code, hardwareInfo }` → 出参 `{ deviceToken, storeId, deviceConfig }` | P0 |
| `GET /api/device/sync` | 全量节目单 + 计划 + 素材元数据同步 | `?deviceCode=&etag=`，出参含 `version/etag` + `plans[]` + `programs[]` + `materials[]`；支持 `304`。**实施勘误（K4）**：`version` 用简化方案 = `max(相关 PublishPlan/Program/Material updatedAt 毫秒戳)` 字符串，无记录为 `'0'`；未建 `device_sync_state` 表，避免跨模块事件接线 | P0 |
| `POST /api/device/heartbeat` | 心跳 + 状态 + 播放进度 | `{ deviceCode, status, currentProgramId, regionStates[], metrics{cpu,mem,disk,net} }`；更新 `Device.lastActiveAt` | P0 |
| `POST /api/device/logs` | 批量日志/事件上报（离线缓冲） | `{ entries[] }` → `{ acceptedIds[] }` 供端侧删除 | P0 |
| `POST /api/device/screenshot` | 截图上传 | `multipart` 或 base64 → `{ url }` | P0 |
| `POST /api/device/commands/{id}/ack` | 远程指令回执 | `{ id, result, error? }` | P0 |
| **后端 Socket.io 网关实现** | 实时通道传输层（当前后端**无任何网关代码**，仅有文档约定） | `@WebSocketGateway` + `DeviceGuard` 握手鉴权 + 重连支持 | P0 |
| Socket.io 设备端事件集 | 实时指令/通知事件定义 | 见 §6.2 | P0 |
| 素材静态服务支持 `Range` | 断点续传 | HTTP `Range` header | P0 |
| `Material.checksum` 字段 | 下载完整性校验 | 新增 `checksum`(SHA-256) + 上传时计算；**V1 客户端仅校验 size**，checksum 列后续 | P1 |
| BigInt 序列化策略 | `Material.fileSize` 为 BigInt，NestJS 默认 JSON 序列化会抛错 | `@Transform` 转字符串或全局 BigInt 序列化器 | P0 |
| `GET /api/device/commands/pending` | 离线指令补偿拉取 | 设备上线后拉取待下发指令队列 | P1 |

> **重要**：以上契约是安卓端进入实现的前提。建议先以独立 PR 推进后端设备侧接口与 `packages/api-contracts/` 设备端 DTO，再推进安卓端实现（先契约后实现，避免端云脱节）。

---

## 2. 模块分层与目录结构

延续 README 已有骨架，按 Clean Architecture 细化，强化 `domain` 层与依赖方向。

```
com.adspread.android/
├── app/                      # 壳：Application、MainActivity、Hilt 入口
│   ├── AdSpreadApp.kt        # @HiltAndroidApp；初始化 WorkManager/Coil
│   └── MainActivity.kt       # 唯一 Activity，承载 Compose 与 PlayerSurface
├── di/                       # 依赖注入
│   ├── NetworkModule.kt      # OkHttp/Retrofit/Socket.io/拦截器
│   ├── DatabaseModule.kt     # Room/Mapper
│   ├── ServiceModule.kt      # 绑定 Service 与 Worker
│   └── PlayerModule.kt       # ExoPlayer 工厂、解码器池
├── domain/                   # 纯 Kotlin，无 Android/框架依赖（依赖倒置核心）
│   ├── model/                # Program/Region/MaterialRef/PublishPlan/DeviceIdentity
│   ├── schedule/             # LocalScheduleEngine（本地复算当前节目）
│   ├── layout/               # RegionBoundsMapper（移植 getRegionBounds，按索引分配）
│   ├── playback/             # PlaybackOrchestrator 接口、Playlist 策略接口
│   ├── sync/                 # SyncResolver（diff 新旧节目单 → 下载/清理队列）
│   └── command/              # CommandRouter 接口、Command 枚举
├── data/
│   ├── remote/
│   │   ├── dto/              # 对齐后端契约的 DTO
│   │   ├── api/              # DeviceApi/SyncApi/DeviceCommandApi（Retrofit 接口）
│   │   ├── socket/           # SocketIoClient、事件反序列化、重连策略
│   │   └── interceptor/      # UnifiedResponseInterceptor/DeviceTokenInterceptor/LanguageInterceptor/RetryInterceptor
│   ├── local/
│   │   ├── db/               # Room：AppDatabase + DAO + Entity
│   │   ├── prefs/            # DeviceConfigStore(DataStore)、ServerConfigStore
│   │   └── cache/            # MaterialStore(文件系统 LRU)
│   ├── repository/           # ProgramRepository/SyncRepository/DeviceRepository/LogRepository
│   └── mapper/               # DTO↔Domain↔Entity
├── service/                  # Android Service / Worker 层
│   ├── PlayerService.kt      # 前台 Service（mediaPlayback），持有 ExoPlayer 编排
│   ├── orchestration/        # PlayerController/HeartbeatLoop/ProgressReporter/CommandRouter/ScreenshotCapture
│   ├── SyncWorker.kt         # WorkManager：节目单+素材元数据同步
│   ├── DownloadWorker.kt     # WorkManager：单素材断点续传下载
│   └── BootReceiver.kt       # RECEIVE_BOOT_COMPLETED → 启动 PlayerService/MainActivity
├── presentation/             # Compose UI
│   ├── nav/                  # AppNavHost（绑定/播放/诊断三个目的地）
│   ├── screen/
│   │   ├── setup/            # 首启配置页（服务器地址 + 设备编码）
│   │   ├── player/           # PlayerSurface + 分屏渲染 + 跑马灯/图片轮播
│   │   └── diagnostic/       # 隐藏入口：版本/网络/日志/手动同步
│   ├── component/            # RegionSlot/ImageCarousel/MarqueeText/VideoSurface
│   ├── state/                # 各 ViewModel + UiState（@HiltViewModel）
│   └── theme/                # Material 主题
└── util/                     # 纯工具：TimeProvider/Hashing/SizeFormatter/LogTree
```

**依赖方向**：`presentation/service → domain ← data`；`domain` 不引用 Hilt/Room/Retrofit/ExoPlayer。建议 CI 加 `grep -r "import.*android\." domain/` 断言失败，守卫分层。

---

## 3. 核心架构决策（ADR）

### ADR-A：单 Activity + Compose Navigation
单 `MainActivity` 承载 Compose，`AppNavHost` 管理三目的地（配置 → 播放 → 诊断）。播放 Surface 生命周期绑定 Activity；截图 `PixelCopy` 可直接拿 window。Activity 重建时 ExoPlayer 实例上提到 `PlayerService` 持有，避免重建丢失。

### ADR-B：播放引擎 = 前台 Service（mediaPlayback）+ 最小 MediaSession
`PlayerService` 为前台 Service，声明 `foregroundServiceType="mediaPlayback"`（targetSdk34 强制）。为满足 mediaPlayback 类型要求，持有**最小化 MediaSession**，显式隐藏系统媒体控制器通知，避免遮挡画面。ExoPlayer 实例由 Service 持有，Activity 通过绑定接入 Surface。
- **待验证**：目标盒子 ROM 是否会因 MediaSession 弹出控制器遮挡画面，需实机测试；若无法隐藏，降级评估 `specialUse` 类型。

### ADR-C：分屏渲染 = Compose `BoxWithConstraints` + 比例 bounds 映射
- 顶层 `BoxWithConstraints` 取实际像素。
- 每个 region：`Modifier.offset(x=bounds.x*W, y=bounds.y*H).size(width=bounds.width*W, height=bounds.height*H)`。
- `RegionSlot` 按 material 类型渲染 `VideoSurface / ImageCarousel / MarqueeText`。
- region 列表用 `key(regionId)` + `derivedStateOf` 控制重组范围。

### ADR-D：region bounds 客户端本地计算（规避 B1）
客户端**忽略**后端下发 region 内的 `bounds` 字段，依据 `(screenOrientation, splitType)` 调用本地 `RegionBoundsMapper`（`layout.ts` 的 Kotlin 移植）按 region 索引取 bounds。换取正确性与离线可用。

### ADR-E：单一前台编排 Service + WorkManager 突发任务
WorkManager 周期任务最小 15min，无法承载 30s 心跳/10s 进度。故采用"**单一前台编排 `PlayerService` + WorkManager 突发任务**"模型：心跳/进度/指令由 `PlayerService` 内协程驱动；节目单同步与素材下载用 WorkManager `OneTimeWorkRequest`。避免多 FGS 滥用与 Android 14 FGS 限制冲突。

### ADR-F：WorkManager 调度 + OkHttp Range 断点续传
`SyncWorker`（节目单+元数据同步）→ `SyncResolver` diff → 入 `download_queue` → `DownloadWorker`（每素材一个，`Range` 断点续传，校验 `checksum`，失败重试有上限）。素材存储用 app 专属目录（API 26+ 无需存储权限），LRU 上限 10GB。

### ADR-G：设备绑定 = 手动录编码 + 后端签发设备 JWT（对齐 D5）
首启向导输入服务器地址 + 设备编码 → `POST /api/device/bind` → 后端校验 `code` 存在且未绑定/启用 → 签发 `deviceToken` + 返回 `storeId` + `deviceConfig`。设备持久化 token 到加密 DataStore。后续上行接口与 Socket.io 握手均带 `deviceToken`。

### ADR-H：kiosk 标准档（对齐 D1）
沉浸式 `WindowInsetsControllerCompat.hide(systemBars)` + `FLAG_KEEP_SCREEN_ON` + `BootReceiver`。**不引入 Device Owner / Lock Task**（普通盒子无系统签名）。设置页密码保护，触摸事件吞掉系统手势。远程重启/定时开关机降级为"软重启 App / 息屏休眠"。

---

## 4. 数据层设计

### 4.1 Room Schema

| 表 | 主键 | 关键字段 | 用途 |
|----|------|----------|------|
| `device_config` | `key`(TEXT) | `value`, `updated_at` | deviceCode/deviceToken/storeId/绑定状态/serverBase/lastSyncVersion/etag（KV） |
| `publish_plan_cache` | `id`(Int) | `program_id`, `target_store_ids`(JSON), `start_time`, `end_time`, `play_days`(JSON), `status`, `version` | 本地复算调度（对应 B5 缺口） |
| `program_cache` | `id`(Int) | `name`, `screen_orientation`, `split_type`, `layout_config`(JSON), `status`, `version`, `fetched_at` | 节目快照 |
| `material_meta` | `id`(Int) | `name`, `type`, `file_url`, `file_size`, `file_extension`, `width`, `height`, `duration`, `thumbnail_url`, `local_path`, `local_size`, `state`(NOT_DOWNLOADED/DOWNLOADING/READY/CORRUPT), `updated_at` | 素材元数据 + 本地状态。字段来自 `layoutConfig.regions[].materials[].material` 展开对象（§4.3）。`checksum` 列后续（待后端补 `Material.checksum`），V1 仅 `local_size` 校验 |
| `download_queue` | `material_id`(Int) | `url`, `local_path`, `total_bytes`, `downloaded_bytes`, `status`, `retries`, `priority`, `error`, `created_at` | 断点续传队列 |
| `play_log` | `id`(自增) | `session_id`, `material_id`, `region_id`, `program_id`, `started_at`, `ended_at`, `duration_ms`, `event_type`, `synced`(Int) | 离线缓冲日志，上报后删除 |
| `event_log` | `id`(自增) | `type`, `payload`(JSON), `severity`, `created_at`, `synced` | 异常/命令/系统事件 |

**索引**：`play_log(synced, created_at)`、`download_queue(status, priority)`、`material_meta(state)`。
**约束**：离线缓冲表设容量上限（如 `play_log` 10000 行 LRU），防止磁盘膨胀。Room schema 版本化，定首版与迁移契约。

### 4.2 Retrofit API 契约

> **baseUrl** = `http://<host>:3000/api/`（后端全局前缀 `/api`）。下述接口路径均相对该 base，实现时勿漏 `/api`。

```kotlin
// 已存在（公开）
interface DeviceApi {
  @GET("device/program")
  suspend fun currentProgram(@Query("deviceCode") code: String): Unified<ProgramDto?>
}

// 待后端补齐
interface SyncApi {
  @GET("device/sync")
  suspend fun sync(
    @Query("deviceCode") code: String,
    @Header("If-None-Match") etag: String?
  ): Response<Unified<SyncDto>>   // 304 时 body=null，etag 从 header 取
}
interface DeviceLifecycleApi {
  @POST("device/bind")      suspend fun bind(@Body req: BindReq): Unified<BindRes>
  @POST("device/heartbeat") suspend fun heartbeat(@Body req: HeartbeatReq): Unified<Unit>
  @POST("device/logs")      suspend fun uploadLogs(@Body req: LogBatchReq): Unified<LogBatchRes>
  @POST("device/screenshot")suspend fun uploadScreenshot(@Body req: ScreenshotReq): Unified<ScreenshotRes>
  @POST("device/commands/{id}/ack") suspend fun ackCommand(@Path("id") id: String, @Body req: AckReq): Unified<Unit>
  @GET("device/commands/pending")  suspend fun pendingCommands(@Query("deviceCode") code: String): Unified<List<CommandDto>>
}
```

**拦截器链**：`DeviceTokenInterceptor`（注入 token，缺失则跳过以兼容绑定前 `/device/program`）→ `LanguageInterceptor`（`Accept-Language`，与后端三语对齐）→ `UnifiedResponseInterceptor`（解包 `code`，非 0 抛 `BusinessException(code,message)`）→ `RetryInterceptor`（幂等 GET 指数退避）。

**素材下载**：单独 OkHttp 客户端（不走 Unified 拦截器），支持 `Range`；若 B6 表明 fileUrl 需鉴权则带 token。

### 4.3 layoutConfig JSON Schema（忠实既有契约，固化到 `packages/api-contracts/`）

后端 `Program.layoutConfig` 实际结构（依据 `create-program.dto.ts` `MaterialItemDto` 与 `device-api.service.ts` 的展开逻辑）：

```jsonc
{
  "regions": [
    {
      "regionId": "region1",
      "materials": [
        {
          "materialId": 123,
          "duration": 10,            // 单位：秒（图片/跑马灯展示时长；视频按自身时长）
          "material": {              // 后端展开的完整 Material 对象（device-api.service.ts:99-104）
            "id": 123, "name": "...", "type": "VIDEO",
            "fileUrl": "...", "fileSize": 1048576, "fileExtension": "mp4",
            "width": 1920, "height": 1080, "duration": 30,
            "thumbnailUrl": "...", "auditStatus": "APPROVED"
          }
        }
      ],
      "bounds": { "regionId": "region1", "x": 0, "y": 0, "width": 0.5, "height": 1 }
      // ↑ 后端 applyForcedSplit 注入到 region 层（Task 0 修复后为按索引取的单对象，非数组）。
      //   客户端忽略此字段，本地按 (screenOrientation, splitType) + region 索引计算（ADR-D）。
    }
  ]
}
```

- `duration`：**秒**（非毫秒）。图片/跑马灯按此值展示，视频按 `material.duration`（自身时长）播放。客户端换算毫秒时 `× 1000`。
- `material`：后端为每个素材项展开的完整 `Material` 对象，客户端下载与解码所需的 `fileUrl/type/fileSize/width/height/duration/fileExtension` 全部来自此子对象，**无需另行拉素材详情接口**。
- `bounds`：后端 `applyForcedSplit` 注入到 **region 层**（Task 0 修复 B1 后为按 region 索引取的单个 `RegionBounds` 对象，非数组），**客户端忽略**，本地按 `(screenOrientation, splitType)` + region 索引计算（ADR-D）。
- `transition`：**后端当前无此字段**。V1 客户端本地默认 `fade`，后端字段列后续（非既有契约，不纳入 §1.2 迁移）。
- 时区：后端 `startTime/endTime/playDays` 判定基于服务器时区；设备本地 `LocalScheduleEngine` 用同一时区（建议 Asia/Shanghai）。
- `fileSize` 为 `BigInt`：后端需保证 JSON 序列化不抛错（`@Transform` 或字符串下发），客户端按 Long/String 解析（见 §1.2）。

---

## 5. 离线与同步策略

### 5.1 节目单版本化
`GET /device/sync` 返回 `version`（单调递增）+ `etag`；客户端存 `lastSyncVersion/etag`，下次带 `If-None-Match`，304 即跳过。兜底：即便 304，客户端仍按本地 `LocalScheduleEngine` 计算。

### 5.2 本地播放调度器（`LocalScheduleEngine`，替代后端过滤）
移植 `getCurrentProgram` 过滤逻辑（仅日级，对齐 D4）：
1. 过滤 `status=1 && startTime<=now && (endTime null || endTime>=now)`；
2. 过滤 `playDays` 含今日（`getDay()||7`，周日=7）；
3. 过滤 `targetStoreIds` 含本设备 `storeId`；
4. 按 `createdAt desc` 取首位 → 其 `programId` 对应 `program_cache`；
5. **每 60s tick** + 节目变更事件触发；切换时通知 `PlaybackOrchestrator`。

**未绑定设备边界**：`storeId=null`（未绑定门店）不进入本地调度，直接走兜底素材（对齐后端 `device-api.service.ts:25-31` 对无门店设备返回 null）。与 §9"绑定前降级"一致。

降级链：无网络→用缓存；无缓存→播上一已知节目；全空→播内置兜底素材（随 APK 打包的品牌占位图）。

### 5.3 素材预下载与断点续传
- **触发**：节目单变更 / WS 推送 / 重连成功 / 手动同步 / 网络恢复。
- **差量**：`SyncResolver` 比对新旧素材清单，缺失/更新入 `download_queue`。
- **并发**：限制 2~3，避免抢播放带宽。
- **校验**：下载后校验 size（V1）；`checksum` 校验列后续（待后端补 `Material.checksum`，见 §1.2）。失败重试 3 次后标记 `CORRUPT`。
- **保留**：保留最近 2 个节目版本素材，旧版本 LRU 清理；超 10GB 按"未被任何当前计划引用"优先淘汰。

### 5.4 离线策略分层

| 层级 | 触发 | 设备行为 |
|------|------|---------|
| L0 在线 | Socket 连接 + 轮询成功 | 正常播放 + 实时推送 |
| L1 弱网 | 轮询超时/丢包 | 指数退避重试（上限 5min）；本地播放不中断 |
| L2 断网短期 | 无网络 | 用本地最新节目单播放；素材本地齐全则无感 |
| L3 断网长期≤7天 | 断网多日 | 继续本地播放；每 N 分钟探测网络；日志缓冲 |
| L4 断网>7天 | 超过 7 天 | 继续播本地缓存，标记"超期"上报；不停止播放 |
| L5 本地素材损坏 | 校验失败 | 跳过该素材，区域降级占位；不崩溃 |

### 5.5 网络恢复追平
`ConnectivityManager.NetworkCallback` 监听；恢复→触发 `SyncWorker` + 批量上报缓冲日志（`POST /device/logs`，按 `acceptedIds` 删除）+ 拉取待下发指令队列。

---

## 6. 实时通道（Socket.io）

### 6.1 连接与重连
- URL `http://host:3000`，Path `/socket.io/`，握手带 `Authorization: Bearer <deviceToken>`。
- 重连：指数退避 + 抖动（1s→2s→…→60s 封顶）；重连成功后立即强制一次 `SyncWorker`。
- 双通道：WS 为主（指令实时性），HTTP `GET /device/program` 每 5min 为安全兜底。WS 离线时 HTTP 轮询缩短至 2min。
- 绑定前无 token，仅走 HTTP `/device/program`。

### 6.2 设备端权威事件集（统一 B3，沿用后端文档 `a:b` 命名）

> **重要**：后端当前**无任何 Socket.io 网关代码**（仅有 `docs/api/README.md` 文档约定）。本节为新增契约，需后端先实现网关（见 §1.2）。事件命名沿用后端文档既有 `a:b` 风格，`ad:update` 保留既有名不改。

| 事件 | 方向 | 载荷 | 处理 |
|------|------|------|------|
| `ad:update` | S→D | `{ version }` | 触发 `SyncWorker`（带版本号增量）。沿用后端文档既有名 |
| `command:screenshot` | S→D | `{ id }` | `ScreenshotCapture` → 上传 → ack 带截图 url |
| `command:volume` | S→D | `{ id, level }` | AudioManager 调媒体音量 + ack |
| `command:brightness` | S→D | `{ id, level }` | `Window.screenBrightness` + ack |
| `command:stop` | S→D | `{ id }` | 停止播放（占位）+ ack |
| `command:resume` | S→D | `{ id }` | 恢复播放 + ack |
| `command:reload` | S→D | `{ id }` | 强制全量同步 + 重建播放 + ack |
| `command:clear_cache` | S→D | `{ id }` | 清素材缓存（保留当前）+ ack |
| `command:fetch_logs` | S→D | `{ id, level, lines }` | 拉取日志回传 + ack |
| `command:restart_app` | S→D | `{ id }` | 软重启 App 进程 + ack |
| `command:update_config` | S→D | `{ id, config }` | 更新本地配置 + ack |
| `command:switch_program` | S→D | `{ id, programId }` | 强制切指定节目（拉取+切）+ ack |
| `device:heartbeat` | D→S | 状态+进度 | 与 HTTP 心跳合并去重 |
| `device:ack` | D→S | `{ id, result, error? }` | 指令回执 |

**与后端文档既有事件的映射**：
- `ad:update`（文档既有，S→D 广告更新）→ 保留，作节目变更通知。
- `device:heartbeat`（文档既有，D→S）→ 保留。
- `device:status`（文档既有，语义不明）→ 设备端不消费，建议后端弃用或重定义。
- `publish:progress`（文档既有，发布进度，面向管理后台）→ 设备端不消费。
- `command:*` / `device:ack` → 本轮新增。

> **不实现**的指令（普通盒子无系统签名，D1）：`command:restart_device`（重启设备）、`command:power_schedule`（定时开关机）。后端若下发，客户端回 `UNSUPPORTED` ack。降级能力：`command:restart_app`（软重启）、息屏休眠（V1 可选，列后续）。

### 6.3 离线指令补偿
设备离线时，后端维护"待下发指令队列"；设备上线后 `GET /device/commands/pending` 拉取并按序执行，过期指令（超时阈值）由后端作废。每条指令带 `id` 供 ack 闭环。

---

## 7. 关键 Service 设计

### 7.1 `PlayerService`（前台，mediaPlayback，常驻）
持有 ExoPlayer 实例池（每视频 region 一个）+ `PlaybackOrchestrator`。内部组合（均为注入接口，便于单测）：
- `PlayerController`：根据 `LocalScheduleEngine` 输出的节目驱动各 region 播放/切换。
- `HeartbeatLoop`：协程 **60s tick** → `DeviceRepository.heartbeat()`；失败入缓冲。对齐 dashboard 在线阈值 5min，避免后端写压力。
- `ProgressReporter`：协程 **10s tick** → 上报当前 region 播放进度（与心跳合并字段或独立批量）。
- `CommandRouter`：消费 WS/轮询指令，分发到各 handler，回 ack。
- `ScreenshotCapture`：按需对 Activity window 做 `PixelCopy`。
- `Watchdog`：独立检测播放心跳；播放线程无心跳 >30s 触发软重启。

### 7.2 `SyncWorker`（WorkManager，OneTime）
拉取 `/device/sync`（带 etag）→ `SyncResolver` diff → 写库 → 入下载队列 → 发"节目变更"给 `PlayerService`。触发源：WS `program:update`、5min 轮询、重连成功、首启、手动。

### 7.3 `DownloadWorker`（WorkManager，每素材 OneTime）
OkHttp `Range` 断点续传 → 校验 size（V1；checksum 列后续）→ 更新 `material_meta`。

### 7.4 `BootReceiver`
`RECEIVE_BOOT_COMPLETED` → 启 `MainActivity`/`PlayerService`。注意 Android 14 后台启动 FGS 限制：开机后先启动 Activity 再起 Service，或借助用户可见交互豁免。

---

## 8. 远程控制实现方案（标准档能力边界，对齐 D1）

| 指令 | 实现路径 | 权限/前提 | 可行性 |
|------|----------|-----------|--------|
| 截图 | `PixelCopy` 取 Activity window | 无 | 完全可行 |
| 音量 | `AudioManager.setStreamVolume(STREAM_MUSIC)` | 无（媒体音量） | 可行 |
| 亮度 | `Window.screenBrightness`（0~1） | 无（自有 window） | 可行 |
| 停止/恢复/重载播放 | 应用内控制 | 无 | 完全可行 |
| 切节目 / 清缓存 / 拉日志 | 应用内控制 | 无 | 完全可行 |
| 软重启 App | 进程自杀 + `AlarmManager` 重启 | 无 | 可行 |
| 重启设备 | `DevicePolicyManager.reboot()` | 需 Device Owner/系统签名 | **不可行**，回 `UNSUPPORTED` |
| 定时开关机 | 硬件 RTC / 系统签名 | 厂商支持 | **不可行**，回 `UNSUPPORTED`；降级息屏列后续 |

`MediaProjection` 截图方案不引入（自有界面用 `PixelCopy` 免权限）。

---

## 9. 设备绑定与首启流程（对齐 D5）

```
首启
 ├─ App 首次启动 → 无 deviceToken → 进入 SetupScreen
 ├─ 装机人员输入后端服务器地址（持久化）
 ├─ 装机人员输入设备编码（后台预建 Device.code）
 ├─ POST /api/device/bind { code, hardwareInfo{mac,androidId,model,resolution,androidVersion,appVersion} }
 │     → 后端校验 code 存在且未绑定/启用 → 绑定硬件指纹 → 签发 deviceToken → 返回 { deviceToken, storeId, deviceConfig }
 ├─ 设备持久化 deviceToken/storeId/deviceConfig 到加密 DataStore
 └─ 进入 PlayerService → 首次 /device/sync → 预下载素材 → 播放
```

- **设备码稳定性**：`ANDROID_ID` 在恢复出厂会变；绑定后以 `code` 为准，硬件指纹仅作辅助校验。
- **绑定前降级**：无 token 时仍可调 `GET /device/program`（公开），但心跳/日志/指令不可用，UI 须提示未绑定。
- **安全**：`deviceToken` 存 `EncryptedSharedPreferences`/Tink。
- **解绑/重投**：设置页密码进入 → 恢复出厂（清本地素材/节目/token，保留 App）→ 回到 SetupScreen。

---

## 10. 系统级能力（标准档，对齐 D1）

| 能力 | 方案 | 备注 |
|------|------|------|
| 开机自启 | `BootReceiver` 监听 `BOOT_COMPLETED` | 应用被"强制停止"后接收器失效直到手动启动一次 |
| 屏幕常亮 | `FLAG_KEEP_SCREEN_ON` + `STAY_AWAKE` 唤醒锁 | - |
| 全屏沉浸 | `WindowInsetsControllerCompat.hide(systemBars)` | 状态栏可被手势呼出，设置页密码保护 |
| 防误触 | 触摸事件吞掉系统手势；长按角落/多点进设置 | - |
| 崩溃恢复自愈 | 全局异常处理器；crash 后 N 秒自动重启 | 连续崩溃 >3 次进安全模式（降级播放 + 告警） |
| 看门狗 | 独立检测播放心跳；超时软重启 | 见 §7.1 |
| 存储清理 | LRU 清理；保留最近 2 节目版本；日志按天/大小 | 超 10GB 触发 |
| 网络切换 | `ConnectivityManager` 监听；切换时重连 Socket + 触发同步 | - |
| 时间同步 | 依赖系统 NTP | 时间漂移影响 playDays 判定，标记异常上报 |

**不实现**（D1 受限）：Device Owner / Lock Task、定时开关机、系统级重启。spec 不提供增强档部署 SOP。

---

## 11. 性能保障（对齐 README 指标）

| 指标 | 实现手段 |
|------|----------|
| 冷启动 <3s | Hilt 按需 `EntryPoint` 延迟非关键初始化；SplashScreen API；首帧仅渲染播放 Surface，UI overlay 延后；Baseline Profile；ExoPlayer 实例池首屏 1 路，其余懒建 |
| 切换 <200ms | 素材预解码/预取（Coil `prefetch` 下一张）；ExoPlayer 实例常驻；Compose `key`+`derivedStateOf` 控制重组；crossfade ≤150ms |
| 内存 <200MB | 图片内存缓存上限（约可用内存 1/8）；离屏 region ExoPlayer 及时释放；解码器池上限；`onTrimMemory` 主动清缓存 |
| CPU <15% | 强制硬解（`MediaCodec` 路径）；限制并发视频 region；空闲期降帧 |
| 存储 ≥10GB 缓存 | app 专属目录 + LRU 淘汰；Coil 磁盘缓存独立限额 |
| 断网 7 天播放 | 本地调度 + 预下载全量素材 + 日志/事件缓冲（上限+轮转） |

**多视频并发解码器上限（风险）**：4 分屏全视频需 4 路硬解，低端盒子可能超限。运行时探测 `MediaCodecList` 硬解实例数；超限时对次要 region 降级（软解/降分辨率/降帧）。spec 假设"1 视频 + N 图片/文字"为常态。

**验收环境约束**：上述性能指标（冷启动<3s、CPU<15%、内存<200MB）与多路视频硬解降级逻辑**必须在真机盒子上验收**。模拟器视频走软解、解码器配置与真机不同，其性能数据与降级行为不可作为验收依据。

**度量**：关键指标进心跳上报，超阈值告警。

---

## 12. 权限清单与 targetSdk34 适配

### 12.1 权限清单
- `INTERNET`、`ACCESS_NETWORK_STATE`、`ACCESS_WIFI_STATE`
- `FOREGROUND_SERVICE`、`FOREGROUND_SERVICE_MEDIA_PLAYBACK`（PlayerService）
- `FOREGROUND_SERVICE_DATA_SYNC`（DownloadWorker；Android 15 起部分 dataSync 受限，未来评估 `mediaProcessing`）
- `RECEIVE_BOOT_COMPLETED`（BootReceiver）
- `WAKE_LOCK`
- `POST_NOTIFICATIONS`（Android 13+，前台 Service 通知，运行时申请）
- `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`（若用精确闹钟做软重启；优先 `setAndAllowWhileIdle`）
- 不需要：存储权限（app 专属目录，API 26+）

### 12.2 targetSdk34 适配点
- **FGS 类型强制**：每个前台 Service 必须声明并匹配类型；`mediaPlayback` 须有活跃 `MediaSession`（ADR-B）。
- **后台启动 FGS 限制**：`BootReceiver` 启动 Service 受限——开机后启动 Activity 再起 Service。
- **POST_NOTIFICATIONS**：运行时申请；拒绝则前台 Service 通知可能不显（Service 仍可运行，需测试厂商行为）。
- **精确闹钟**：默认 `canScheduleExactAlarms()` 受限，引导授权或用非精确闹钟。
- **mediaPlayback 通知**：Android 14 起可有媒体控制器——须隐藏控制器避免遮挡画面。

---

## 13. 日志与异常上报

| 子能力 | 实现 |
|--------|------|
| 本地日志 | 分级别记录（播放/网络/同步/异常）；循环覆盖（按大小/天数）；级别可配 |
| 崩溃捕获 | 全局异常处理器捕获 Java 崩溃堆栈落盘；crash 后自愈重启 |
| 异常上报 | 主动上报崩溃/播放失败/下载失败；带设备码/版本/时间/堆栈；离线缓冲，恢复后补传 |
| 日志拉取 | 远程指令返回日志文件或片段 |
| 日志分级 | ERROR 立即上报、WARN 聚合上报、INFO 按需拉取 |

---

## 14. 现场运维入口

| 子能力 | 实现 |
|--------|------|
| 设置页（密码） | 长按角落/多点/物理按键进入；密码可后台下发重置 |
| 本地诊断 | 一页式：设备码/版本/IP/磁盘/最近同步/最近错误 |
| 手动同步 | 按钮触发 `SyncWorker` + 截图，显示结果 |
| 服务器切换 | 设置页切换服务器地址（测试↔生产），切换后清缓存重绑 |
| 恢复出厂 | 二次确认；清本地素材/节目/token，保留 App，回 SetupScreen |

---

## 15. 测试策略

| 层级 | 工具 | 重点 |
|------|------|------|
| 单元（domain） | JUnit5 + MockK | `LocalScheduleEngine`（星期/有效期/门店过滤边界）、`RegionBoundsMapper`（全 SplitType×Orientation 矩阵）、`SyncResolver` diff、`Playlist` 策略 |
| Room | Robolectric + in-memory DB | DAO 查询、迁移、缓冲表 LRU |
| Retrofit | MockWebServer | `UnifiedResponseInterceptor` 解包/错误码、ETag 304、Range 续传、重试 |
| Socket.io | 内嵌 mock server / fake client | 事件反序列化、重连退避、双通道切换 |
| Worker | WorkManager Test API | `SyncWorker/DownloadWorker` 链式与约束 |
| Compose UI | `createComposeRule` | 分屏 bounds 映射渲染（断言 region offset/size）、重组次数、切换动画 |
| 集成 | Hilt test + 真实 Room/ExoPlayer(fake media) | 绑定→同步→播放→切换全链路 |
| 离线/重连 | `ConnectivityManager` fake | 断网降级、缓冲回放、重连强制同步 |
| 端到端 | 真机/盒子手动 + instrumented | 性能指标（冷启/切换/内存/CPU）、kiosk、开机自启 |

**契约测试**：后端 OpenAPI 生成 DTO 或共享 `packages/api-contracts` 设备端契约，保证字段一致。须包含"客户端即使收到后端 `bounds` 字段也不使用"的断言（守卫 ADR-D，防止后端修 B1 后客户端误依赖）。

**测试环境分层**：
- **模拟器（AVD）**：用于功能闭环与契约联调——分屏渲染、同步/离线/重连、远程指令、日志上报、设备绑定。模拟器内访问宿机后端用 `http://10.0.2.2:3000/api`（`10.0.2.2` 是模拟器到宿主机 loopback 的专属映射，`127.0.0.1` 在模拟器内指向模拟器自身而非宿主机）。
- **真机盒子**：用于性能指标（冷启动/CPU/内存）、视频硬解、多路视频解码器降级、BootReceiver 真实开机行为验收（见 §11 验收环境约束）。
- `10.0.2.2` 仅模拟器调试用，真机部署须用后端真实局域网 IP 或域名，不可写入生产配置。

---

## 16. 实施风险与依赖

| 风险 | 等级 | 缓解 |
|------|------|------|
| 后端契约缺口（B1/B3/B4/B5/§1.2）是头号风险 | 高 | 先以独立 PR 推进后端设备侧接口 + `packages/api-contracts` DTO，再推进安卓端 |
| 多视频并发解码器上限 | 中 | 运行时探测 + 降级策略；产品接受降级表现 |
| MediaSession 在目标 ROM 弹控制器遮挡画面 | 中 | 实机测试；无法隐藏则评估 `specialUse` 类型 |
| `material.fileUrl` 鉴权未明（B6） | 中 | 待后端确认；spec 按公开静态资源 + Range 假设 |
| 普通盒子被"强制停止"后 BootReceiver 失效 | 低 | 文档说明；依赖装机后不被强杀 |

---

## 17. 文档同步要求

按 CLAUDE.md 硬规则，实现阶段须同步：
1. 修订 `apps/android/README.md`：SPLIT_3_1 文案对齐 `layout.ts`（B2）；移除"Hermes Agent 集成"章节（D2）；移除 OTA 相关（D3）。
2. `packages/api-contracts/` 或 `docs/api/` 扩展设备端契约（§1.2 + §4.3 + §6.2）。
3. 实施计划落 `docs/superpowers/plans/2026-06-26-adspread-android-client-plan.md`。
4. 审查记录落 `docs/superpowers/reviews/`。

---

## 18. 与现有文档的冲突修正清单

| 冲突 | 修正 |
|------|------|
| README SPLIT_3_1 "33:67" vs `layout.ts` "左半屏满高+右上下二分" | 以 `layout.ts` 为准，修 README（B2） |
| README 事件名 `PROGRAM_UPDATE/COMMAND_*` vs 后端 `a:b` | 统一为 §6.2 事件集，修 README（B3） |
| README "Hermes Agent 集成" | 移除（D2，Hermes 是开发工具） |
| README §4 "定时开关机" | 移除或标注不可行（D1，普通盒子无系统签名） |
| README §4 远程控制"重启" | 明确为软重启 App（D1/§8），非重启设备 |
| minSdk：PRD API24 vs README API26 | minSdk=26（Android 8.0=API26，PRD 笔误） |
| 启动时间：PRD <10s vs README <3s | 以 README <3s 为目标，PRD 笔误 |

---

*文档版本: v1.0 | 作者: Claude Code（产品+架构双视角脑暴整合）| 状态: 待审查*
