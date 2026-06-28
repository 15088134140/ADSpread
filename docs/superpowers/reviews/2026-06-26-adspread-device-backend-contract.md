# 审查与验证记录：安卓端设备侧后端契约（阶段 1）

**日期**: 2026-06-26
**实施计划**: `docs/superpowers/plans/2026-06-26-adspread-device-backend-contract.md`
**设计规格**: `docs/superpowers/specs/2026-06-26-adspread-android-client-design.md`
**worktree**: `worktree-device-backend-contract`
**执行方式**: 后端架构师子代理顺序执行 Task 0–5，技术文档工程师 Task 6，证据收集者 Task 7 验证，父代理收尾

---

## 一、任务完成情况

| Task | 内容                                                             | 状态 | 测试增量      |
| ---- | ---------------------------------------------------------------- | ---- | ------------- |
| 0    | B1 修复 + BigInt 序列化 + 静态 Range 验证                        | ✅   | +1（B1 回归） |
| 1    | Device 鉴权（DeviceTokenService + DeviceGuard + @CurrentDevice） | ✅   | +7            |
| 2    | `POST /device/bind`                                              | ✅   | +6            |
| 3    | `GET /device/sync`（ETag/304）                                   | ✅   | +13           |
| 4    | 上行接口 + device_log/device_command 表                          | ✅   | +17           |
| 5    | Socket.io 网关 + 事件集 + 离线指令                               | ✅   | +29           |
| 6    | packages/api-contracts DTO + docs/api                            | ✅   | —             |
| 7    | 验证 + 文档同步 + 审查记录                                       | ✅   | —             |

---

## 二、自动化验证证据

| 命令                          | 结果                                                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `npm run test`                | **27 suites / 236 tests passed**（基线含既有测试，本计划净增 73 个用例）                                                   |
| `npm run build`（nest build） | **通过**，退出码 0                                                                                                         |
| `npx eslint`（改动文件）      | **0 error**（Task 7 发现的 `handleDisconnect` require-await error 已修复）；既有 `no-explicit-any` warnings 为非阻塞既有项 |

---

## 三、集成验证证据（端到端，2026-06-26）

后端启动（port 3000）+ Docker MySQL，测试设备 `TEST001`（验证后已清理）。

| #   | 验证项                                    | HTTP | 结果                                                                   |
| --- | ----------------------------------------- | ---- | ---------------------------------------------------------------------- |
| 1   | `POST /api/device/bind`                   | 201  | 返回 deviceToken + storeId + deviceConfig ✅                           |
| 2   | `GET /api/device/sync`（200）             | 200  | 返回 version/plans/programs/materials + ETag header ✅                 |
| 3   | `GET /api/device/sync?etag=<ETag>`（304） | 304  | 无 body + ETag header ✅                                               |
| 4   | `GET /api/device/sync`（无 token）        | 401  | DEVICE_TOKEN_INVALID ✅                                                |
| 5   | `POST /api/device/heartbeat`              | 201  | DB 中 Device.lastActiveAt 已更新 ✅                                    |
| 6   | `POST /api/device/logs`                   | 201  | acceptedIds=["c1"]，device_logs 写入 1 行 ✅                           |
| 7   | `POST /api/device/commands/:id/ack`       | 201  | DeviceCommand status 0→2，payload 合并 ack ✅                          |
| 8   | Socket.io 端到端                          | —    | 连接鉴权→join room→补发离线指令(cmd-2)→device:ack→status 0→2 全闭环 ✅ |
| 9   | 静态素材 Range                            | 206  | Content-Range: bytes 0-1023/2048 ✅                                    |

**结论**：9/9 端到端验证通过。设备侧 REST + Socket.io 实时通道 + 静态资源断点续传全链路打通，DB 状态闭环均有实证。Socket.io 非仅单测覆盖，已真实连接验证。

---

## 四、实施偏离 plan 的决策（已勘误 spec）

### K1：deviceToken 不落库（偏离 spec §1.2 原文）

- **决策**：`deviceToken` 改为无状态 JWT（claims `{type:'device', sub, code}`，90d，复用 JWT_SECRET），不新增 Prisma 字段。DeviceGuard 解析 token 后查库校验 `status===1`。
- **原因**：JWT 语义本就无状态；落库需管理过期/轮换/吊销，V1 不需要。主动吊销列后续（加 `tokenRevokedAt` 或黑名单）。
- **spec 勘误**：已更新 §1.2 `Device schema 扩展` 行。

### K4：sync version 用 max(updatedAt) 简化方案（偏离 spec §1.2 原文）

- **决策**：`version = String(max(相关 PublishPlan/Program/Material updatedAt 毫秒戳))`，无记录为 `'0'`。未建 `device_sync_state` 表。
- **原因**：避免跨模块事件接线（节目发布/计划启用/素材审核/设备配置变更都要触发 version++）。简化方案无额外表与事件，性能可接受。
- **spec 勘误**：已更新 §1.2 `GET /api/device/sync` 行。

### bounds 位置勘误（spec §4.3 图示不精确）

- **实际**：`applyForcedSplit` 把 `bounds` 注入到 **region 层**（`region.bounds`），Task 0 修复 B1 后为按 region 索引取的单个 `RegionBounds` 对象 `{regionId,x,y,width,height}`，**非 materials 内的数组**。
- **spec 勘误**：已更新 §4.3 schema 图示与说明。

### 其他实施决策（未偏离，记录备查）

- **304 处理**：sync 路由用 `@Res()`（非 passthrough）直接控制响应，304 无 body、200 手动封装统一信封。绕过 TransformInterceptor，实测 304 确实无 body。
- **db push 而非 migrate dev**：项目 migrations 目录为空、DB 未被 Prisma Migrate 管理，沿用既有 `db push` 模式同步 device_log/device_command 表。
- **ipAddress 来自 @Ip()**：bind 时 ipAddress 从 HTTP 请求取（非 hardwareInfo 自报），客户端不可信 IP 不纳入契约。
- **sync normalized 形式**：sync 的 layoutConfig 不展开 material 对象（仅 materialId+duration），materials 放顶层供客户端按 materialId 关联。与 `/device/program` 的展开形式不同，Task 6 已在契约文档区分两者。
- **gateway 鉴权不用 DeviceGuard**：DeviceGuard 是 HTTP CanActivate，socket 握手复用 DeviceTokenService.verify + 手动查设备（逻辑一致）。
- **device:heartbeat D→S 事件 V1 不处理**：设备走 HTTP heartbeat，socket 不加 @SubscribeMessage。
- **ad:update 不入指令队列**：通知事件无需 ack，离线设备重连由 SyncWorker 兜底全量同步。

---

## 五、待跟进（非阻塞，列后续）

1. **device-api 模块 NOT_FOUND 错误码一致性**：device-api 的 `DEVICE_NOT_FOUND`/`COMMAND_NOT_FOUND` 用默认 BusinessException（业务码 40004、HTTP 400），而 auth/system 模块用显式 40401/404。属既有行为（非本计划引入），客户端应按 messageKey 区分而非按 404 判定。若需统一为 40401/404，属后端代码改动，列后续。
2. **DeviceTokenService 单测**：issue/verify 的真实 JWT 签发/校验逻辑未单独单测（guard spec 通过 mock 隔离）。建议后续补 `device-token.service.spec.ts`。
3. **P1 契约**：`Material.checksum` 字段 + 上传时计算、`GET /device/commands/pending` 离线补偿拉取接口（device_commands 表已建，接口列后续）。
4. **设备 token 主动吊销**：V1 无状态 JWT 不支持，列后续（`tokenRevokedAt` 或黑名单）。
5. **POST 返回 201 vs 200**：bind/heartbeat/logs/ack 返回 201 Created。语义合理，若契约文档严格要求 200 需单独核对。

---

## 六、文档同步

- `apps/android/README.md`：按 spec §18 修正——SPLIT_3_1 文案对齐 layout.ts；移除 Hermes Agent 集成章节（D2）；设备管理"重启"明确为软重启 App、"定时开关机"标注不可行（D1）；事件名统一为 §6.2 `a:b` 风格。
- `packages/api-contracts/device/`：新建 `types.ts`（DTO + Socket 事件载荷类型）+ `README.md`（契约文档，含 layoutConfig 双形式、事件集、字段对照）。
- `packages/api-contracts/README.md`：增目录索引。
- `docs/api/README.md`：新增"设备端接口（/device）"章节 + Socket.io 事件表扩充为完整 16 事件集。
- `docs/superpowers/specs/2026-06-26-adspread-android-client-design.md`：K1/K4/bounds 三处实施勘误。

---

## 七、范围确认

**已完成（V1 设备侧后端契约）**：B1 修复、BigInt 序列化、设备鉴权、bind、sync（ETag/304）、heartbeat、logs、screenshot、commands ack、Socket.io 网关 + 事件集 + 离线指令补发、契约固化、文档同步。

**不在本计划（列后续）**：安卓端实现（阶段 2）、Material.checksum、commands/pending 接口、管理后台远程指令下发 UI、设备 token 吊销。

**验证结论**：自动化测试 236 全绿、build 通过、lint 0 error；端到端 9/9 通过。本计划产物可作为安卓端阶段 2 实现的契约基础。

---

_记录人: Claude Code（父代理）| 证据来源: 证据收集者子代理集成验证报告 + 各 Task 子代理交付报告_
