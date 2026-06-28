# API Contracts

本目录用于存放跨应用共享的 API 契约说明、接口类型约定或生成物入口。

涉及接口变更时，应先同步更新本目录或 `docs/api/` 中对应文档，再修改具体实现。

## 目录索引

| 路径                                   | 说明                                                                                                                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`device/`](./device/README.md)        | **设备端 API 契约**（安卓展示端 ↔ 后端 `/api/device/*` + Socket.io）。含 bind/sync/heartbeat/logs/screenshot/commands ack 全部 DTO、layoutConfig 两种形式（展开 vs normalized）、Socket.io 事件集与鉴权约定 |
| [`device/types.ts`](./device/types.ts) | 设备端 DTO 与 Socket 事件载荷的 TypeScript 类型定义（前后端字段单一来源，可 diff）                                                                                                                          |

设备端契约的权威字段来源为 `device/types.ts`，以后端 `apps/backend/src/modules/device-api/` 实现为准。REST 接口与 Socket.io 事件的可读文档见 `device/README.md` 与 `docs/api/README.md`「设备端接口」章节。
