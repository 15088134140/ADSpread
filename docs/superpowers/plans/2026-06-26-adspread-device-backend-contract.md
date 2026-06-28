# 实施计划：安卓端设备侧后端契约（阶段 1）

**日期**: 2026-06-26
**设计规格**: `docs/superpowers/specs/2026-06-26-adspread-android-client-design.md`
**范围**: spec §0 D7——后端设备侧契约 PR 先行，为安卓端实现铺路。本计划仅覆盖**后端**改动，安卓端实现计划见后续阶段 2。
**任务文档**: `tasks/in-progress/2026-06-26-adspread-device-backend-contract.md`（随本计划创建）

---

## 总览

本计划落实 spec §1.2 的 P0 契约清单 + B1 修复 + BigInt 序列化。后端当前仅有 `GET /api/device/program`（`@Public`）一个设备接口，且无 Socket.io 网关代码。本计划补齐设备鉴权、绑定、全量同步、上行上报、远程指令通道，并在 `packages/api-contracts/` 固化设备端 DTO。

| Task   | 内容                                                       | 执行方              | 依赖      | 优先级 |
| ------ | ---------------------------------------------------------- | ------------------- | --------- | ------ |
| Task 0 | B1 修复 + BigInt 序列化 + 静态 Range 验证                  | 后端架构师          | 无        | P0     |
| Task 1 | Device schema 扩展 + 设备鉴权（deviceToken + DeviceGuard） | 后端架构师          | 无        | P0     |
| Task 2 | 设备绑定接口 `POST /device/bind`                           | 后端架构师          | Task 1    | P0     |
| Task 3 | 全量同步接口 `GET /device/sync`（ETag/version）            | 后端架构师          | Task 1    | P0     |
| Task 4 | 上行接口（heartbeat/logs/screenshot/commands ack）         | 后端架构师          | Task 1    | P0     |
| Task 5 | Socket.io 网关 + 事件集 + 离线指令队列                     | 后端架构师          | Task 1、4 | P0     |
| Task 6 | `packages/api-contracts` 设备端 DTO 固化                   | 技术文档工程师      | Task 1–5  | P0     |
| Task 7 | 验证 + 文档同步 + 审查记录                                 | 父代理 + 证据收集者 | Task 1–6  | P0     |

**依赖关系**：Task 1 是 Task 2/3/4/5 的鉴权基础，须先行。Task 0 与 Task 1 无依赖可并行。Task 5 的指令下发依赖 Task 4 的指令表（`device_command`）。Task 6 在接口字段冻结后进行。Task 1–5 可由同一后端架构师子代理顺序执行（共享上下文，避免契约漂移）；Task 6/7 后续。子代理不执行 `git commit`，提交由父代理统一处理。

**不在本计划范围**（列后续）：

- `Material.checksum` 字段 + 上传时计算（spec §1.2 P1，安卓端 V1 仅校验 size）。
- `GET /device/commands/pending` 离线补偿拉取（spec §1.2 P1，Task 5 离线指令队列已含表结构，拉取接口列后续）。
- 安卓端实现（阶段 2）。
- 后端管理后台的"远程指令下发 UI"（属管理后台范畴，本计划只提供 API/网关能力）。

---

## 关键设计决策（先对齐，再动手）

### K1：设备 token 复用 JwtService，独立 claims + 长有效期

复用 `@nestjs/jwt` 同一 `JWT_SECRET`，签发时 claims 加 `type: 'device'`、`sub: deviceId`、`code: deviceCode`，有效期 **90 天**（设备无人值守，频繁换 token 需重新绑定）。**不**新建独立 secret，避免配置膨胀。`DeviceGuard` 校验 `type==='device'` 且设备 `status===1`，填充 `request.device = { id, code, storeId }`。

### K2：设备接口鉴权 = `@Public()` + 显式 `@UseGuards(DeviceGuard)`

全局 `JwtAuthGuard`（`APP_GUARD`）会先用 `JwtStrategy` 解析 token——而 `JwtStrategy.validate` 假设 admin payload（`username/roleId`），设备 token 会被解析但语义错乱。故设备上行接口一律标 `@Public()` 跳过全局守卫链，再用 `@UseGuards(DeviceGuard)` 显式鉴权。`/device/program` 与 `/device/bind` 保持 `@Public()` 无需 token（绑定前调用）。新建 `@CurrentDevice()` 参数装饰器取 `request.device`。

### K3：BigInt 序列化 = 全局 prototype patch

`Material.fileSize` 是 `BigInt`，NestJS 默认 `JSON.stringify` 会抛 `TypeError`。在 `main.ts` 启动早期加 `(BigInt.prototype as any).toJSON = function () { return String(this); }`。`fileSize` 以**字符串**下发，客户端按 String/Long 解析（spec §4.3 已注明）。此 patch 全局生效，避免逐字段 `@Transform`。

### K4：sync version/ETag = 设备级版本号

新增 `device_sync_state` 表（`deviceId` unique、`version` BigInt 自增、`updatedAt`）。任何影响设备播放内容的变更（节目发布/发布计划启用/素材审核通过/设备配置变更）触发对应设备 `version++`。`GET /device/sync?deviceCode=&etag=`：客户端传上次 etag（=version），后端比对，相同返回 `304`（空 body + ETag header），不同返回全量 + 新 ETag。`version` 单调递增，作 etag 值。**简化方案**：V1 用 `max(Program.updatedAt, PublishPlan.updatedAt, Device.updatedAt)` 毫秒戳作 version，避免跨模块事件接线；若性能可接受则不建 `device_sync_state` 表。**决策点**：Task 3 启动时二选一，建议先用简化方案（max updatedAt），后续按需升级。

### K5：Socket.io 网关 = 设备码 room + 握手 token 鉴权

`@WebSocketGateway({ path: '/socket.io/' })`。`handleConnection` 从 `socket.handshake.auth.token` 取设备 token，`DeviceGuard` 校验失败则 `socket.disconnect()`。校验通过后 `socket.join(deviceCode)`。管理后台下发指令时 `server.to(deviceCode).emit('command:xxx', {id, ...})`。设备 ack 走 `device:ack` 事件回传。离线设备的指令入 `device_command` 队列表，上线后由网关 `handleConnection` 触发补发（拉取未 ack 指令）。`ad:update` 事件由节目发布/计划启用时触发，`server.to(deviceCode).emit('ad:update', { version })`。

### K6：静态素材 Range 支持

素材 `fileUrl = /uploads/materials/xxx`（`material.service.ts:70`），由 `main.ts` `useStaticAssets('uploads', {prefix:'/uploads/'})` 提供。**注意**：`/uploads/` 不在全局 `/api` 前缀下（`useStaticAssets` 在 `setGlobalPrefix` 前注册）。Express `express.static` 默认支持 `Range` 请求，Task 0 需实测验证断点续传可用。素材下载无需鉴权（spec B6 按公开静态资源假设）。

---

## Task 0：B1 修复 + BigInt 序列化 + 静态 Range 验证

### 改动文件

- 改 `apps/backend/src/modules/device-api/device-api.service.ts`（修 B1）
- 改 `apps/backend/src/main.ts`（BigInt patch）
- 改 `apps/backend/src/modules/device-api/device-api.service.spec.ts`（B1 回归测试）

### 步骤

1. **修 B1**：`applyForcedSplit` 中 `bounds: getRegionBounds(...)` 改为按 region 索引取值：
   ```ts
   const allBounds = getRegionBounds(screenOrientation, splitType);
   programConfig.layoutConfig.regions = programConfig.layoutConfig.regions.map((region, i) => ({
     ...region,
     bounds: allBounds[i] ?? allBounds[0],
   }));
   ```
   - 说明：spec ADR-D 决定安卓端忽略后端 bounds 本地计算，故此修复对安卓端无功能影响，但修正既有 bug，避免未来其他客户端误用。保留 bounds 下发不删除（向后兼容）。
2. **BigInt patch**：`main.ts` 在 `app.useStaticAssets` 之前加：
   ```ts
   // BigInt JSON 序列化（Material.fileSize 等）
   (BigInt.prototype as any).toJSON = function () {
     return String(this);
   };
   ```
3. **静态 Range 验证**：放一个大素材到 `uploads/materials/`，用 `curl -H "Range: bytes=0-1023" http://localhost:3000/uploads/materials/xxx.mp4 -o part.bin` 验证返回 `206 Partial Content`。若不支持，评估 `express.static` 配置或改用 `range` 选项。记录验证证据。
4. **B1 回归测试**：`device-api.service.spec.ts` 增加用例：SPLIT_2 横屏时，region1.bounds = `{x:0,y:0,width:0.5,height:1}`、region2.bounds = `{x:0.5,...}`，断言每个 region 拿到对应索引的 bounds（而非整个数组）。

### 验证

- `cd apps/backend && npm run test src/modules/device-api/device-api.service.spec.ts`
- `npm run build`（确认 BigInt patch 编译通过）
- 手动 curl Range 验证（记录到审查记录）

---

## Task 1：Device schema 扩展 + 设备鉴权

### 改动文件

- 改 `apps/backend/prisma/schema.prisma`（Device 加 `deviceToken` 字段——见步骤决策）
- 新建 `apps/backend/src/modules/device-api/guards/device.guard.ts`
- 新建 `apps/backend/src/modules/device-api/decorators/current-device.decorator.ts`
- 新建 `apps/backend/src/modules/device-api/auth/device-token.service.ts`（签发/校验设备 token）
- 改 `apps/backend/src/modules/device-api/device-api.module.ts`（注册 JwtModule、guard、service）
- 改 `apps/backend/src/common/i18n/error-messages.ts`（新增设备鉴权错误码）

### 步骤

1. **schema 决策**：Device 模型**不**存 `deviceToken`（token 是签发的 JWT，存了反需管理过期/轮换）。改为：token claims 含 `deviceId`，`DeviceGuard` 解析 token 后查库校验设备存在且 `status===1`。spec §1.2 说"新增 `deviceToken`"——此处**修正为不落库**，token 为无状态 JWT，更简单且符合 JWT 语义。若需主动吊销，V1 不支持（列后续：加 `tokenRevokedAt` 字段或黑名单）。在 spec 勘误记录此偏离。
   - **替代**：若团队偏好可吊销，则 Device 加 `deviceTokenIssuedAt DateTime?`，签发时更新，guard 校验 `iat >= tokenIssuedAt`。Task 1 启动时确认。**默认采用无状态 JWT**。
2. **DeviceTokenService**：
   - `issue(device)`: `jwtService.signAsync({ type:'device', sub: device.id, code: device.code }, { expiresIn: '90d' })`。
   - `verify(token)`: `jwtService.verifyAsync(token)`，返回 payload 或抛。
3. **DeviceGuard**：
   - 从 `Authorization: Bearer <token>` 解析；`verify` 失败抛 `BusinessException('DEVICE_TOKEN_INVALID')`。
   - 校验 `payload.type==='device'`；查 `prisma.device.findFirst({ where:{ id: payload.sub, status: 1 } })`；不存在抛 `DEVICE_DISABLED_OR_NOT_FOUND`。
   - 填充 `request.device = { id, code, storeId }`。
4. **@CurrentDevice() 装饰器**：`createParamDecorator((data, req) => req.device)`。
5. **错误码**：`error-messages.ts` 新增 `DEVICE_TOKEN_INVALID`、`DEVICE_DISABLED_OR_NOT_FOUND`、`DEVICE_NOT_BOUND`（三语：ja/zh-CN/en，对齐既有格式）。
6. **模块注册**：`DeviceApiModule` imports 加 `JwtModule.register({ secret: process.env.JWT_SECRET || 'adspread-dev-secret' })`（复用同 secret），providers 加 `DeviceTokenService`、`DeviceGuard`。

### 验证

- `npm run test`（新增 guard 单测：mock DeviceTokenService + Prisma，覆盖 token 无效/设备禁用/正常三类）
- `npx prisma validate`
- 注意：若步骤1选了落库方案，需 `npx prisma migrate dev --name add_device_token_fields`

---

## Task 2：设备绑定接口 `POST /device/bind`

### 改动文件

- 新建 `apps/backend/src/modules/device-api/dto/bind.dto.ts`
- 新建 `apps/backend/src/modules/device-api/controllers/device-bind.controller.ts`（或合并进现有 `device-api.controller.ts`）
- 改 `apps/backend/src/modules/device-api/device-api.service.ts`（加 `bind` 方法）
- 改 `device-api.controller.spec.ts` / `device-api.service.spec.ts`

### 步骤

1. **BindDto**：
   ```ts
   class BindReq {
     code: string; // 设备编码
     hardwareInfo: {
       mac?: string;
       androidId?: string;
       model?: string;
       resolution?: string;
       androidVersion?: string;
       appVersion?: string;
     };
   }
   class BindRes {
     deviceToken: string;
     storeId: number | null;
     deviceConfig: DeviceConfigDto;
   }
   ```
   `DeviceConfigDto`: `{ screenOrientation, splitType, screenResolution }`（设备自身配置，供客户端初始化）。
2. **service.bind(code, hardwareInfo)**：
   - 查 `device.findFirst({ where: { code } })`；不存在抛 `DEVICE_NOT_FOUND`。
   - 校验 `device.status === 1`；否则 `DEVICE_DISABLED_OR_NOT_FOUND`。
   - 更新 `device` 的 `ipAddress/macAddress/appVersion/screenResolution`（hardwareInfo 写入，`code` 不变）。
   - 调 `DeviceTokenService.issue(device)` 签发 token。
   - 返回 `{ deviceToken, storeId: device.storeId, deviceConfig: {...} }`。
   - **重复绑定**：V1 允许重新绑定（同 code 再调 bind 重新签发 token，刷新 hardwareInfo）。不强制"未绑定"前置状态——因 spec D5 是手动录码，设备记录由后台预建，"绑定"本质是首次签发 token。如需单设备单 token，由 guard 校验状态即可。
3. **controller**：`@Post('bind')` + `@Public()`（绑定前无 token）。响应走统一 `TransformInterceptor`。
4. **测试**：bind 成功、code 不存在、设备禁用、hardwareInfo 写入。

### 验证

- `npm run test src/modules/device-api`
- 手动 curl：`POST /api/device/bind` 验证返回 token + storeId

---

## Task 3：全量同步接口 `GET /device/sync`

### 改动文件

- 新建 `apps/backend/src/modules/device-api/dto/sync.dto.ts`
- 改 `device-api.controller.ts`（加 `@Get('sync')`）
- 改 `device-api.service.ts`（加 `sync` 方法）

### 步骤

1. **SyncDto**：
   ```ts
   class SyncDto {
     version: string; // 单调递增版本号（K4）
     plans: PublishPlanDto[]; // 设备所属门店的全部生效计划
     programs: ProgramDto[]; // 这些计划引用的节目（含 layoutConfig）
     materials: MaterialDto[]; // 这些节目引用的素材元数据（fileSize 字符串，K3）
   }
   ```
   - `PublishPlanDto`：含 `id/programId/targetStoreIds/startTime/endTime/playDays/status/createdAt`（spec B5 缺口补齐，供客户端 `LocalScheduleEngine` 本地复算）。
   - `ProgramDto`：含 `id/name/screenOrientation/splitType/layoutConfig/status`。**裁掉** `createdBy/publishedAt` 等管理域字段（spec 审查 I9 建议）。
   - `MaterialDto`：`id/name/type/fileUrl/fileSize(String)/fileExtension/width/height/duration/thumbnailUrl`。
2. **service.sync(device, etag)**：
   - 取设备 `storeId`；`storeId` 为 null 返回空集（未绑定，version 不变）。
   - 计算 `version`（K4 简化方案：`String(Math.max(...相关 updatedAt 毫秒))`；或 `device_sync_state.version`）。
   - `etag === version` → 抛 `304`：用 `@Header('ETag', version)` + `res.status(304).send()`（注意 `TransformInterceptor` 会包 data，304 需绕过——controller 直接操作 `res`，返回 `undefined` 时拦截器包 `data:null` 仍会写 body。**实现要点**：用 `@HttpCode(304)` + `@Header` 并返回空，或改用 `res` 注入。Task 3 需实测 TransformInterceptor 对 304 的行为，必要时对该路由禁用拦截器）。
   - 不同则查：该门店所有 `status=1` 的 `PublishPlan`（含 program）→ 收集 programId → 查 programs → 收集 materialId → 查 materials（`auditStatus='APPROVED'`）→ 组装返回。
3. **controller**：`@Get('sync')` + `@UseGuards(DeviceGuard)` + `@Public()`，从 `@CurrentDevice()` 取 device，从 `@Query('etag')` 取 etag，`@Res({passthrough:true})` 设 ETag header。
4. **测试**：304 命中、全量返回结构、未绑定门店返回空、material.fileSize 序列化为字符串。

### 验证

- `npm run test`
- curl：带 etag 与不带，验证 304 与 200 + ETag header

---

## Task 4：上行接口（heartbeat / logs / screenshot / commands ack）

### 改动文件

- 新建 `apps/backend/src/modules/device-api/dto/heartbeat.dto.ts`、`log.dto.ts`、`screenshot.dto.ts`、`command-ack.dto.ts`
- 改 `prisma/schema.prisma`（新增 `device_command`、`device_log` 表）
- 改 `device-api.controller.ts` + `device-api.service.ts`
- 改 spec.ts

### 步骤

1. **schema 新表**：
   ```prisma
   model DeviceLog {
     id        BigInt   @id @default(autoincrement())
     deviceId  Int
     type      String   // play/event/error
     payload   Json
     severity  String   @default("INFO") // ERROR/WARN/INFO
     createdAt DateTime @default(now())
     @@index([deviceId, createdAt])
     @@map("device_logs")
   }
   model DeviceCommand {
     id        String   @id @default(uuid())  // 指令 id，供 ack
     deviceId  Int
     type      String   // command:screenshot 等
     payload   Json
     status    Int      @default(0) // 0:待下发 1:已下发 2:已ack 3:失败 4:过期
     createdAt DateTime @default(now())
     expireAt  DateTime?
     @@index([deviceId, status])
     @@map("device_commands")
   }
   ```
   - `npx prisma migrate dev --name add_device_log_command`
2. **heartbeat**：`POST /device/heartbeat`，`@UseGuards(DeviceGuard)`。
   - 入参 `{ status, currentProgramId?, regionStates[]?, metrics{cpu,mem,disk,net}? }`。
   - 更新 `device.lastActiveAt = now()`、`ipAddress`（从请求取）。
   - 可选：超阈值 metrics 写 `DeviceLog`（severity WARN）。V1 仅更新 lastActiveAt + 存 metrics 日志，不做历史表（spec §3.6 Q12）。
3. **logs**：`POST /device/logs`，入参 `{ entries: [{ type, payload, severity, clientLogId? }] }`。批量写 `DeviceLog`，返回 `{ acceptedIds: [...] }`（用 `clientLogId` 去重，供客户端删除本地缓冲）。
4. **screenshot**：`POST /device/screenshot`，`multipart` 上传（用 `@UseInterceptors(FileInterceptor)` + multer，对齐 material 上传方式）。存 `uploads/screenshots/<deviceId>_<ts>.jpg`，返回 `{ url: '/uploads/screenshots/...' }`。或 base64 入参（V1 二选一，建议 multipart 与 material 一致）。
5. **commands ack**：`POST /device/commands/:id/ack`，入参 `{ result, error? }`。更新 `DeviceCommand.status = 2`（成功）或 `3`（失败），`payload` 合并 ack 结果。若指令含 `screenshot`，ack 可带 `screenshotUrl`。
6. **测试**：各接口鉴权失败（无 token）、heartbeat 更新 lastActiveAt、logs 批量写入与去重、ack 状态流转。

### 验证

- `npx prisma validate` + `npx prisma migrate dev`
- `npm run test`
- curl 各接口（带设备 token）

---

## Task 5：Socket.io 网关 + 事件集 + 离线指令队列

### 改动文件

- 新建 `apps/backend/src/modules/device-api/gateway/device.gateway.ts`
- 新建 `apps/backend/src/modules/device-api/gateway/device.gateway.spec.ts`
- 新建 `apps/backend/src/modules/device-api/service/command-dispatch.service.ts`（供管理后台/其他模块调用下发指令）
- 改 `device-api.module.ts`

### 步骤

1. **DeviceGateway**：
   ```ts
   @WebSocketGateway({ path: '/socket.io/', cors: true })
   export class DeviceGateway implements OnGatewayConnection, OnGatewayDisconnect {
     @WebSocketServer() server: Server;
     handleConnection(socket: Socket) {
       /* K5: 从 handshake.auth.token 校验，join(deviceCode)，失败 disconnect */
     }
     handleDisconnect(socket: Socket) {
       /* leave */
     }
   }
   ```
   - `handleConnection`：取 `socket.handshake.auth.token`，`DeviceTokenService.verify` → 查设备 → `socket.join(device.code)`；失败 `socket.disconnect()`。记录连接日志。
   - 设备上线时补发离线指令：查 `DeviceCommand` 中 `status=0 && deviceId` 的未过期指令，逐条 `socket.emit(command.type, {id, ...payload})` 并置 `status=1`。
2. **CommandDispatchService**（供管理后台调用，本计划不实现管理后台 UI，只提供能力）：
   - `dispatch(deviceCode, type, payload, expireAt?)`: 查设备 → 写 `DeviceCommand`（status=0）→ 若设备在线（`server.sockets.adapter.rooms` 有该 room）立即 `server.to(code).emit(type, {id, ...payload})` 并置 status=1；离线则留队列等上线补发。
   - `broadcastProgramUpdate(deviceCode, version)`: `server.to(code).emit('ad:update', { version })`。
3. **事件集**：实现 spec §6.2 的 S→D 事件下发能力（`ad:update`、`command:screenshot/volume/brightness/stop/resume/reload/clear_cache/fetch_logs/restart_app/update_config/switch_program`）。**注意**：`command:restart_device`、`command:power_schedule` 后端**不下发**（spec D1 不可行），dispatch service 拒绝这两类型。D→S 事件 `device:ack`、`device:heartbeat`：在 gateway 加 `@SubscribeMessage('device:ack')` 处理（更新 command status）。
4. **CORS**：网关 `cors: true`（开发期）；生产按需收紧。
5. **测试**：连接鉴权失败断开、连接成功 join room、离线指令补发、ack 状态更新。用 `socket.io-client` mock。

### 验证

- `npm run test src/modules/device-api/gateway`
- `npm run build`
- 手动：socket.io-client 连 `ws://localhost:3000`，带设备 token，验证 join 与 echo

---

## Task 6：`packages/api-contracts` 设备端 DTO 固化

### 改动文件

- 新建 `packages/api-contracts/device/`（DTO 定义 + README）
- 改 `packages/api-contracts/README.md`（索引）
- 改 `docs/api/README.md`（设备端接口章节）

### 步骤

1. 在 `packages/api-contracts/device/` 固化 Task 1–5 的所有 DTO（BindReq/Res、SyncDto、HeartbeatReq、LogBatchReq/Res、ScreenshotReq/Res、AckReq、CommandDto、Socket 事件载荷），作为前后端契约单一来源。
2. `layoutConfig` JSON schema（spec §4.3）固化（含 `duration` 秒、`material` 展开对象、`bounds` 忽略说明）。
3. Socket.io 事件集（spec §6.2）固化（含与后端文档既有事件的映射表）。
4. `docs/api/README.md` 增"设备端接口"章节：bind/sync/heartbeat/logs/screenshot/commands ack + Socket.io 事件，对齐既有文档格式（统一响应信封、错误码）。
5. 标注 BigInt 字段（fileSize 字符串）、ETag 用法、设备 token 鉴权方式。

### 验证

- 人工核对 DTO 与后端实现字段一致（Task 1–5 冻结后）
- `docs/api/README.md` 渲染检查

---

## Task 7：验证 + 文档同步 + 审查记录

### 改动文件

- 改 `apps/android/README.md`（spec §17/§18 修正：SPLIT_3_1 文案、移除 Hermes/OTA、定时开关机标注、事件名）
- 改 `docs/superpowers/specs/2026-06-26-adspread-android-client-design.md`（状态改"已审查"，记录 K1/K4 偏离勘误）
- 新建 `docs/superpowers/reviews/2026-06-26-adspread-device-backend-contract.md`（审查记录）

### 步骤

1. **全量验证**：`cd apps/backend && npm run test && npm run build && npm run lint`。
2. **集成验证**：启动后端，用 curl + socket.io-client 跑通：bind → sync（304/200）→ heartbeat → logs → 下发指令 → ack → 断线重连补发。记录证据到审查记录。
3. **README 同步**：按 spec §18 修正 `apps/android/README.md`（SPLIT_3_1、Hermes 移除、OTA 移除、定时开关机标注、事件名统一为 §6.2）。
4. **spec 勘误**：记录 Task 1 K1（deviceToken 不落库改为无状态 JWT）、Task 3 K4（version 用 max updatedAt 简化方案）的实施偏离，更新 spec §1.2 相应行。
5. **审查记录**：证据收集者子代理汇总测试输出、curl 结果、socket 验证，落 `reviews/`。

### 验证

- `npm run test && npm run build && npm run lint` 全绿
- 审查记录含可追溯证据链

---

## 风险与回退

| 风险                                         | 缓解                                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 304 与 TransformInterceptor 冲突（Task 3）   | 实测；必要时对 sync 路由用 `@SkipResponseOverride` 或直接 `res` 操作                            |
| BigInt 全局 patch 影响其他模块序列化         | patch 仅将 BigInt 转 String，现有 BigInt 字段（fileSize）本就需此处理；回归 `material` 模块测试 |
| Socket.io 与全局 `/api` 前缀无关，路径需确认 | 网关 path `/socket.io/`，独立于 `/api`；实测 socket.io-client 连接                              |
| 设备 token 无状态无法主动吊销                | V1 接受（列后续加 `tokenRevokedAt`）；解绑走"设备 status=0"使 guard 拒绝                        |
| `device_sync_state` 跨模块事件接线复杂       | K4 默认用 max updatedAt 简化方案，避免事件接线                                                  |

**回退**：本计划为独立 PR，若 Socket.io 网关（Task 5）不稳定，可拆为两个 PR——PR1=Task 0–4+6+7（HTTP 契约），PR2=Task 5（网关）。HTTP 契约足以让安卓端启动阶段 2 的非实时部分开发。

---

## 后续（不在本计划）

- **阶段 2**：安卓端 V1 实现（依据本计划产出的契约 + spec §2–§15）。待本计划合入后产出阶段 2 plan。
- **P1 契约**：`Material.checksum`、`GET /device/commands/pending`。
- **管理后台**：远程指令下发 UI（消费 Task 5 的 `CommandDispatchService`）。

---

_文档版本: v1.0 | 作者: Claude Code | 状态: 待执行_
