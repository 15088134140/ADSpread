# 任务：安卓端设备侧后端契约（阶段 1）

## 背景

安卓门店展示端设计 spec（`docs/superpowers/specs/2026-06-26-adspread-android-client-design.md`）已审查定稿。spec §0 D7 决定"后端设备侧契约 PR 先行"——当前后端仅有 `GET /api/device/program` 一个 `@Public` 设备接口，且无 Socket.io 网关代码，无法支撑安卓端离线播放、上行上报、远程指令。需先补齐后端契约，再进安卓端实现。

## 目标

落实 spec §1.2 P0 契约清单 + B1 修复 + BigInt 序列化，产出可被安卓端消费的设备侧后端接口与实时通道，并在 `packages/api-contracts/` 固化契约。

## 范围

- B1 修复（device-api bounds 按索引取值）+ BigInt 全局序列化 + 静态 Range 验证
- 设备鉴权：DeviceTokenService（无状态 JWT，90d）+ DeviceGuard + @CurrentDevice
- `POST /api/device/bind` 设备编码绑定与令牌签发
- `GET /api/device/sync` 全量节目单+计划+素材同步（ETag/304）
- 上行接口：heartbeat / logs / screenshot / commands ack
- Socket.io 网关 + spec §6.2 事件集 + 离线指令队列（device_command 表）
- `packages/api-contracts/device/` DTO 固化 + `docs/api/README.md` 设备端章节
- `apps/android/README.md` 按 spec §18 修正

## 非范围

- 安卓端实现（阶段 2）
- `Material.checksum` 字段（P1，列后续）
- `GET /device/commands/pending`（P1，离线指令队列已含表，接口列后续）
- 管理后台远程指令下发 UI
- 设备 token 主动吊销（V1 无状态 JWT，列后续）

## 相关文件

- 设计规格：`docs/superpowers/specs/2026-06-26-adspread-android-client-design.md`
- 实施计划：`docs/superpowers/plans/2026-06-26-adspread-device-backend-contract.md`
- 改动起点：`apps/backend/src/modules/device-api/*`、`apps/backend/prisma/schema.prisma`、`apps/backend/src/main.ts`、`packages/api-contracts/`

## 验收标准

- [ ] `cd apps/backend && npm run test && npm run build && npm run lint` 全绿
- [ ] bind/sync/heartbeat/logs/screenshot/commands ack 接口可用，设备 token 鉴权生效
- [ ] sync 支持 ETag 304；Material.fileSize 以字符串下发
- [ ] Socket.io 网关握手鉴权、指令下发、离线补发、ack 闭环验证通过
- [ ] `packages/api-contracts/device/` 与后端实现字段一致
- [ ] `apps/android/README.md` 按 spec §18 修正完成
- [ ] 审查记录落 `docs/superpowers/reviews/`，含可追溯证据

## 验证方式

- `cd apps/backend && npm run test && npm run build && npm run lint`
- curl + socket.io-client 跑通 bind→sync(304/200)→heartbeat→logs→指令下发→ack→断线重连补发
- 静态素材 Range 请求返回 206

## 备注

关键设计决策见 plan §K1–K6。偏离 spec 的两处：K1（deviceToken 不落库，改无状态 JWT）、K4（version 用 max updatedAt 简化方案），实施时同步勘误 spec §1.2。子代理不执行 `git commit`，提交由父代理统一处理。
