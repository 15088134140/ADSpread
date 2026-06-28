# 任务：安卓门店展示端 V1（阶段 2）

## 背景

阶段 1 后端设备侧契约已在同一 worktree 完成（未提交）：bind/sync/heartbeat/logs/screenshot/commands ack + Socket.io 网关 + `packages/api-contracts/device/` DTO。本阶段从零搭建 `apps/android` Gradle 工程，交付 V1 全部功能。

## 目标

落实 spec §2–§18：分屏播放引擎、离线与同步、实时通道、设备管理与远程控制（标准档）、日志上报、首启绑定与现场运维入口。性能指标与硬解降级须真机盒子验收（spec §11）。

## 范围

- A0 Gradle 脚手架 + Manifest/权限 + 包结构 + 分层守卫
- A1 domain 层（RegionBoundsMapper/LocalScheduleEngine/SyncResolver/Playlist/Command）+ 单测
- A2 Room schema + DAO + Entity + Mapper + Robolectric 测试
- A3 Retrofit API + 拦截器链 + 素材下载(Range) + MockWebServer
- A4 Socket.io 客户端 + 事件集 + 重连 + 双通道
- A5 Repository + 加密 DataStore + MaterialStore(LRU)
- A6 PlayerService（mediaPlayback + MediaSession + ExoPlayer 池 + 编排 + 心跳/进度/看门狗）
- A7 SyncWorker + DownloadWorker + 网络恢复追平
- A8 CommandRouter + ScreenshotCapture + handler + ack
- A9 BootReceiver + 崩溃自愈 + kiosk 标准档 + 设置页密码
- A10 Compose UI（Setup/Player/Diagnostic + 分屏渲染）
- A11 端到端集成 + 契约测试 + 真机验收 + 文档同步 + 审查记录

## 非范围

OTA、日内时段切换、A/B 测试、Material.checksum 客户端校验、commands/pending 客户端消费、增强档 kiosk、定时开关机、系统级重启、息屏休眠降级（均列后续）。

## 相关文件

- 设计规格：`docs/superpowers/specs/2026-06-26-adspread-android-client-design.md`
- 实施计划：`docs/superpowers/plans/2026-06-26-adspread-android-client-plan.md`
- 阶段 1 契约：`packages/api-contracts/device/`（本 worktree）
- 后端实现：`apps/backend/src/modules/device-api/`（本 worktree，供核对契约）
- 安卓起点：`apps/android/README.md`（已按 spec §18 修正）

## 验收标准

- [ ] `./gradlew :app:assembleDebug` + `:app:lint` 无 Fatal
- [ ] `./gradlew :app:testDebugUnitTest` 全绿
- [ ] domain 分层守卫：domain 无 `android.*` import
- [ ] ADR-D 守卫契约测试：客户端即使收到后端 bounds 也不使用
- [ ] DTO 与 `packages/api-contracts/device/` 字段一致
- [ ] 模拟器功能闭环：bind→sync→播放→离线→重连→指令→ack
- [ ] 真机验收（K8）：冷启动<3s、切换<200ms、内存<200MB、CPU<15%、硬解降级、BootReceiver、MediaSession 隐藏——缺真机数据则标注"待真机验收"，不冒充通过
- [ ] README 与 spec §18 冲突清单逐项闭合
- [ ] 审查记录落 `docs/superpowers/reviews/2026-06-26-adspread-android-client.md`

## 验证方式

- `./gradlew :app:testDebugUnitTest :app:lint :app:assembleDebug`
- 模拟器（AVD Medium_Phone_API_36.1）访问宿机后端 `http://10.0.2.2:3000/api`
- 真机盒子性能/硬解/开机自启验收

## 备注

本机环境：JDK17（JAVA_HOME=C:\MyProgram\Java\jdk-17.0.2）、Android SDK（ANDROID_HOME=C:\MyProgram\Android\Sdk，含 platforms android-34/35/36、build-tools 34/35/36、platform-tools、emulator、AVD Medium_Phone_API_36.1）。Gradle 命令行未安装，用 `./gradlew` wrapper（首次构建需联网下载 Gradle distribution + 依赖）。后端可启动（Docker MySQL 已起，port 3000）。子代理不执行 git commit，提交由父代理统一处理。
