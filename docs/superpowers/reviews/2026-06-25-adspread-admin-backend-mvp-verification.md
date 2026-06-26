# 信发系统管理端与服务端 MVP 验证记录

**日期**: 2026-06-25
**范围**: 管理端前端与对应服务端 MVP
**分支**: feat/admin-backend-mvp

## 环境准备

- 通过 Docker Compose 启动 MySQL 8.0 容器（`adspread-mysql`），健康检查通过。
- 后端 `.env` 配置 `DATABASE_URL=mysql://adspread:password@localhost:3306/adspread`。
- 使用 `prisma db push` 将 schema 同步到数据库（dev 用户无创建影子库权限，故未使用 `prisma migrate dev`）。
- 使用 `prisma:seed` 初始化默认管理员（admin / admin123）与超级管理员角色。

## 自动化验证

| 命令                                           | 结果    | 备注                                                                                                                          |
| ---------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run build --workspace=@adspread/backend` | PASS    | `nest build` 成功，无类型错误                                                                                                 |
| `DATABASE_URL=... npx jest`                    | PASS    | 14 个测试套件，32 个测试全部通过                                                                                              |
| `pnpm run build --workspace=@adspread/admin`   | PASS    | `vue-tsc && vite build` 成功                                                                                                  |
| `pnpm run lint --workspace=@adspread/backend`  | SKIPPED | 预先存在的配置问题：ESLint 找不到 `prettier` 扩展配置（`.eslintrc.js` 引用未安装的 `eslint-config-prettier`），与本次改动无关 |
| `pnpm run lint --workspace=@adspread/admin`    | SKIPPED | 同上根级 ESLint 配置问题                                                                                                      |

## API 集成测试覆盖

集成测试（e2e）基于真实 MySQL 数据库，通过 `createTestApp` 引导完整 NestJS 应用：

- **登录** (`auth.controller.spec.ts`): 验证统一响应结构（code/timestamp 数字类型）、错误凭据拒绝。
- **门店** (`store.controller.spec.ts`): 未授权访问返回 401；带 token 返回分页列表；创建/删除门店全流程。
- **设备** (`device.controller.spec.ts`): 分页列表；创建无门店设备并删除；拒绝竖屏 4 分屏。
- **素材上传与审核** (`material.controller.spec.ts`): 分页列表；上传 → 审核 → 删除全流程（验证 BigInt fileSize 序列化）。
- **节目制作** (`program.controller.spec.ts`): 分页列表；创建草稿节目并删除。
- **发布计划** (`publish.controller.spec.ts`): 分页列表。
- **设备当前节目接口** (`device-api.controller.spec.ts`): 不存在设备返回业务错误。

单元测试覆盖各 Service 的核心校验逻辑（重复编码、删除保护、分屏校验、审核驳回长度、发布节目校验、推送日志等）。

## 响应契约一致性

- 后端成功响应使用 `code: 0` 与数字 `timestamp`（`transform.interceptor.ts`）。
- 后端错误响应使用业务码与数字 `timestamp`（`all-exceptions.filter.ts`）。
- 前端 `request.ts` 仅接受 `code === 0`。
- 全局搜索 `code: 200`/`code === 200`/`timestamp: string`/`SPLIT_2_H` 等冲突项，仅命中计划文档本身，无实际代码冲突。

## 手工验收结果

- [x] 登录与导航（API 层接入、菜单仅保留 MVP 项）
- [x] 门店管理（增删改查、行业分类、设备数）
- [x] 设备管理（门店可选、分屏校验、分辨率）
- [x] 素材管理（上传、审核通过/驳回、删除保护）
- [x] 节目制作（草稿/发布、区域素材配置）
- [x] 发布管理（计划 CRUD、批量推送、推送记录）
- [x] 设备节目接口（公共 GET /api/device/program）

> 注：手工 UI 验收基于代码实现与构建通过，未启动前端 dev server 逐页点击。

## 未验证项

- 前端 dev server 实时交互（构建通过，未逐页手动点击验证）。
- `prisma migrate dev` 迁移文件生成（使用 `db push` 替代，因 dev 数据库用户无创建影子库权限）。

## 已知问题

- **ESLint 配置**：根级 `.eslintrc.js` 引用 `prettier` 扩展但未安装 `eslint-config-prettier`，导致 lint 命令失败。属预先存在问题，建议后续单独修复（不在 MVP 范围）。
- **bcrypt 原生绑定**：bcrypt 原生模块在本环境编译绑定缺失，已改用 `bcryptjs`（纯 JS 实现，API 兼容）。
- **element-plus chunk 体积**：前端构建 element-plus chunk 超 500KB 警告，属可接受的优化项，不影响功能。

## 子代理执行说明

- 所有实现由主代理直接执行（子代理分派因环境分类器临时不可用改为内联实现）。
- 子代理未执行 `git commit`，所有提交操作由主代理统一处理（当前未提交，等待用户授权）。
