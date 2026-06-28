# 设备端 API 契约（Device Contract）

> **范围**：安卓展示端 ↔ 后端设备侧接口（`/api/device/*`）+ Socket.io 实时通道。
> **权威来源**：本目录 `types.ts` 为字段单一来源，以后端 `apps/backend/src/modules/device-api/` 实现（Task 1–5 已冻结）为准。
> **关联文档**：`docs/api/README.md`「设备端接口」章节、`docs/superpowers/specs/2026-06-26-adspread-android-client-design.md` §4.3/§6.2。

---

## 1. 基础约定

| 项           | 值                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------ | ----- | ------------------- |
| Base URL     | `http://<host>:3000/api`                                                                                     |
| 数据格式     | JSON（截图上传为 `multipart/form-data`）                                                                     |
| 统一响应信封 | `{ code, message, data, timestamp }`，`code:0` 成功                                                          |
| 错误码       | `400xx` 参数 / `401xx` 认证 / `403xx` 权限 / `404xx` 资源 / `500xx` 服务端                                   |
| 多语言       | 请求头 `Accept-Language: ja                                                                                  | zh-CN | en`（默认 `zh-CN`） |
| BigInt       | `Material.fileSize`、`DeviceLog.id` 经全局 patch 以**字符串**下发                                            |
| 静态素材     | `/uploads/materials/...`、`/uploads/screenshots/...` **不在 `/api` 前缀下**，支持 `Range` 断点续传，无需鉴权 |

---

## 2. 设备鉴权

| 接口                            | 鉴权                                                 |
| ------------------------------- | ---------------------------------------------------- |
| `GET /device/program`           | `@Public()` 无需 token                               |
| `POST /device/bind`             | `@Public()` 无需 token                               |
| `GET /device/sync`              | `@Public()` + `@UseGuards(DeviceGuard)` 需设备 token |
| `POST /device/heartbeat`        | `@Public()` + `@UseGuards(DeviceGuard)` 需设备 token |
| `POST /device/logs`             | `@Public()` + `@UseGuards(DeviceGuard)` 需设备 token |
| `POST /device/screenshot`       | `@Public()` + `@UseGuards(DeviceGuard)` 需设备 token |
| `POST /device/commands/:id/ack` | `@Public()` + `@UseGuards(DeviceGuard)` 需设备 token |

**设备令牌（deviceToken）**：

- 无状态 JWT，复用与 admin 相同的 `JWT_SECRET`，claims `{ type:'device', sub:deviceId, code:deviceCode }`，有效期 **90 天**。
- 设备上行接口在 `Authorization: Bearer <deviceToken>` 头携带。
- Socket.io 握手通过 `socket.handshake.auth.token`（或 `Authorization: Bearer` 头）携带。
- `DeviceGuard` 校验：解析 token → `type==='device'` → 查设备 `status===1` → 填充 `request.device={id,code,storeId}`。
- token 不落库（无状态），V1 不支持主动吊销；解绑走"设备 `status=0`"使 guard 拒绝。

**鉴权与业务错误码**：

| 错误码（messageKey）           | 业务码 `code` | HTTP | 触发场景                                                                 |
| ------------------------------ | ------------- | ---- | ------------------------------------------------------------------------ |
| `DEVICE_TOKEN_INVALID`         | 40102         | 401  | token 缺失/格式不符/签名无效/过期/`type` 非 `device`                     |
| `DEVICE_DISABLED_OR_NOT_FOUND` | 40101         | 401  | 设备不存在或 `status!==1`（禁用）                                        |
| `DEVICE_NOT_FOUND`             | 40004         | 400  | `/device/bind` 时 code 不存在                                            |
| `COMMAND_NOT_FOUND`            | 40004         | 400  | ack 的指令不存在或不属于本设备                                           |
| `COMMAND_UNSUPPORTED`          | 40004         | 400  | 下发 `command:restart_device`/`command:power_schedule`（spec D1 不可行） |
| `FILE_NOT_UPLOADED`            | 40004         | 400  | 截图上传未携带 `file`                                                    |

> **注意**：device-api 模块的 `DEVICE_NOT_FOUND`/`COMMAND_NOT_FOUND`/`FILE_NOT_UPLOADED` 用默认 `BusinessException` 构造，业务码为 `40004`（`BUSINESS_RULE_VIOLATION`）、HTTP 400——**不**返回 `40401/404`。这与 auth/system 模块（显式传 `NOT_FOUND,404`）的约定不同。客户端不要按 HTTP 404 或业务码 404xx 判定"资源不存在"，应按 `messageKey`/`message` 文案区分。

---

## 3. 接口清单

> 字段类型见 `types.ts`。日期字段线上一律为 ISO 8601 字符串；`fileSize`/自增 `id` 为字符串（BigInt）。

### 3.1 `POST /device/bind` — 设备绑定

公开接口。凭设备编码完成绑定：校验 code 存在且启用 → 刷新硬件信息 → 签发设备令牌。**允许重复绑定**（重新签发 token + 刷新 hardwareInfo）。

**请求** `BindReq`：

```jsonc
{
  "code": "DEVICE001",
  "hardwareInfo": {
    "mac": "AA:BB:CC:DD:EE:FF",
    "androidId": "a1b2c3d4e5f6g7h8",
    "model": "RK3568",
    "resolution": "1920x1080",
    "androidVersion": "12",
    "appVersion": "1.0.0",
  },
}
```

> `ipAddress` 由后端从请求 `@Ip()` 取，**不在 hardwareInfo 内**。
> `hardwareInfo` 必传（可空对象 `{}`），内部字段均 optional。`mac/resolution/appVersion` 落库到 Device（`macAddress/screenResolution/appVersion`），`androidId/model/androidVersion` 仅校验不落库。

**响应** `BindRes`：

```jsonc
{
  "deviceToken": "eyJhbGciOiJIUzI1NiIs...",
  "storeId": 1, // 未绑定门店为 null
  "deviceConfig": {
    "screenOrientation": "LANDSCAPE",
    "splitType": "SPLIT_2",
    "screenResolution": "1920x1080",
  },
}
```

### 3.2 `GET /device/sync` — 设备全量同步（ETag/304）

需设备 token。返回该设备门店相关的全部生效发布计划、已发布节目（含 layoutConfig）与 APPROVED 素材元数据。

**Query**：`?etag=<上次返回的 version>`（可选）。

**版本号**：`version = max(相关记录 updatedAt 毫秒戳)` 字符串，单调递增，作 ETag 值；无记录为 `'0'`。

**响应**：

- `etag === version` → **304**：无 body + `ETag` header。
- 否则 → **200**：统一信封包裹 `SyncDto` + `ETag` header。
  > 注意：该路由用 `@Res()` 直接控制响应（绕过 TransformInterceptor 以保证 304 无 body），200 响应手动封装统一信封。
- 未绑定门店（`storeId=null`）→ `version='0'`，三数组为空。

**响应 data** `SyncDto`（normalized 形式，详见 §4.2）：

```jsonc
{
  "version": "1719360000000",
  "plans": [
    {
      "id": 1,
      "programId": 10,
      "targetStoreIds": [1, 7],
      "startTime": "2026-01-01T00:00:00.000Z",
      "endTime": null,
      "playDays": [1, 2, 3, 4, 5],
      "status": 1,
      "createdAt": "2026-01-01T00:00:00.000Z",
    },
  ],
  "programs": [
    {
      "id": 10,
      "name": "主推节目",
      "screenOrientation": "LANDSCAPE",
      "splitType": "SPLIT_2",
      "layoutConfig": {
        "regions": [
          { "regionId": "region1", "materials": [{ "materialId": 123, "duration": 10 }] },
        ],
      },
      "status": 1,
    },
  ],
  "materials": [
    {
      "id": 123,
      "name": "主图.jpg",
      "type": "IMAGE",
      "fileUrl": "/uploads/materials/xxx.jpg",
      "fileSize": "1048576",
      "fileExtension": "jpg",
      "width": 1920,
      "height": 1080,
      "duration": null,
      "thumbnailUrl": null,
    },
  ],
}
```

### 3.3 `POST /device/heartbeat` — 设备心跳

需设备 token。V1 仅更新 `Device.lastActiveAt` 与 `ipAddress`（`@Ip()`）；`metrics/currentProgramId/regionStates` 仅做 DTO 校验**不落库**。

**请求** `HeartbeatReq`：

```jsonc
{
  "status": "playing",
  "currentProgramId": 10,
  "regionStates": [
    /* 结构由客户端定义 */
  ],
  "metrics": { "cpu": 35, "mem": 60, "disk": 70, "net": "online" },
}
```

**响应**：`{}`（空对象，统一信封 `data` 为 `{}`）。

### 3.4 `POST /device/logs` — 设备日志批量上报

需设备 token。离线缓冲的日志/事件批量上报，返回 `acceptedIds` 供端侧删除本地缓冲。

**请求** `LogBatchReq`（至少 1 条）：

```jsonc
{
  "entries": [
    {
      "type": "play",
      "payload": { "materialId": 123 },
      "severity": "INFO",
      "clientLogId": "log-1719360000000-1",
    },
  ],
}
```

**响应** `LogBatchRes`：

```jsonc
{ "acceptedIds": ["log-1719360000000-1", "42"] }
```

> `acceptedIds` 与 `entries` 顺序对应：有 `clientLogId` 回传 `clientLogId`，无则回传自增 id（BigInt 转字符串）。

### 3.5 `POST /device/screenshot` — 设备截图上传

需设备 token。`multipart/form-data`，字段名 `file`。存储到 `uploads/screenshots/<deviceId>_<timestamp>.jpg`。

**响应** `ScreenshotRes`：

```jsonc
{ "url": "/uploads/screenshots/1_1719360000000.jpg" }
```

### 3.6 `POST /device/commands/:id/ack` — 远程指令回执

需设备 token。`result='success'` → `DeviceCommand.status=2`（成功），其他值 → `status=3`（失败）；ack 结果合并写入 `payload.ack`。仅允许 ack 本设备指令。

**请求** `AckReq`：

```jsonc
{ "result": "success", "error": null, "screenshotUrl": "/uploads/screenshots/1_xxx.jpg" }
```

**响应**：`{}`。

### 3.7 `GET /device/program` — 获取当前播放节目（既有，公开）

公开接口。设备根据自身编码获取当前时间应播放的节目配置；设备禁用/未绑定门店/无匹配计划时返回 `null`。

**Query**：`?deviceCode=DEVICE001`。

**响应**：单个 Program（**展开形式**，详见 §4.1）或 `null`。

> 此接口返回原始 Program 对象 spread，可能含管理域字段（`createdBy/publishedAt/createdAt/updatedAt` 等），设备端**不应依赖**这些字段。播放所需字段见 §4.1。如需干净形式用 `/device/sync`。

---

## 4. layoutConfig 两种形式（务必区分）

> **关键**：`/device/program` 与 `/device/sync` 的 `layoutConfig` 结构**不同**。安卓端实现时切勿混淆。

### 4.1 `/device/program` — 展开形式（Expanded）

每个素材项内嵌完整 Material 对象（`material` 字段），region 层注入 `bounds`。

```jsonc
{
  "id": 10,
  "name": "主推节目",
  "screenOrientation": "LANDSCAPE",
  "splitType": "SPLIT_2",
  "status": 1,
  "layoutConfig": {
    "regions": [
      {
        "regionId": "region1",
        "materials": [
          {
            "materialId": 123,
            "duration": 10, // 单位：秒
            "material": {
              // 后端展开的完整 Material 对象
              "id": 123,
              "name": "主图.jpg",
              "type": "IMAGE",
              "fileUrl": "/uploads/materials/xxx.jpg",
              "fileSize": "1048576", // BigInt → 字符串
              "fileExtension": "jpg",
              "width": 1920,
              "height": 1080,
              "duration": null,
              "thumbnailUrl": null,
              "auditStatus": "APPROVED",
            },
          },
        ],
        "bounds": {
          // region 层注入（applyForcedSplit）
          "regionId": "region1", // Task 0 已修复为按 region 索引取单个 bounds
          "x": 0,
          "y": 0,
          "width": 0.5,
          "height": 1, // 比例值 0~1
        },
      },
    ],
  },
}
```

- `duration`：**秒**（非毫秒）。图片/跑马灯按此值展示，视频按 `material.duration`（自身时长）播放。换算毫秒 `× 1000`。
- `material`：后端为每个素材项展开的完整对象，`fileUrl/type/fileSize/width/height/duration/fileExtension` 全部来自此子对象，**无需另行拉素材详情**。
- `bounds`：注入在 **region 层**（`region.bounds`），Task 0 已修复为按 region 索引取单个 `RegionBounds`。客户端**忽略**此字段，本地按 `(screenOrientation, splitType)` + region 索引计算（ADR-D，规避历史 B1 bug 且支持离线）。
- `transition`：**后端无此字段**。V1 客户端本地默认 `fade`，后端字段列后续。

### 4.2 `/device/sync` — normalized 形式（Normalized）

素材项**仅** `materialId` + `duration`，**不**展开 `material`，**无** `bounds`。素材元数据在顶层 `materials[]`，客户端按 `materialId` 关联。

```jsonc
{
  "version": "1719360000000",
  "plans": [
    /* PublishPlanDto[]，见 §3.2 */
  ],
  "programs": [
    {
      "id": 10,
      "name": "主推节目",
      "screenOrientation": "LANDSCAPE",
      "splitType": "SPLIT_2",
      "status": 1,
      "layoutConfig": {
        "regions": [
          {
            "regionId": "region1",
            "materials": [
              { "materialId": 123, "duration": 10 }, // 仅 materialId + duration，无 material、无 bounds
            ],
          },
        ],
      },
    },
  ],
  "materials": [
    /* MaterialDto[]，顶层独立，按 materialId 关联 */
  ],
}
```

- `ProgramDto` 裁掉管理域字段（`createdBy/publishedAt` 等）。
- 客户端按 `materialId` 关联顶层 `materials[]` 取 `fileUrl/fileSize/type/...`。
- `bounds` 客户端本地计算（同 §4.1，ADR-D）。

### 4.3 形式对照

| 维度                   | `/device/program`（展开）     | `/device/sync`（normalized） |
| ---------------------- | ----------------------------- | ---------------------------- |
| 用途                   | 单节目实时拉取（绑定前/兜底） | 全量同步 + 离线调度数据源    |
| 鉴权                   | 公开（`deviceCode` 入参）     | 设备 token                   |
| `materials[].material` | 完整对象展开                  | **无**（仅 `materialId`）    |
| `region.bounds`        | 注入（region 层，客户端忽略） | **无**                       |
| 顶层 `materials[]`     | 无                            | 有（按 `materialId` 关联）   |
| 版本/ETag              | 无                            | 有（`version` + 304）        |
| 管理域字段             | 可能存在（勿依赖）            | 裁掉                         |

---

## 5. Socket.io 实时通道

### 5.1 连接

| 项   | 值                                                                                  |
| ---- | ----------------------------------------------------------------------------------- |
| URL  | `http://<host>:3000`                                                                |
| Path | `/socket.io/`（独立于全局 `/api` 前缀）                                             |
| 鉴权 | 握手 `socket.handshake.auth.token = <deviceToken>`（或 `Authorization: Bearer` 头） |
| Room | `device.code`（连接成功后 `socket.join(deviceCode)`）                               |
| 重连 | 客户端指数退避 + 抖动（1s→…→60s 封顶）；重连成功立即强制一次 `SyncWorker`           |

**连接流程**：取 token → `DeviceTokenService.verify` → `type==='device'` → 查设备 `status=1` → `socket.join(code)` → 补发离线指令。任一环节失败 `socket.disconnect(true)`。

### 5.2 S→D 事件（Server → Device）

| 事件                     | 载荷                   | 说明                                                                                |
| ------------------------ | ---------------------- | ----------------------------------------------------------------------------------- |
| `ad:update`              | `{ version }`          | 广告内容更新通知，触发 `SyncWorker`。不入指令队列，离线设备重连后由 SyncWorker 兜底 |
| `command:screenshot`     | `{ id }`               | 截图 → 上传 → ack 带 `screenshotUrl`                                                |
| `command:volume`         | `{ id, level }`        | 调媒体音量 + ack                                                                    |
| `command:brightness`     | `{ id, level }`        | `Window.screenBrightness`（0~1）+ ack                                               |
| `command:stop`           | `{ id }`               | 停止播放 + ack                                                                      |
| `command:resume`         | `{ id }`               | 恢复播放 + ack                                                                      |
| `command:reload`         | `{ id }`               | 强制全量同步 + 重建播放 + ack                                                       |
| `command:clear_cache`    | `{ id }`               | 清素材缓存（保留当前）+ ack                                                         |
| `command:fetch_logs`     | `{ id, level, lines }` | 拉取日志回传 + ack                                                                  |
| `command:restart_app`    | `{ id }`               | 软重启 App 进程 + ack                                                               |
| `command:update_config`  | `{ id, config }`       | 更新本地配置 + ack                                                                  |
| `command:switch_program` | `{ id, programId }`    | 强制切指定节目 + ack                                                                |

> `id` 为指令 UUID，供 ack 闭环。`command:*` 事件经 `CommandDispatchService.dispatch` 下发：在线设备立即 emit 并置 `status=1`，离线设备入 `DeviceCommand` 队列（`status=0`）待上线补发。

**后端拒绝下发**（spec D1，普通盒子无系统签名不可行）：`command:restart_device`、`command:power_schedule` → `COMMAND_UNSUPPORTED`。客户端无需处理；降级能力为 `command:restart_app`（软重启）。

### 5.3 D→S 事件（Device → Server）

| 事件               | 载荷                                                     | 说明                                                                                                                                             |
| ------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `device:ack`       | `{ id, result, error?, screenshotUrl? }`                 | 指令回执。网关 `@SubscribeMessage('device:ack')` 处理，复用 `DeviceApiService.ackCommand` 闭环状态。与 HTTP `POST /device/commands/:id/ack` 等价 |
| `device:heartbeat` | `{ status, currentProgramId?, regionStates?, metrics? }` | **文档保留**。V1 主路径为 HTTP `POST /device/heartbeat`，网关无对应 `@SubscribeMessage` 处理器                                                   |

### 5.4 离线指令队列（DeviceCommand）

| status | 含义                           |
| ------ | ------------------------------ |
| 0      | 待下发（离线设备入队）         |
| 1      | 已下发（emit 成功 / 上线补发） |
| 2      | 已 ack 成功                    |
| 3      | 失败（ack 非 `success`）       |
| 4      | 过期                           |

- 离线设备指令入队（`status=0`）；设备上线（`handleConnection`）补发未过期指令并置 `status=1`。
- `ad:update` 不入队（通知事件，离线设备重连后 SyncWorker 兜底全量同步）。
- `GET /device/commands/pending` 离线补偿拉取接口为 P1，V1 未暴露（网关上线补发已覆盖）。

### 5.5 与后端文档既有事件的映射

`docs/api/README.md` 既有 4 个事件，设备端消费关系如下：

| 既有事件           | 方向     | 设备端处理                                 |
| ------------------ | -------- | ------------------------------------------ |
| `ad:update`        | S→D      | **保留**，作节目变更通知（§5.2）           |
| `device:heartbeat` | D→S      | **保留**（文档保留，HTTP 为主，§5.3）      |
| `device:status`    | S→Client | 设备端**不消费**（语义不明，面向管理后台） |
| `publish:progress` | S→Client | 设备端**不消费**（发布进度，面向管理后台） |

本轮新增：`command:*`（11 类）+ `device:ack`。

---

## 6. 字段对照基准

`types.ts` 与后端实现的对应关系：

| 契约类型（本目录）                                | 后端实现                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| `BindReq/BindRes/DeviceConfigDto/HardwareInfoDto` | `dto/bind.dto.ts`                                                        |
| `SyncDto/PublishPlanDto/ProgramDto/MaterialDto`   | `dto/sync.dto.ts`                                                        |
| `HeartbeatReq/HeartbeatMetricsDto`                | `dto/heartbeat.dto.ts`                                                   |
| `LogBatchReq/LogBatchRes/LogEntryDto`             | `dto/log.dto.ts`                                                         |
| `ScreenshotRes`                                   | `dto/screenshot.dto.ts`                                                  |
| `AckReq`                                          | `dto/command-ack.dto.ts`                                                 |
| `CommandDto/CommandStatus`                        | `prisma/schema.prisma` `DeviceCommand`                                   |
| `DeviceTokenPayload/DeviceIdentity`               | `auth/device-token.service.ts`、`decorators/current-device.decorator.ts` |
| Socket 事件载荷                                   | `gateway/device.gateway.ts`、`service/command-dispatch.service.ts`       |

> 本目录无 `package.json`/`tsconfig`，不参与构建。`types.ts` 为可 diff 的字段权威来源，安卓端移植为 Kotlin data class，后端 DTO 与之对照。后续若接入构建（生成 OpenAPI / TS client），可在 `packages/api-contracts` 增加 `package.json` + `tsconfig.json`。
