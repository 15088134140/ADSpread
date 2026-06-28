# ADSpread Android 客户端

> 信发系统安卓门店展示端，支持多屏分屏布局、广告自动拉取、离线播放。

---

## 技术栈

| 组件           | 技术选型                  | 版本  |
| -------------- | ------------------------- | ----- |
| **语言**       | Kotlin                    | 1.9+  |
| **UI 框架**    | Jetpack Compose           | 1.6+  |
| **架构**       | MVVM + Clean Architecture | -     |
| **依赖注入**   | Hilt                      | 2.48+ |
| **网络**       | Retrofit + OkHttp         | 4.12+ |
| **图片加载**   | Coil                      | 2.6+  |
| **视频播放**   | ExoPlayer                 | 1.2+  |
| **本地数据库** | Room                      | 2.6+  |
| **实时推送**   | Socket.io                 | 2.+   |

---

## 核心功能

### 1. 多屏分屏布局

| 分屏模式         | 说明                                     |
| ---------------- | ---------------------------------------- |
| **全屏模式**     | 100% 单视频/图片                         |
| **左右分屏**     | 50% : 50% 左右布局                       |
| **上下分屏**     | 50% : 50% 上下布局                       |
| **左一右二分屏** | 左半屏满高 + 右半屏上下二分（SPLIT_3_1） |
| **三分屏**       | 33% : 33% : 33% 等分布局                 |
| **四分屏**       | 2x2 网格布局                             |

### 2. 广告播放能力

- ✅ 视频硬解码（H.264/H.265）
- ✅ 图片轮播（支持淡入淡出动画）
- ✅ 文字跑马灯
- ✅ 混合内容播放（视频+图片+文字）
- ✅ 定时切换播放列表
- ✅ 播放策略可配置（循环、定时、顺序）

### 3. 离线能力

- ✅ 广告素材预下载到本地
- ✅ 断网后继续本地播放
- ✅ 网络恢复后自动同步最新节目单
- ✅ 断点续传下载大文件

### 4. 设备管理

- ✅ 心跳上报（设备状态、播放进度、网络状态）
- ✅ 远程截图（运营后台可查看当前播放画面）
- ✅ 远程控制（软重启 App、停止/恢复播放、音量/亮度调节、清缓存、拉日志、强制同步、切节目）
- ⚠️ 定时开关机 / 远程重启设备：普通安卓盒子无系统签名，**不可行**，降级为软重启 App / 息屏休眠

### 5. Hermes Agent

> Hermes 是本项目开发阶段的 AI 工具，非设备端运行时组件。设备端的异常诊断、日志聚合、策略优化由固定策略与异常上报覆盖，不在安卓端集成 SDK。

---

---

## 模块结构

```
apps/android/
├── app/
│   └── src/main/
│       ├── java/com/adspread/android/
│       │   ├── ui/              # UI 层
│       │   │   ├── screen/      # 各个屏幕界面
│       │   │   ├── components/  # 可复用组件
│       │   │   └── theme/       # 主题和设计系统
│       │   ├── data/            # 数据层
│       │   │   ├── remote/      # 网络 API
│       │   │   ├── local/       # 本地数据库（Room）
│       │   │   └── repository/  # 数据仓库
│       │   ├── service/         # 后台服务
│       │   │   ├── PlayerService.kt     # 播放服务
│       │   │   ├── HeartbeatService.kt  # 心跳服务
│       │   │   └── SyncService.kt       # 同步服务
│       │   ├── di/              # 依赖注入（Hilt）
│       │   └── utils/           # 工具类
│       └── res/                 # 资源文件
│           ├── drawable/
│           ├── layout/
│           └── values/
├── gradle/
├── build.gradle.kts
├── settings.gradle.kts
├── gradle.properties
└── README.md
```

---

## 与管理后台的通信协议

### 1. HTTP API 轮询

- 频率：每 5 分钟拉取一次最新节目单
- 内容：节目配置、素材列表、播放策略
- 缓存：ETag 机制，无变更时返回 304

### 2. WebSocket 实时推送（Socket.io）

- 连接：启动后自动建立长连接，握手携带设备 JWT（`socket.handshake.auth.token`）
- 心跳：每 30 秒发送 Ping
- 消息类型（沿用后端 `a:b` 命名）：
  - `ad:update`: 节目单变更（触发增量同步）
  - `command:screenshot`: 远程截图
  - `command:volume` / `command:brightness`: 音量 / 亮度调节
  - `command:stop` / `command:resume` / `command:reload`: 停止 / 恢复 / 强制重载
  - `command:restart_app`: 软重启 App（非重启设备）
  - `command:clear_cache` / `command:fetch_logs` / `command:switch_program` / `command:update_config`
  - `device:ack`（设备→后端）: 指令回执
- 完整事件集与离线指令补偿机制见 `docs/superpowers/specs/2026-06-26-adspread-android-client-design.md` §6 与 `packages/api-contracts/device/`

### 3. 状态上报

- 播放进度（每 10 秒）
- 设备状态（CPU、内存、磁盘、网络）
- 异常日志（崩溃、播放失败、下载失败）

---

## 性能指标要求

| 指标         | 要求                |
| ------------ | ------------------- |
| **启动速度** | 冷启动 < 3 秒       |
| **切换延迟** | 广告切换 < 200ms    |
| **内存占用** | 后台播放 < 200MB    |
| **CPU 占用** | 视频播放 < 15%      |
| **存储空间** | 至少预留 10GB 缓存  |
| **网络容错** | 断网可连续播放 7 天 |

---

## Hermes Agent

> Hermes 是本项目开发阶段的 AI 工具，非设备端运行时组件。安卓端不集成 Hermes SDK；异常诊断、日志聚合、策略优化由固定策略与异常上报覆盖。

---

## 环境要求

- **最低版本**: Android 8.0 (API 26)
- **目标版本**: Android 14 (API 34)
- **设备类型**: 安卓工控机、盒子、智能电视
- **硬件要求**: 2GB RAM + 16GB ROM，支持硬件视频解码

---

_文档版本: v1.0 | 最后更新: 2026-06-24_
