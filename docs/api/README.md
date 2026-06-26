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

| 模块     | 前缀         | 说明                                                                                       |
| -------- | ------------ | ------------------------------------------------------------------------------------------ |
| 认证     | `/auth`      | 登录、登出、当前用户 `GET /me`、菜单树 `GET /menus`、修改密码 `POST /change-password`      |
| 门店     | `/stores`    | 门店 CRUD、行业分类、门店选项列表                                                          |
| 设备     | `/devices`   | 设备 CRUD、Excel 批量导入 `POST /import`、模板下载 `GET /import-template`、分辨率/分屏选项 |
| 素材     | `/materials` | 素材上传、审核（`PUT /:id/approve`、`PUT /:id/reject`）、删除、预览                        |
| 节目     | `/programs`  | 节目 CRUD、发布 `PUT /:id/publish`、分屏配置                                               |
| 发布     | `/publish`   | 发布计划 CRUD、启用/停用 `PUT /:id/status`、推送、批量推送                                 |
| 仪表盘   | `/dashboard` | 概览聚合 `GET /overview`（设备/素材/节目/发布/门店/待办/最近日志）                         |
| 系统管理 | `/admin`     | 管理员 `/admins`、角色 `/roles`、菜单 `/menus`、操作日志 `/logs`                           |
| 设备接口 | `/device`    | 设备拉取节目 `GET /program`（公开，无需登录）                                              |

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

## Socket.io 实时推送

### 连接信息

- **URL**: `http://localhost:3000`
- **Path**: `/socket.io/`
- **认证**: 握手时携带 `Authorization: Bearer <token>`

### 事件列表

| 事件               | 方向            | 说明             |
| ------------------ | --------------- | ---------------- |
| `device:status`    | Server → Client | 设备状态变更推送 |
| `publish:progress` | Server → Client | 发布进度通知     |
| `ad:update`        | Server → Device | 广告内容更新指令 |
| `device:heartbeat` | Device → Server | 设备心跳上报     |

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
