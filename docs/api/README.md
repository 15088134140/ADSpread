# API 文档

> 本目录包含 ADSpread 系统的 API 接口文档。

## 文档资源

| 文档         | 说明                | 访问方式                         |
| ------------ | ------------------- | -------------------------------- |
| Swagger UI   | REST API 交互式文档 | 运行后端后访问: `/api/docs`      |
| OpenAPI JSON | OpenAPI 3.0 规范    | 运行后端后访问: `/api/docs-json` |
| Socket.io    | 实时推送接口        | 详见下文                         |

---

## REST API 概览

### 基础信息

- **Base URL**: `http://localhost:3000/api`
- **认证方式**: JWT Bearer Token
- **数据格式**: JSON

### API 模块

| 模块     | 前缀         | 说明                                                                                                                                                                                                  |
| -------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 认证     | `/auth`      | 登录、登出、当前用户 `GET /me`、菜单树 `GET /menus`、修改密码 `POST /change-password`                                                                                                                 |
| 门店     | `/stores`    | 门店 CRUD、行业分类、门店选项列表                                                                                                                                                                     |
| 设备     | `/devices`   | 设备 CRUD、Excel 批量导入 `POST /import`、模板下载 `GET /import-template`、分辨率/分屏选项                                                                                                            |
| 素材     | `/materials` | 素材上传、审核（`PUT /:id/approve`、`PUT /:id/reject`）、删除、预览                                                                                                                                   |
| 节目     | `/programs`  | 节目 CRUD、发布 `PUT /:id/publish`、分屏配置                                                                                                                                                          |
| 发布     | `/publish`   | 发布计划 CRUD、启用/停用 `PUT /:id/status`、推送、批量推送                                                                                                                                            |
| 仪表盘   | `/dashboard` | 概览聚合 `GET /overview`（设备/素材/节目/发布/门店/待办/最近日志）                                                                                                                                    |
| 系统管理 | `/admin`     | 管理员 `/admins`、角色 `/roles`、菜单 `/menus`、操作日志 `/logs`                                                                                                                                      |
| 设备接口 | `/device`    | 设备绑定 `POST /bind`、全量同步 `GET /sync`、心跳 `POST /heartbeat`、日志 `POST /logs`、截图 `POST /screenshot`、指令回执 `POST /commands/:id/ack`、拉取节目 `GET /program`（详见下文「设备端接口」） |

### 接口权限与认证（第二阶段）

- **认证**：受保护接口需在 `Authorization` 头携带 `Bearer <token>`（JWT，24 小时有效）。
- **授权**：全局 `PermissionGuard` 采用严格兜底——受保护接口必须显式声明 `@RequirePermission('xxx:yyy')` 权限码、`@AuthenticatedOnly()`（仅需登录）或 `@Public()`（公开），否则一律 403。
- **权限码**：与菜单 `permission` 字段一致（如 `store:list`、`device:import`、`admin:create`、`role:assign`、`log:list`）。完整接口↔权限码映射见技术设计文档 §5.3.7/§5.3.8 与设计规格 `docs/superpowers/specs/2026-06-26-adspread-phase2-rbac-audit-i18n-excel-design.md` §4.4.2。
- **超级管理员**：名称约定 `超级管理员` 的角色自动放行所有接口。
- **多语言**：请求头携带 `Accept-Language: ja | zh-CN | en`（默认日语，遵 PRD §4.12）。后端业务错误消息（`BusinessException`）与通用 HTTP 兜底消息按 `Accept-Language` 返回日/中/英三语，不带该头时默认 `zh-CN`；class-validator 字段级校验消息仍为英文。
- **HTTP method 偏差**（实现保留 MVP 既有调用约定，权限码不变）：
  - `PUT /api/materials/:id/approve`、`PUT /api/materials/:id/reject`（映射表建议 POST，权限码 `material:audit`）
  - `PUT /api/programs/:id/publish`（映射表建议 POST，权限码 `program:publish`）
  - `PUT /api/publish/:id/status`（映射表建议 PATCH，权限码 `publish:update`）

### 统一响应格式

```json
{
  "code": 0,
  "message": "success",
  "data": {},
  "timestamp": 1716547200000
}
```

### 分页响应格式

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [],
    "total": 100,
    "page": 1,
    "pageSize": 20
  },
  "timestamp": 1716547200000
}
```

### 仪表盘概览

- **接口**: `GET /api/dashboard/overview`
- **权限**: `dashboard:view`
- **说明**: 聚合设备在线状态、素材审核状态、节目状态、发布计划状态、近 7 天推送统计、门店计数、运营待办与最近操作日志，供管理端仪表盘展示。`recentLogs` 按当前用户 `log:list` 权限裁剪——无权限时返回空数组。
- **响应 `data` 结构**:

```json
{
  "device": {
    "total": 156,
    "enabled": 150,
    "online": 148,
    "offline": 2,
    "unbound": 6,
    "onlineRate": 0.987
  },
  "material": {
    "pending": 3,
    "approved": 320,
    "rejected": 19
  },
  "program": {
    "draft": 12,
    "published": 8
  },
  "publish": {
    "active": 5,
    "inactive": 2,
    "recentPushTotal": 42,
    "recentPushSuccess": 40,
    "recentPushFail": 2,
    "pushSuccessRate": 0.952
  },
  "store": {
    "total": 24,
    "active": 22
  },
  "todo": {
    "pendingMaterial": 3,
    "pushFail": 2,
    "unboundDevice": 6
  },
  "recentLogs": [
    {
      "id": 1,
      "username": "admin",
      "operation": "创建门店",
      "status": 1,
      "durationMs": 120,
      "createdAt": "2026-06-26T03:00:00.000Z"
    }
  ]
}
```

字段说明：

- `device.onlineRate` = `online` / `enabled`，保留 3 位小数；`enabled=0` 时为 0
- `device.online` = `status=1` 且 `lastActiveAt` 在 5 分钟内
- `device.unbound` = `storeId` 为空（含禁用设备）
- `publish.pushSuccessRate` = 近 7 天成功数 / 总数，保留 3 位小数；`recentPushTotal=0` 时为 0
- `recentLogs[].durationMs` 对应 `OperationLog.time`（耗时 ms，仅本响应内重命名）
- `todo.pendingMaterial` / `todo.pushFail` / `todo.unboundDevice` 分别等于 `material.pending`、`publish.recentPushFail`、`device.unbound`

### 错误响应格式

```json
{
  "code": 40001,
  "message": "参数错误",
  "data": null,
  "timestamp": 1716547200000
}
```

> 后端成功响应 `code: 0`，业务错误返回非 0 业务码（400xx 参数 / 401xx 认证 / 403xx 权限 / 404xx 资源不存在 / 500xx 服务端错误）。`timestamp` 为毫秒级数字时间戳。前端 `utils/request.ts` 仅接受 `code === 0`。

**错误消息多语言**：错误响应 body 的 `message` 字段会随请求头 `Accept-Language`（`ja` / `zh-CN` / `en`）返回对应语言——`BusinessException` 业务错误消息与 `AllExceptionsFilter` 通用 HTTP 兜底消息（401/403/404/500）均已本地化；不带该头时默认 `zh-CN`。消息目录见 `apps/backend/src/common/i18n/error-messages.ts`。**class-validator 字段级校验消息仍为英文**（如 `name must be a string`），不在本地化范围。

---

## 设备端接口（/device）

> 面向安卓展示端。完整 DTO 与 Socket 事件载荷类型见 [`packages/api-contracts/device/`](../packages/api-contracts/device/README.md)（字段单一来源）。后端实现见 `apps/backend/src/modules/device-api/`。

### 鉴权与约定

设备端鉴权独立于管理后台 RBAC：设备接口以 `@Public()` 跳过全局 `JwtAuthGuard`，再用 `@UseGuards(DeviceGuard)` 显式鉴权。

**设备令牌（deviceToken）**：无状态 JWT，复用同一 `JWT_SECRET`，claims `{ type:'device', sub:deviceId, code:deviceCode }`，有效期 **90 天**。上行接口在 `Authorization: Bearer <deviceToken>` 头携带；Socket.io 握手通过 `socket.handshake.auth.token` 携带。token 不落库，V1 不支持主动吊销（解绑走设备 `status=0` 使 guard 拒绝）。

| 接口                            | 鉴权                                  |
| ------------------------------- | ------------------------------------- |
| `GET /device/program`           | 公开（`deviceCode` 入参，无需 token） |
| `POST /device/bind`             | 公开（绑定前调用，无需 token）        |
| `GET /device/sync`              | 设备 token                            |
| `POST /device/heartbeat`        | 设备 token                            |
| `POST /device/logs`             | 设备 token                            |
| `POST /device/screenshot`       | 设备 token                            |
| `POST /device/commands/:id/ack` | 设备 token                            |

**设备端错误码**：

| 错误码（messageKey）           | 业务码 `code` | HTTP | 说明                                                             |
| ------------------------------ | ------------- | ---- | ---------------------------------------------------------------- |
| `DEVICE_TOKEN_INVALID`         | 40102         | 401  | token 缺失/无效/过期/类型非 `device`                             |
| `DEVICE_DISABLED_OR_NOT_FOUND` | 40101         | 401  | 设备不存在或已禁用                                               |
| `DEVICE_NOT_FOUND`             | 40004         | 400  | `bind` 时 code 不存在                                            |
| `COMMAND_NOT_FOUND`            | 40004         | 400  | ack 的指令不存在或不属于本设备                                   |
| `COMMAND_UNSUPPORTED`          | 40004         | 400  | 下发 `command:restart_device`/`command:power_schedule`（不可行） |
| `FILE_NOT_UPLOADED`            | 40004         | 400  | 截图上传未携带 `file`                                            |

> device-api 模块的 NOT_FOUND 类错误用默认 `BusinessException` 构造，业务码为 `40004`（`BUSINESS_RULE_VIOLATION`）、HTTP 400，不返回 `40401/404`（与 auth/system 模块约定不同）。客户端按 `messageKey`/`message` 区分，不要按 404 判定。

**约定**：

- **BigInt**：`Material.fileSize`、`DeviceLog.id` 经全局 `BigInt.prototype.toJSON` patch 以**字符串**下发（如 `"1048576"`），客户端按 Long/String 解析。
- **ETag/304**：`GET /device/sync` 支持 `?etag=<version>`，命中返回 `304`（无 body + `ETag` header），否则 `200`（统一信封 + `ETag` header）。该路由用 `@Res()` 直接控制响应以保证 304 无 body，200 手动封装统一信封。
- **静态素材**：`/uploads/materials/...` 与 `/uploads/screenshots/...` **不在 `/api` 前缀下**，由 `express.static` 提供，支持 `Range` 断点续传，无需鉴权。

### POST /device/bind — 设备绑定

公开接口。凭设备编码完成绑定：校验 code 存在且启用 → 刷新硬件信息 → 签发设备令牌。允许重复绑定（重新签发 token + 刷新硬件信息）。

```jsonc
// 请求
{
  "code": "DEVICE001",
  "hardwareInfo": {
    "mac": "AA:BB:CC:DD:EE:FF",
    "androidId": "a1b2c3d4",
    "model": "RK3568",
    "resolution": "1920x1080",
    "androidVersion": "12",
    "appVersion": "1.0.0",
  },
}
// `ipAddress` 由后端从请求 @Ip() 取，不在 hardwareInfo 内
```

```jsonc
// 响应 data
{
  "deviceToken": "eyJhbGciOiJIUzI1NiIs...",
  "storeId": 1,
  "deviceConfig": {
    "screenOrientation": "LANDSCAPE",
    "splitType": "SPLIT_2",
    "screenResolution": "1920x1080",
  },
}
```

### GET /device/sync — 设备全量同步（ETag/304）

需设备 token。返回该设备门店相关的全部生效发布计划、已发布节目（含 `layoutConfig`）与 APPROVED 素材元数据。`version = max(相关记录 updatedAt 毫秒戳)` 字符串，作 ETag；无记录为 `'0'`；未绑定门店 `version='0'` 且三数组为空。

**Query**：`?etag=<上次返回的 version>`。

```jsonc
// 响应 data（normalized 形式，layoutConfig 不展开 material、无 bounds）
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
      "status": 1,
      "layoutConfig": {
        "regions": [
          { "regionId": "region1", "materials": [{ "materialId": 123, "duration": 10 }] },
        ],
      },
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

> 客户端按 `materialId` 关联顶层 `materials[]` 取素材元数据；`bounds` 客户端本地按 `(screenOrientation, splitType)` + region 索引计算（ADR-D，后端不下发）。

### POST /device/heartbeat — 设备心跳

需设备 token。V1 仅更新 `Device.lastActiveAt` 与 `ipAddress`；`metrics/currentProgramId/regionStates` 仅做 DTO 校验不落库。

```jsonc
// 请求
{
  "status": "playing",
  "currentProgramId": 10,
  "regionStates": [],
  "metrics": { "cpu": 35, "mem": 60, "disk": 70, "net": "online" },
}
// 响应 data：{}
```

### POST /device/logs — 设备日志批量上报

需设备 token。批量写入设备日志/事件，返回 `acceptedIds` 供端侧删除本地缓冲（与 `entries` 顺序对应：有 `clientLogId` 回传 `clientLogId`，无则回传自增 id 字符串）。

```jsonc
// 请求
{ "entries": [{ "type": "play", "payload": { "materialId": 123 },
    "severity": "INFO", "clientLogId": "log-1719360000000-1" }] }
// 响应 data
{ "acceptedIds": ["log-1719360000000-1"] }
```

### POST /device/screenshot — 设备截图上传

需设备 token。`multipart/form-data`，字段名 `file`，存储到 `uploads/screenshots/<deviceId>_<timestamp>.jpg`。

```jsonc
// 响应 data
{ "url": "/uploads/screenshots/1_1719360000000.jpg" }
```

### POST /device/commands/:id/ack — 远程指令回执

需设备 token。`result='success'` → 指令 `status=2`（成功），其他值 → `status=3`（失败）；ack 结果合并写入指令 `payload.ack`。仅允许 ack 本设备指令，不存在抛 `COMMAND_NOT_FOUND`。

```jsonc
// 请求
{ "result": "success", "screenshotUrl": "/uploads/screenshots/1_xxx.jpg" }
// 响应 data：{}
```

### GET /device/program — 获取当前播放节目（既有，公开）

公开接口。设备根据自身编码获取当前时间应播放的节目配置；设备禁用/未绑定门店/无匹配计划时返回 `null`。**Query**：`?deviceCode=DEVICE001`。

> 此接口返回**展开形式** `layoutConfig`：每个素材项内嵌完整 `material` 对象，region 层注入 `bounds`（客户端忽略，本地计算）。与 `/device/sync` 的 normalized 形式不同，切勿混淆——详见 [`packages/api-contracts/device/`](../packages/api-contracts/device/README.md) §4。此接口返回原始 Program 对象，可能含管理域字段，设备端不应依赖。

### layoutConfig 两种形式

| 维度                   | `/device/program`（展开） | `/device/sync`（normalized）         |
| ---------------------- | ------------------------- | ------------------------------------ |
| 鉴权                   | 公开（`deviceCode`）      | 设备 token                           |
| `materials[].material` | 完整对象展开              | **无**（仅 `materialId`+`duration`） |
| `region.bounds`        | 注入（客户端忽略）        | **无**                               |
| 顶层 `materials[]`     | 无                        | 有（按 `materialId` 关联）           |
| 版本/ETag              | 无                        | 有（`version` + 304）                |
| `duration` 单位        | 秒                        | 秒                                   |

### 设备端 Socket.io 事件

设备端 Socket.io 连接与事件详见下文「Socket.io 实时推送」章节的完整事件表。设备端要点：

- **连接**：URL `http://host:3000`，path `/socket.io/`，握手 `socket.handshake.auth.token = <deviceToken>`；校验通过后 `socket.join(deviceCode)`，失败 `disconnect`。
- **离线指令**：`command:*` 经 `CommandDispatchService` 下发，离线设备入 `DeviceCommand` 队列（`status=0`），上线补发（`status=1`），ack 后 `status=2/3`。`ad:update` 不入队（离线设备重连后 SyncWorker 兜底）。
- **拒绝下发**：`command:restart_device`、`command:power_schedule`（普通盒子无系统签名，不可行）→ `COMMAND_UNSUPPORTED`。
- **D→S**：`device:ack`（指令回执，与 HTTP ack 等价）、`device:heartbeat`（文档保留，V1 主路径为 HTTP）。

---

## Socket.io 实时推送

### 连接信息

- **URL**: `http://localhost:3000`
- **Path**: `/socket.io/`（独立于全局 `/api` 前缀）
- **认证**：握手时携带 token——管理后台用 `Authorization: Bearer <adminToken>`；设备端用 `socket.handshake.auth.token = <deviceToken>`（或 `Authorization: Bearer <deviceToken>` 头）。设备端校验通过后 `socket.join(deviceCode)`，按设备码 room 下发指令。

### 事件列表

> 设备端事件载荷类型见 [`packages/api-contracts/device/`](../packages/api-contracts/device/README.md) §5。

| 事件                     | 方向            | 消费方   | 说明                                                                      |
| ------------------------ | --------------- | -------- | ------------------------------------------------------------------------- |
| `device:status`          | Server → Client | 管理后台 | 设备状态变更推送（设备端不消费）                                          |
| `publish:progress`       | Server → Client | 管理后台 | 发布进度通知（设备端不消费）                                              |
| `ad:update`              | Server → Device | 设备端   | 广告内容更新通知，载荷 `{ version }`，触发设备全量同步。不入指令队列      |
| `command:screenshot`     | Server → Device | 设备端   | 截图指令，载荷 `{ id }`                                                   |
| `command:volume`         | Server → Device | 设备端   | 音量调节，载荷 `{ id, level }`                                            |
| `command:brightness`     | Server → Device | 设备端   | 亮度调节，载荷 `{ id, level }`（0~1）                                     |
| `command:stop`           | Server → Device | 设备端   | 停止播放，载荷 `{ id }`                                                   |
| `command:resume`         | Server → Device | 设备端   | 恢复播放，载荷 `{ id }`                                                   |
| `command:reload`         | Server → Device | 设备端   | 强制全量同步+重建播放，载荷 `{ id }`                                      |
| `command:clear_cache`    | Server → Device | 设备端   | 清素材缓存，载荷 `{ id }`                                                 |
| `command:fetch_logs`     | Server → Device | 设备端   | 拉取日志，载荷 `{ id, level, lines }`                                     |
| `command:restart_app`    | Server → Device | 设备端   | 软重启 App，载荷 `{ id }`                                                 |
| `command:update_config`  | Server → Device | 设备端   | 更新本地配置，载荷 `{ id, config }`                                       |
| `command:switch_program` | Server → Device | 设备端   | 强制切节目，载荷 `{ id, programId }`                                      |
| `device:heartbeat`       | Device → Server | 后端     | 设备心跳上报（文档保留，V1 主路径为 HTTP `POST /device/heartbeat`）       |
| `device:ack`             | Device → Server | 后端     | 指令回执，载荷 `{ id, result, error?, screenshotUrl? }`，与 HTTP ack 等价 |

> `command:*` 的 `id` 为指令 UUID，供 ack 闭环。后端拒绝下发 `command:restart_device`、`command:power_schedule`（普通盒子无系统签名，spec D1 不可行）→ `COMMAND_UNSUPPORTED`。离线设备指令入 `DeviceCommand` 队列，上线补发。

---

## 生成文档

### 本地启动查看 Swagger

```bash
# 启动后端服务
npm run dev:backend

# 访问文档
open http://localhost:3000/api/docs
```

### 导出 OpenAPI 规范

启动后端后访问：

```bash
# JSON 格式
curl http://localhost:3000/api/docs-json > openapi.json

# YAML 格式
curl http://localhost:3000/api/docs-yaml > openapi.yaml
```

---

_本页面为 API 文档索引，具体接口请启动后端后查看 Swagger 交互式文档。_
