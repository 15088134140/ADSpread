# 实施计划：安卓门店展示端 V1（阶段 2）

**日期**: 2026-06-26
**设计规格**: `docs/superpowers/specs/2026-06-26-adspread-android-client-design.md`（§2–§18）
**范围**: spec §0 D7 的"安卓端实现"阶段。`apps/android` 当前仅有 README，本计划从零搭建工程并交付 V1 全部功能。
**前置依赖**: 阶段 1 计划 `docs/superpowers/plans/2026-06-26-adspread-device-backend-contract.md` 产出的后端设备侧契约 + `packages/api-contracts/device/` DTO。阶段 1 合入前，本计划中 Task A0/A1/A2 可先行（不依赖契约）；Task A3/A4/A8 须等 `packages/api-contracts/device/` 冻结。
**任务文档**: `tasks/backlog/2026-06-26-adspread-android-client.md`（随本计划创建）

---

## 总览

本计划落实 spec §2–§18：从零搭建 `apps/android` Gradle 工程，按 Clean Architecture 分层（domain → data → service → presentation）实现分屏播放引擎、离线与同步、实时通道、设备管理与远程控制（标准档）、日志上报、首启绑定与现场运维入口。性能指标与硬解降级须真机盒子验收（spec §11）。

| Task | 内容                                                                                          | 执行方                           | 依赖                    | 优先级 |
| ---- | --------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------- | ------ |
| A0   | Gradle 工程脚手架 + Manifest/权限 + 包结构骨架 + 分层守卫                                     | Android/前端开发者               | 无（阶段 1 无关）       | P0     |
| A1   | domain 层（model/RegionBoundsMapper/LocalScheduleEngine/SyncResolver/Playlist/Command）+ 单测 | 软件架构师                       | A0                      | P0     |
| A2   | Room schema + DAO + Entity + Mapper + Robolectric 测试                                        | Android/前端开发者               | A0                      | P0     |
| A3   | Retrofit API 契约 + 拦截器链 + 素材下载 OkHttp(Range) + MockWebServer 测试                    | 前端开发者                       | A0、**阶段 1 契约冻结** | P0     |
| A4   | Socket.io 客户端 + 事件反序列化 + 重连退避 + 双通道 + mock server 测试                        | 前端开发者                       | A0、**阶段 1 契约冻结** | P0     |
| A5   | Repository 层 + 加密 DataStore + MaterialStore(LRU)                                           | Android/前端开发者               | A2、A3、A4              | P0     |
| A6   | PlayerService（前台 mediaPlayback + MediaSession + ExoPlayer 池 + 编排 + 心跳/进度/看门狗）   | Android/前端开发者               | A1、A5                  | P0     |
| A7   | SyncWorker + DownloadWorker（Range 续传 + size 校验 + 重试上限）+ 网络恢复追平                | Android/前端开发者               | A2、A3、A5              | P0     |
| A8   | CommandRouter + ScreenshotCapture + 各 command handler + ack 回传                             | Android/前端开发者               | A4、A6                  | P0     |
| A9   | BootReceiver + 崩溃自愈 + kiosk 标准档 + 设置页密码入口                                       | Android/前端开发者               | A0、A6                  | P0     |
| A10  | Compose UI（AppNavHost + Setup/Player/Diagnostic + 分屏渲染 + ViewModel/Theme）               | 前端开发者                       | A5、A6、A9              | P0     |
| A11  | 端到端集成 + 契约测试（含 ADR-D 守卫）+ 真机验收 + 文档同步 + 审查记录                        | 父代理 + 证据收集者 + 现实检验者 | A1–A10                  | P0     |

**依赖与并行**：A0 是全部前提；A1（domain 纯 Kotlin）与 A2（Room）在 A0 后可与阶段 1 并行推进，不受契约未冻结影响。A3/A4 阻塞于阶段 1 `packages/api-contracts/device/`。A5 汇聚 A2/A3/A4。A6/A7/A8 在 A5 后可部分并行（A6 持有编排，A7 是 WorkManager 突发任务，A8 依赖 A6 的 CommandRouter 接口与 A4 的 Socket）。A9/A10 在 A6 之后。A11 收口。建议 A1–A5 由同一子代理顺序执行以避免 domain↔data 契约漂移；A6/A7/A8/A9/A10 可分派不同子代理并行，父代理统一 `git commit`（子代理不得提交，见 `.ai/tool-rules.md`）。

**不在本计划范围**（列后续）：

- OTA 升级（spec D3，APK 走现场旁路安装）。
- 日内时段切换（spec D4，仅日级调度）。
- A/B 测试（spec D6）。
- `Material.checksum` 客户端校验（spec §1.2 P1，V1 仅校验 size；待后端补字段）。
- `GET /device/commands/pending` 客户端消费（spec §1.2 P1；阶段 1 网关已含离线补发，拉取接口列后续）。
- 增强档 kiosk（Device Owner / Lock Task）、定时开关机、系统级重启（spec D1，普通盒子无系统签名）。
- 息屏休眠降级（spec §6.2，V1 可选列后续）。

---

## 关键设计决策（先对齐，再动手）

### K1：工程从零搭建，版本锁定对齐 README 技术栈

`apps/android` 无既有 Gradle 工程。按 README 技术栈表锁定版本：Kotlin 1.9+、Compose 1.6+、Hilt 2.48+、Retrofit/OkHttp 4.12+、Coil 2.6+、ExoPlayer 1.2+、Room 2.6+、Socket.io 2.+、WorkManager 2.9+。`minSdk=26`、`targetSdk=34`（spec §18 修正 PRD 笔误）。Version Catalog（`libs.versions.toml`）统一管理依赖。Gradle Kotlin DSL + `settings.gradle.kts`。首版不引入未被要求的插件/抽象（CLAUDE.md 硬规则 4）。

### K2：domain 分层硬守卫

`domain/` 纯 Kotlin，禁引用 `android.*`/Hilt/Room/Retrofit/ExoPlayer（spec §2 依赖方向）。CI 加 `grep -r "import .*android\." apps/android/.../domain/` 断言失败。`LocalScheduleEngine`/`RegionBoundsMapper`/`SyncResolver`/`Playlist` 全部为纯函数/纯类，便于 JUnit5 单测且不依赖 Robolectric。

### K3：ExoPlayer 实例池 + 多路视频硬解运行时降级

`PlayerService` 持有 ExoPlayer 实例池（每视频 region 一个，首屏 1 路懒建其余）。启动时探测 `MediaCodecList` 硬解实例上限；4 分屏全视频超限时对次要 region 降级（软解/降分辨率/降帧）。spec §11 假设"1 视频 + N 图片/文字"为常态，降级为兜底。降级阈值与策略常量集中在 `domain/playback/`，便于调参。

### K4：PlayerService = mediaPlayback 前台 Service + 最小 MediaSession（待真机验证）

`foregroundServiceType="mediaPlayback"`（targetSdk34 强制），持有最小化 `MediaSession` 满足类型要求，显式隐藏系统媒体控制器通知避免遮挡画面（spec ADR-B）。**风险**：目标盒子 ROM 可能强制弹控制器遮挡画面，**必须真机验证**；无法隐藏则评估降级 `specialUse` 类型。ExoPlayer 实例上提到 Service 持有，Activity 重建不丢失。模拟器无法验收此行为。

### K5：素材存储 = app 专属目录 + LRU 10GB，无存储权限

素材落 `app` 专属目录（API 26+ 无需存储权限，spec ADR-F）。`MaterialStore` 文件系统 LRU，上限 10GB，保留最近 2 个节目版本素材，超限按"未被任何当前计划引用"优先淘汰。Coil 磁盘缓存独立限额。`download_queue` 表驱动断点续传。

### K6：deviceToken 加密存储

`deviceToken` 存 `EncryptedSharedPreferences`（Tink/AES-GCM），`DeviceConfigStore` 封装 DataStore。绑定前无 token，仅走 `GET /device/program`（@Public）。解绑/重投走"恢复出厂"清本地素材/节目/token（spec §9）。

### K7：双通道（WS 主 + HTTP 兜底）

WS 为主承载实时指令；HTTP `GET /device/program` 每 5min 安全兜底。WS 离线时 HTTP 轮询缩短至 2min。重连成功立即强制一次 `SyncWorker`。绑定前仅 HTTP。HeartbeatLoop 60s 对齐 dashboard 在线阈值 5min；ProgressReporter 10s。

### K8：真机验收约束（spec §11）

冷启动 <3s、切换 <200ms、内存 <200MB、CPU <15%、多路视频硬解降级、BootReceiver 真实开机行为**必须在真机盒子上验收**。模拟器（AVD）仅用于功能闭环与契约联调，访问宿机后端用 `http://10.0.2.2:3000/api`（模拟器专属映射，不可入生产配置）。本计划 Task A11 区分"模拟器功能验收"与"真机性能/硬解验收"两档证据。

### K9：region bounds 客户端本地计算（守卫 ADR-D）

客户端**忽略**后端下发 region 内 `bounds` 字段（B1 bug），按 `(screenOrientation, splitType)` + region 索引调本地 `RegionBoundsMapper`（`layout.ts` 的 Kotlin 移植）计算。契约测试须含"客户端即使收到后端 `bounds` 也不使用"的断言，防止后端修 B1 后客户端误依赖。

---

## Task A0：Gradle 工程脚手架 + Manifest/权限 + 包结构骨架

### 改动文件

- 新建 `apps/android/settings.gradle.kts`、`build.gradle.kts`、`app/build.gradle.kts`、`gradle/libs.versions.toml`、`gradle.properties`、`gradle/wrapper/*`
- 新建 `apps/android/app/src/main/AndroidManifest.xml`
- 新建包结构骨架（spec §2）：`app/`、`di/`、`domain/{model,schedule,layout,playback,sync,command}/`、`data/{remote/{dto,api,socket,interceptor},local/{db,prefs,cache},repository,mapper}/`、`service/orchestration/`、`presentation/{nav,screen/{setup,player,diagnostic},component,state,theme}/`、`util/`
- 新建 `AdSpreadApp.kt`（`@HiltAndroidApp`）、`MainActivity.kt` 占位
- 新建分层守卫脚本 `.ai/scripts/check-domain-purity.sh`（或 CI step）

### 步骤

1. **Version Catalog**：`libs.versions.toml` 锁定 K1 版本，按 Compose/Hilt/Network/Room/Media/Socket/WorkManager/Test 分组。
2. **app/build.gradle.kts**：`compileSdk=34`、`minSdk=26`、`targetSdk=34`；启用 Compose、Hilt KSP、Room KSP；`baselineProfile` 占位；`proguard-rules.pro` 占位。
3. **AndroidManifest**（spec §12.1 权限清单）：
   - 权限：`INTERNET`、`ACCESS_NETWORK_STATE`、`ACCESS_WIFI_STATE`、`FOREGROUND_SERVICE`、`FOREGROUND_SERVICE_MEDIA_PLAYBACK`、`FOREGROUND_SERVICE_DATA_SYNC`、`RECEIVE_BOOT_COMPLETED`、`WAKE_LOCK`、`POST_NOTIFICATIONS`、`SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM`。声明**不需要**存储权限。
   - 组件：`MainActivity`（launchMode 单实例）、`PlayerService`（`foregroundServiceType="mediaPlayback"`）、`BootReceiver`（`BOOT_COMPLETED` intent-filter）、`SyncWorker`/`DownloadWorker`（WorkManager 自动注册）。
   - `android:usesCleartextTraffic="true"`（V1 局域网 HTTP 后端；生产收紧 networkSecurityConfig 列后续）。
4. **包结构骨架**：按 spec §2 创建空包 + 占位 `.kt`（package 声明 + kdoc 指明职责），确保编译通过。
5. **AdSpreadApp**：`@HiltAndroidApp`，初始化 WorkManager/Coil（按需 EntryPoint 延迟非关键初始化，K8 冷启动）。
6. **分层守卫**：CI step `grep -rn "import .*android\." apps/android/.../domain/` 命中即失败（K2）。

### 验证

- `./gradlew :app:assembleDebug` 通过（编译 + 空 Activity 启动）
- `./gradlew :app:lint` 无 Fatal
- 分层守卫脚本运行通过（domain 无 android import）

---

## Task A1：domain 层（纯 Kotlin）

### 改动文件

- `domain/model/`：`Program`/`Region`/`MaterialRef`/`PublishPlan`/`DeviceIdentity`/`SplitType`/`ScreenOrientation`/`RegionBounds`
- `domain/layout/RegionBoundsMapper.kt`（`layout.ts` Kotlin 移植）
- `domain/schedule/LocalScheduleEngine.kt`（日级调度，spec §5.2）
- `domain/sync/SyncResolver.kt`（diff 新旧节目单 → 下载/清理队列）
- `domain/playback/PlaybackOrchestrator` 接口、`Playlist` 策略接口
- `domain/command/CommandRouter` 接口、`Command` 枚举（spec §6.2）
- `domain/test/`：JUnit5 + MockK 全套单测

### 步骤

1. **RegionBoundsMapper**：忠实移植 `getRegionBounds`（SPLIT_1/2/3/3_1/4 × PORTRAIT/LANDSCAPE 矩阵）。**注意 SPLIT_3_1 = 左半屏满高 + 右半屏上下二分**（B2 修正，非 33:67）。按 region 索引返回 `RegionBounds`。
2. **LocalScheduleEngine**（spec §5.2，仅日级对齐 D4）：
   - 过滤 `status=1 && startTime<=now && (endTime null||endTime>=now)`
   - 过滤 `playDays` 含今日（`getDay()||7`，周日=7）
   - 过滤 `targetStoreIds` 含本设备 `storeId`
   - 按 `createdAt desc` 取首位 → `programId`
   - `storeId=null`（未绑定）不进入调度，返回 null（对齐后端 `device-api.service.ts:25-31`）
   - 时区 `Asia/Shanghai`，`TimeProvider` 接口注入便于测试
3. **SyncResolver**：diff 新旧 `materials[]`（按 id + updatedAt/version）→ 输出 `toDownload[]`/`toDelete[]`/`unchanged[]`。
4. **Playlist**：图片/跑马灯按 `duration`（秒，×1000 换算），视频按 `material.duration` 自身时长；轮播/循环/顺序策略接口。
5. **Command 枚举**：对齐 spec §6.2 事件集（`command:screenshot/volume/brightness/stop/resume/reload/clear_cache/fetch_logs/restart_app/update_config/switch_program` + `restart_device`/`power_schedule` 标 `UNSUPPORTED`）。
6. **单测**：`RegionBoundsMapper` 全矩阵；`LocalScheduleEngine` 星期/有效期/门店过滤边界（含跨周、 endTime 边界、storeId=null）；`SyncResolver` diff（新增/更新/删除/无变化）；`Playlist` 时长换算。

### 验证

- `./gradlew :app:testDebugUnitTest --tests "*domain*"` 全绿
- 分层守卫：domain 测试无 `android.*` import（纯 JUnit5）

---

## Task A2：Room schema + DAO + Entity + Mapper

### 改动文件

- `data/local/db/AppDatabase.kt`、`entity/*`、`dao/*`、`Converters.kt`
- `data/mapper/EntityMapper.kt`
- `data/local/db/test/`：Robolectric in-memory

### 步骤

1. **Entity**（spec §4.1 全表）：`device_config`、`publish_plan_cache`、`program_cache`、`material_meta`、`download_queue`、`play_log`、`event_log`。字段与 spec 表逐一对照，`fileSize` 用 String（BigInt 序列化字符串，K3/阶段 1 K3）。
2. **索引**：`play_log(synced, created_at)`、`download_queue(status, priority)`、`material_meta(state)`。
3. **约束**：`play_log` 10000 行 LRU（spec §4.1 约束），DAO 提供 `evictOldest(limit)`。
4. **material_meta.state**：`NOT_DOWNLOADED/DOWNLOADING/READY/CORRUPT` 枚举。`checksum` 字段不建（spec V1 仅 size 校验）。
5. **迁移契约**：定首版 `version=1`，写空 `Migration(1→2)` 占位契约说明。
6. **测试**：DAO CRUD、`play_log` LRU 驱逐、`download_queue` 按优先级取、`material_meta` 状态流转。Robolectric in-memory DB。

### 验证

- `./gradlew :app:testDebugUnitTest --tests "*db*"` 全绿（Robolectric）
- Room schema 导出 JSON（`room.schemaLocation`）生成，便于审查

---

## Task A3：Retrofit API 契约 + 拦截器链 + 素材下载

### 改动文件

- `data/remote/dto/*`（对齐 `packages/api-contracts/device/`）
- `data/remote/api/DeviceApi.kt`、`SyncApi.kt`、`DeviceLifecycleApi.kt`（spec §4.2）
- `data/remote/interceptor/DeviceTokenInterceptor.kt`、`LanguageInterceptor.kt`、`UnifiedResponseInterceptor.kt`、`RetryInterceptor.kt`
- `di/NetworkModule.kt`
- `data/remote/test/`：MockWebServer

### 步骤

1. **DTO**：以 `packages/api-contracts/device/` 为单一来源（阶段 1 产出）。`SyncDto`/`BindReq/Res`/`HeartbeatReq`/`LogBatchReq/Res`/`ScreenshotReq/Res`/`AckReq`/`CommandDto`/`ProgramDto`/`MaterialDto`/`PublishPlanDto`。`fileSize` 按 String 解析（K3）。
2. **API 接口**（spec §4.2，baseUrl `http://<host>:3000/api/`）：
   - `DeviceApi.currentProgram`（已存在契约，`@Public`）
   - `SyncApi.sync(deviceCode, If-None-Match)` → `Response<Unified<SyncDto>>`（304 body=null，etag 从 header）
   - `DeviceLifecycleApi`：bind/heartbeat/logs/screenshot/commands ack/pending
3. **拦截器链**（spec §4.2 顺序）：`DeviceTokenInterceptor`（注入 token，缺失跳过以兼容绑定前）→ `LanguageInterceptor`（`Accept-Language` 三语）→ `UnifiedResponseInterceptor`（解包 `code`，非 0 抛 `BusinessException`）→ `RetryInterceptor`（幂等 GET 指数退避）。
4. **素材下载客户端**：独立 OkHttp（不走 Unified 拦截器），支持 `Range`；按阶段 1 K6（公开静态资源）不带 token，若 B6 后续表明需鉴权再带。
5. **测试**：MockWebServer 覆盖 UnifiedResponse 解包/错误码、ETag 304、Range 续传（`206`）、Retry 退避、token 注入/缺失分支。

### 验证

- `./gradlew :app:testDebugUnitTest --tests "*remote*"` 全绿
- DTO 字段与 `packages/api-contracts/device/` 人工核对一致

---

## Task A4：Socket.io 客户端 + 事件集 + 双通道

### 改动文件

- `data/remote/socket/SocketIoClient.kt`、`SocketEventMapper.kt`、`ReconnectStrategy.kt`
- `di/NetworkModule.kt`（Socket.io 实例）
- `data/remote/socket/test/`：内嵌 mock server / fake client

### 步骤

1. **连接**（spec §6.1）：URL `http://host:3000`，Path `/socket.io/`，握手 `auth.token = <deviceToken>`。重连指数退避 + 抖动（1s→2s→…→60s 封顶）；重连成功立即强制 `SyncWorker`。
2. **事件反序列化**（spec §6.2 设备端权威事件集，`a:b` 命名）：S→D `ad:update`/`command:*` → domain `Command`/事件；D→S `device:heartbeat`/`device:ack`。
3. **`command:restart_device`/`power_schedule`**：客户端回 `UNSUPPORTED` ack（spec §6.2/D1）。
4. **双通道**（K7）：WS 为主；HTTP `GET /device/program` 每 5min 兜底；WS 离线时 HTTP 缩至 2min。绑定前仅 HTTP。
5. **测试**：事件反序列化矩阵、重连退避时序、双通道切换、握手鉴权失败断开。用内嵌 mock socket server。

### 验证

- `./gradlew :app:testDebugUnitTest --tests "*socket*"` 全绿
- 人工：mock server 连接 + 事件 echo + 断线重连

---

## Task A5：Repository 层 + 加密 DataStore + MaterialStore

### 改动文件

- `data/repository/ProgramRepository.kt`、`SyncRepository.kt`、`DeviceRepository.kt`、`LogRepository.kt`
- `data/local/prefs/DeviceConfigStore.kt`（加密）、`ServerConfigStore.kt`
- `data/local/cache/MaterialStore.kt`（文件系统 LRU）
- `di/DatabaseModule.kt`、`di/ServiceModule.kt`

### 步骤

1. **Repository**：封装 DAO + Remote，暴露 domain model（经 mapper）。`SyncRepository.sync()` 编排 etag→304 跳过 / 200 写库→`SyncResolver` diff→入 `download_queue`→发"节目变更"。`DeviceRepository.heartbeat()` 失败入缓冲。`LogRepository` 批量上报按 `acceptedIds` 删本地。
2. **DeviceConfigStore**：`EncryptedSharedPreferences`/Tink 存 `deviceCode/deviceToken/storeId/deviceConfig/绑定状态/lastSyncVersion/etag`（K6）。
3. **ServerConfigStore**：服务器地址持久化 + 切换（测试↔生产，切换后清缓存重绑，spec §14）。
4. **MaterialStore**：app 专属目录 LRU 10GB，保留最近 2 节目版本，超限按"未被任何当前计划引用"淘汰（K5）。提供 `pathFor(materialId)`/`evict()`/`size()`。
5. **测试**：Repository 编排逻辑（mock DAO/Remote）、MaterialStore LRU 驱逐策略、DataStore 读写。

### 验证

- `./gradlew :app:testDebugUnitTest --tests "*repository*"` 全绿

---

## Task A6：PlayerService（前台 mediaPlayback + 编排）

### 改动文件

- `service/PlayerService.kt`、`service/orchestration/PlayerController.kt`、`HeartbeatLoop.kt`、`ProgressReporter.kt`、`Watchdog.kt`
- `di/PlayerModule.kt`（ExoPlayer 工厂、解码器池）
- `domain/playback/PlaybackOrchestrator` 实现

### 步骤

1. **前台 Service**：`foregroundServiceType="mediaPlayback"`，启动前台通知（隐藏媒体控制器，K4）。持有 ExoPlayer 实例池（K3）。
2. **最小 MediaSession**：满足 mediaPlayback 类型，显式隐藏系统控制器通知。**真机验证** ROM 是否弹控制器（K4 风险）。
3. **PlayerController**：消费 `LocalScheduleEngine` 输出 + "节目变更"事件，驱动各 region 播放/切换。ExoPlayer 实例常驻，crossfade ≤150ms（spec §11）。
4. **HeartbeatLoop**：协程 60s tick → `DeviceRepository.heartbeat()`；失败入缓冲。对齐 dashboard 5min 在线阈值。
5. **ProgressReporter**：协程 10s tick → 上报当前 region 播放进度。
6. **Watchdog**：独立检测播放心跳；播放线程无心跳 >30s 触发软重启（spec §7.1）。
7. **多路视频硬解降级**：启动探测 `MediaCodecList`，超限降级次要 region（K3）。
8. **测试**：编排逻辑单测（mock ExoPlayer/Repository）；HeartbeatLoop/ProgressReporter tick 时序；Watchdog 超时触发。ExoPlayer 用 fake media。

### 验证

- `./gradlew :app:testDebugUnitTest --tests "*service*"` 全绿
- **真机**（K8）：MediaSession 控制器隐藏、多路视频硬解降级、看门狗软重启

---

## Task A7：SyncWorker + DownloadWorker + 网络恢复追平

### 改动文件

- `service/SyncWorker.kt`、`service/DownloadWorker.kt`
- `service/orchestration/NetworkWatcher.kt`（`ConnectivityManager.NetworkCallback`）
- `di/ServiceModule.kt`

### 步骤

1. **SyncWorker**（OneTime）：拉 `/device/sync`（带 etag）→ `SyncResolver` diff → 写库 → 入 `download_queue` → 发"节目变更"给 `PlayerService`。触发源：WS `ad:update`、5min 轮询、重连成功、首启、手动。
2. **DownloadWorker**（每素材 OneTime）：OkHttp `Range` 断点续传 → 校验 size（V1，checksum 列后续）→ 更新 `material_meta`。并发限制 2~3，失败重试 3 次后标记 `CORRUPT`（spec §5.3）。
3. **网络恢复追平**（spec §5.5）：`NetworkCallback` 恢复 → 触发 `SyncWorker` + 批量上报缓冲日志（按 `acceptedIds` 删除）+ 拉取待下发指令。
4. **测试**：WorkManager Test API 链式与约束、DownloadWorker Range 续传 + size 校验 + 重试上限、网络恢复触发编排。

### 验证

- `./gradlew :app:testDebugUnitTest --tests "*Worker*" --tests "*Network*"` 全绿
- 人工（模拟器）：断网→本地播放→恢复→同步+补传+指令补发闭环

---

## Task A8：CommandRouter + ScreenshotCapture + 各 handler + ack

### 改动文件

- `service/orchestration/CommandRouter.kt`（实现 domain 接口）
- `service/orchestration/ScreenshotCapture.kt`
- `service/orchestration/handler/*`（各 command handler）
- `data/remote/socket/`（ack 回传 `device:ack`）

### 步骤

1. **CommandRouter**：消费 WS/轮询指令，分发到各 handler，回 ack（spec §6.2/§7.1）。
2. **handler 实现**（spec §8）：screenshot(`PixelCopy`)/volume(`AudioManager`)/brightness(`Window.screenBrightness`)/stop/resume/reload/clear_cache/fetch_logs/restart_app(`AlarmManager` 重启)/update_config/switch_program。
3. **UNSUPPORTED**：`restart_device`/`power_schedule` 回 `UNSUPPORTED` ack（D1）。
4. **ScreenshotCapture**：`PixelCopy` 取 Activity window（自有界面免权限，不引入 MediaProjection）。
5. **ack 回传**：`device:ack { id, result, error? }`；screenshot ack 带截图 url。
6. **测试**：CommandRouter 分发矩阵、各 handler 行为（mock 系统 API）、UNSUPPORTED 分支、ack 载荷。

### 验证

- `./gradlew :app:testDebugUnitTest --tests "*Command*" --tests "*handler*"` 全绿
- 人工（模拟器）：下发各指令 → 执行 → ack 闭环

---

## Task A9：BootReceiver + 崩溃自愈 + kiosk 标准档

### 改动文件

- `service/BootReceiver.kt`
- `app/CrashHandler.kt`（全局异常处理器）
- `presentation/screen/diagnostic/SettingsEntry.kt`（密码入口）
- `util/`：kiosk 工具

### 步骤

1. **BootReceiver**（spec §7.4/§10）：`RECEIVE_BOOT_COMPLETED` → 启动 `MainActivity`/`PlayerService`。Android 14 后台启动 FGS 限制：开机后先启 Activity 再起 Service。
2. **崩溃自愈**（spec §10/§13）：全局异常处理器捕获 Java 崩溃堆栈落盘；crash 后 N 秒 `AlarmManager` 自愈重启；连续崩溃 >3 次进安全模式（降级播放 + 告警）。
3. **kiosk 标准档**（spec ADR-H/§10）：沉浸式 `WindowInsetsControllerCompat.hide(systemBars)` + `FLAG_KEEP_SCREEN_ON` + `STAY_AWAKE` 唤醒锁；触摸事件吞掉系统手势；长按角落/多点进设置（密码保护）。**不引入** Device Owner/Lock Task。
4. **设置页密码**：密码可后台下发重置（spec §14）；二次确认恢复出厂。
5. **测试**：BootReceiver 启动编排（Robolectric）、崩溃计数→安全模式、密码入口。

### 验证

- `./gradlew :app:testDebugUnitTest --tests "*Boot*" --tests "*Crash*" --tests "*kiosk*"` 全绿
- **真机**（K8）：BootReceiver 真实开机自启、崩溃自愈、kiosk 沉浸

---

## Task A10：Compose UI（Setup/Player/Diagnostic）

### 改动文件

- `presentation/nav/AppNavHost.kt`
- `presentation/screen/setup/SetupScreen.kt` + `SetupViewModel`
- `presentation/screen/player/PlayerSurface.kt` + `PlayerViewModel`
- `presentation/screen/diagnostic/DiagnosticScreen.kt` + `DiagnosticViewModel`
- `presentation/component/`：`RegionSlot`/`VideoSurface`/`ImageCarousel`/`MarqueeText`
- `presentation/state/`、`presentation/theme/`

### 步骤

1. **AppNavHost**（spec ADR-A）：三目的地（配置 → 播放 → 诊断）。无 token → SetupScreen；有 token → PlayerScreen。
2. **SetupScreen**（spec §9）：输入服务器地址 + 设备编码 → `POST /device/bind` → 持久化 token/storeId/deviceConfig → 进 PlayerScreen。校验 + 错误提示。
3. **PlayerSurface**（spec ADR-C）：顶层 `BoxWithConstraints` 取实际像素；每 region `Modifier.offset(x=bounds.x*W,y=bounds.y*H).size(width=bounds.width*W,height=bounds.height*H)`；`RegionSlot` 按 material 类型渲染 `VideoSurface/ImageCarousel/MarqueeText`；`key(regionId)` + `derivedStateOf` 控制重组。
4. **bounds 本地计算**（K9）：`PlayerSurface` 调 `RegionBoundsMapper`，**不读**后端 `bounds` 字段。
5. **DiagnosticScreen**（spec §14）：一页式设备码/版本/IP/磁盘/最近同步/最近错误；手动同步按钮；服务器切换；恢复出厂（二次确认）。
6. **ViewModel**：`@HiltViewModel` + `UiState`；冷启动优化首帧仅渲染播放 Surface，UI overlay 延后（K8）。
7. **测试**：`createComposeRule` 分屏 bounds 映射渲染（断言 region offset/size）、重组次数、切换动画；SetupScreen bind 流程；DiagnosticScreen。

### 验证

- `./gradlew :app:testDebugUnitTest --tests "*presentation*"` 全绿
- 人工（模拟器）：三目的地导航、分屏渲染全 SplitType×Orientation、bind 流程

---

## Task A11：端到端集成 + 契约测试 + 真机验收 + 文档同步 + 审查记录

### 改动文件

- `app/src/androidTest/`：集成测试（Hilt test + 真实 Room/ExoPlayer fake media）
- `app/src/test/`：契约测试（含 ADR-D 守卫）
- 改 `apps/android/README.md`（spec §17/§18 修正）
- 改 spec 状态/勘误
- 新建 `docs/superpowers/reviews/2026-06-26-adspread-android-client.md`

### 步骤

1. **端到端集成**（spec §15）：Hilt test 跑通 绑定→sync(304/200)→播放→切换→离线降级→重连追平→指令→ack→断线重连补发。模拟器用 `http://10.0.2.2:3000/api`（K8）。
2. **契约测试**：DTO 与 `packages/api-contracts/device/` 字段一致；**ADR-D 守卫**：客户端即使收到后端 `bounds` 字段也不使用（防后端修 B1 后误依赖）。
3. **离线/重连**：`ConnectivityManager` fake 跑 L0–L5 降级链（spec §5.4）。
4. **真机验收**（K8，spec §11）：冷启动 <3s、切换 <200ms、内存 <200MB、CPU <15%、多路视频硬解降级、BootReceiver 开机自启、MediaSession 控制器隐藏。现实检验者子代理核对证据是否充分，缺真机数据则判定"未达生产就绪"。
5. **README 同步**（spec §17/§18）：SPLIT_3_1 文案对齐 `layout.ts`（B2）；移除"Hermes Agent 集成"（D2）；移除 OTA（D3）；定时开关机标注不可行（D1）；事件名统一 §6.2（B3）；minSdk=26；启动 <3s。
6. **spec 勘误**：记录实施偏离（若有），更新状态。
7. **审查记录**：证据收集者汇总单测/集成/真机证据链，落 `reviews/`。

### 验证

- `./gradlew :app:testDebugUnitTest :app:connectedDebugTest` 全绿
- `./gradlew :app:lint` 无 Fatal
- 真机性能/硬解/开机自启证据入审查记录
- README 与 spec §18 冲突清单逐项闭合

---

## 风险与回退

| 风险                                                 | 等级 | 缓解                                                                                                                               |
| ---------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 阶段 1 契约未冻结阻塞 A3/A4                          | 高   | A0/A1/A2 先行不依赖契约；A3/A4 等 `packages/api-contracts/device/` 落地；必要时以 spec §4.2/§4.3/§6.2 临时定义 DTO，契约冻结后对齐 |
| MediaSession 在目标 ROM 弹控制器遮挡画面（K4）       | 中   | 真机验证；无法隐藏评估 `specialUse` 类型                                                                                           |
| 多视频并发硬解超限（K3）                             | 中   | 运行时探测 + 降级；产品接受降级表现                                                                                                |
| 普通盒子被"强制停止"后 BootReceiver 失效（spec §16） | 低   | 文档说明；依赖装机后不被强杀                                                                                                       |
| targetSdk34 FGS/POST_NOTIFICATIONS 厂商行为差异      | 中   | 真机覆盖主流目标 ROM；通知拒绝时 Service 仍运行需测试                                                                              |
| 真机验收环境不可得（K8）                             | 中   | 模拟器先完成功能闭环；真机性能/硬解指标缺失时审查记录明确标注"待真机验收"，不冒充通过                                              |

**回退/拆分**：若 Socket.io 实时通道（A4/A8）联调受阻，可先合入 A0–A3+A5–A7+A9–A10（HTTP 轮询 + 离线播放 + 上行上报 + kiosk），实时指令通道单独跟进——HTTP 兜底已能支撑基本播放闭环。若 ExoPlayer 多路硬解降级在真机表现不达标，V1 收敛为"1 视频 + N 图片/文字"常态，4 路全视频列后续。

---

## 后续（不在本计划）

- **P1 契约消费**：`Material.checksum` 客户端校验、`GET /device/commands/pending` 客户端拉取（待阶段 1 P1 接口落地）。
- **增强档**：Device Owner/Lock Task 部署 SOP、定时开关机、系统级重启（需系统签名设备）。
- **息屏休眠**降级（spec §6.2 V1 可选）。
- **生产加固**：`networkSecurityConfig` 收紧 cleartext、Coil/ExoPlayer 调优、Baseline Profile 正式生成。
- **管理后台远程指令下发 UI**（消费阶段 1 `CommandDispatchService`，属管理后台范畴）。

---

_文档版本: v1.0 | 作者: Claude Code | 状态: 待审查_
