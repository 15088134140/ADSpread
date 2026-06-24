# API 文档

> 本目录包含 ADSpread 系统的 API 接口文档。

## 文档资源

| 文档 | 说明 | 访问方式 |
|------|------|----------|
| Swagger UI | REST API 交互式文档 | 运行后端后访问: `/api/docs` |
| OpenAPI JSON | OpenAPI 3.0 规范 | 运行后端后访问: `/api/docs-json` |
| Socket.io | 实时推送接口 | 详见下文 |

---

## REST API 概览

### 基础信息

- **Base URL**: `http://localhost:3000/api`
- **认证方式**: JWT Bearer Token
- **数据格式**: JSON

### API 模块

| 模块 | 前缀 | 说明 |
|------|------|------|
| 认证 | `/auth` | 登录、刷新令牌、登出 |
| 门店 | `/stores` | 门店 CRUD、行业分类 |
| 设备 | `/devices` | 设备 CRUD、状态监控 |
| 素材 | `/materials` | 素材上传、审核、管理 |
| 节目 | `/programs` | 节目编排、分屏配置 |
| 发布 | `/publish` | 发布计划、批量推送 |
| 系统 | `/system` | 管理员、角色、菜单、日志 |

### 统一响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": {},
  "timestamp": "2026-06-24T00:00:00.000Z"
}
```

### 分页响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [],
    "total": 100,
    "page": 1,
    "pageSize": 20
  },
  "timestamp": "2026-06-24T00:00:00.000Z"
}
```

### 错误响应格式

```json
{
  "code": 400,
  "message": "错误信息",
  "timestamp": "2026-06-24T00:00:00.000Z",
  "path": "/api/stores",
  "method": "POST",
  "details": {}
}
```

---

## Socket.io 实时推送

### 连接信息

- **URL**: `http://localhost:3000`
- **Path**: `/socket.io/`
- **认证**: 握手时携带 `Authorization: Bearer <token>`

### 事件列表

| 事件 | 方向 | 说明 |
|------|------|------|
| `device:status` | Server → Client | 设备状态变更推送 |
| `publish:progress` | Server → Client | 发布进度通知 |
| `ad:update` | Server → Device | 广告内容更新指令 |
| `device:heartbeat` | Device → Server | 设备心跳上报 |

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

*本页面为 API 文档索引，具体接口请启动后端后查看 Swagger 交互式文档。*
