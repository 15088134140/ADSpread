# 任务：信发系统 第二阶段（RBAC + 操作日志 + 多语言 + Excel 导入）

## 背景

第一阶段 MVP（登录、门店、设备、素材审核、节目、发布、设备拉取接口）已完成并通过验证（见 `docs/superpowers/reviews/2026-06-25-adspread-admin-backend-mvp-verification.md`）。MVP 设计规格 §3.2 明确将以下 v1.x 功能推迟到后续阶段：完整 RBAC、动态菜单权限过滤、完整多语言切换、完整操作日志与全链路审计、Excel 批量导入设备。

本阶段落实上述功能，使管理后台达到 PRD/技术设计文档描述的完整 v1.x 形态。

## 目标

在第一阶段 MVP 基础上补齐 PRD v1.x 的管理端与服务端功能：

- RBAC：管理员账号、角色管理、菜单管理 CRUD + 动态菜单 + 全量接口权限校验（严格兜底）。
- 操作日志全链路审计：全局拦截器 + 装饰器自动记录写操作，登录/登出显式落库。
- 完整多语言：日/中/英三语，默认日语（遵 PRD §4.12），切换并记忆。
- Excel 批量导入设备：逐行校验、失败行收集、模板下载。

## 范围

### 纳入本阶段

- 共享类型对齐（`packages/types`）：行业分类枚举修正（`HOTEL→HOSPITALITY`、`LIFE_SERVICE→LOCAL_LIFE`），新增 `MenuType`/`Admin`/`Role`/`Menu`/`OperationLog`/`ImportResult` 类型。
- 后端 RBAC：常量、装饰器（`@Public`/`@AuthenticatedOnly`/`@RequirePermission`/`@OperationLog`）、全局 `PermissionGuard`（严格兜底）、`OperationLogInterceptor`。
- 后端系统管理模块：admin/role/menu/log 的 controller/service/dto + 单元测试 + 集成测试。
- 后端认证扩展：`/api/auth/me`、`/api/auth/menus`、`/api/auth/logout`、`/api/auth/change-password`，登录/登出写日志。
- 后端既有业务控制器（store/device/material/program/publish）补 `@RequirePermission` + `@OperationLog`。
- 后端 Excel 导入：`POST /api/devices/import`、`GET /api/devices/import-template`。
- 后端 seed 扩展：39 菜单 + 2 角色 + 2 账号，幂等。
- 前端 i18n：日/中/英分模块翻译文件，默认日语，Element Plus locale 联动。
- 前端权限 store + 动态菜单 + 路由守卫（静态路由注册 + 守卫拦截 + 侧边栏动态渲染）。
- 前端系统管理页面（AdminList/RoleList/MenuList/OperationLogList）+ ExcelImportDialog 组件。
- 前端既有页面 i18n 迁移（无硬编码中文）。
- 文档同步：技术设计文档、API README、验证记录。

### 非范围（不在本阶段）

- Android 客户端（任何形态）。
- 真实 Socket.io 设备长连接、ack、失败重试队列。
- 设备心跳上报接口（`POST /api/device/heartbeat`）。
- 后端错误消息的多语言国际化（业务错误码已统一；错误消息暂保持中文，列为后续增强）。
- 前端组件级动态加载（路由仍静态注册，仅侧边栏菜单按权限动态渲染）。
- v2.x 后续规划：统计报表、素材标签、节目优先级、时段轮播、APK 升级。

## 相关文件

### 设计与计划

- 设计规格：`docs/superpowers/specs/2026-06-26-adspread-phase2-rbac-audit-i18n-excel-design.md`
- 实施计划：`docs/superpowers/plans/2026-06-26-adspread-phase2-rbac-audit-i18n-excel.md`
- 验证记录：`docs/superpowers/reviews/2026-06-26-adspread-phase2-verification.md`

### 后端

- 共享类型：`packages/types/src/index.ts`
- RBAC 基础设施：`apps/backend/src/common/{constants,decorators,guards,interceptors}/`
- 系统管理模块：`apps/backend/src/modules/system/{admin,role,menu,log}/`
- 认证扩展：`apps/backend/src/modules/auth/{auth.controller,auth.service,auth.module}.ts`
- 设备导入：`apps/backend/src/modules/device/{device.controller,device.service}.ts`、`dto/import-device.dto.ts`
- 既有控制器改造：`apps/backend/src/modules/{store,material,program,publish,device-api}/*.controller.ts`
- seed：`apps/backend/prisma/seed.ts`
- 全局注册：`apps/backend/src/app.module.ts`、`src/test/test-app.ts`

### 前端

- i18n：`apps/admin/src/locales/{index.ts,ja/,zh-CN/,en/}`
- 权限与语言 store：`apps/admin/src/stores/{permission,app}.ts`
- API 层：`apps/admin/src/api/{admin,role,menu,operationLog,auth,device}.ts`
- 系统管理页面：`apps/admin/src/views/system/{AdminList,RoleList,MenuList,OperationLogList}.vue`
- Excel 导入组件：`apps/admin/src/components/business/ExcelImportDialog.vue`
- 既有页面 i18n 迁移：`apps/admin/src/views/{auth/Login,Dashboard,store/StoreList,device/DeviceList,material/MaterialList,program/ProgramList,publish/PublishList}.vue`
- 布局与路由：`apps/admin/src/{layouts/MainLayout.vue,router/index.ts,App.vue,main.ts,utils/request.ts}`

### 文档（本 Task 14 修订/创建）

- `docs/architecture/信发系统_技术设计文档.md`（修订）
- `docs/api/README.md`（修订）
- `docs/superpowers/reviews/2026-06-26-adspread-phase2-verification.md`（新建）
- `tasks/in-progress/2026-06-26-adspread-phase2-rbac-audit-i18n-excel.md`（本文件）

## 验收标准

- [x] 后端 `nest build` 通过
- [x] 后端 `jest --runInBand` 全部通过（22 套件 / 137 用例）
- [x] 前端 `vue-tsc && vite build` 通过
- [x] `PermissionGuard` 严格兜底生效：未声明标记的受保护接口 403
- [x] specs §4.4.2 接口↔权限码映射全部落地，无漏挂
- [x] 超级管理员放行；operator 按授权范围访问，删除/系统管理被拒
- [x] 操作日志覆盖登录/登出/CRUD/审核/推送/导入
- [x] Excel 导入逐行收集失败、模板可下载
- [x] 默认日语，三语切换并记忆，Element Plus locale 联动
- [x] 既有页面无硬编码中文
- [x] seed 幂等：39 菜单 + 2 角色 + 2 账号
- [x] 技术设计文档与实现一致
- [x] 验证记录真实可查，如实标注未验证项与已知偏差

## 验证方式

### 自动化

- `pnpm --filter @adspread/backend run build`
- `npx jest --runInBand`（在 `apps/backend`）
- `pnpm --filter @adspread/admin run build`
- `prisma db seed`

### 验证结果摘要

| 命令       | 结果 | 备注                            |
| ---------- | ---- | ------------------------------- |
| 后端 build | PASS | exit 0                          |
| 后端 test  | PASS | 22 套件 / 137 用例全绿，~45s    |
| 前端 build | PASS | 13.38s，1765 模块               |
| seed       | PASS | 39 菜单 + 2 角色 + 2 账号，幂等 |

### 手工验收（已完成）

人工核查已通过：

- 登录与动态菜单渲染（admin 全菜单、operator 过滤后菜单）✓
- operator 权限隔离：系统管理接口 403、删除接口 403、列表接口 200 ✓
- 菜单文案 i18n 正常显示（修复 name→slug 映射）✓
- 业务列表 ID 列展示（门店/设备/素材/节目/发布）✓
- 三语切换、Element Plus locale 联动 ✓

详见验证记录"手工验收清单"节。

## 实施 commit 列表

| commit    | 说明                                                                    |
| --------- | ----------------------------------------------------------------------- |
| `1d26d89` | feat(shared): align industry category enum and add rbac types           |
| `adf92f6` | feat(backend): add rbac constants and decorators                        |
| `d2d7329` | feat(backend): add permission guard and operation log interceptor       |
| `0d6f0c8` | feat(backend): add system management modules (admin/role/menu/log)      |
| `877a56c` | feat(backend): expand seed with menus, operator role and account        |
| `78a83fa` | feat(backend): extend auth and annotate controllers with permissions    |
| `7db4827` | feat(backend): add excel device import                                  |
| `a6a9fd2` | feat(admin): add i18n with ja/zh-CN/en                                  |
| `e2c54ca` | feat(admin): add permission store and dynamic menu                      |
| `f22d9da` | feat(admin): add system pages and excel import dialog                   |
| `ba72056` | feat(admin): migrate existing pages to i18n                             |
| `8331812` | fix(backend): order cleanDatabase by fk deps and clear menu self-ref    |
| `ed342c2` | docs(architecture): sync phase2 design docs and add verification record |
| `9032e82` | fix(admin): map backend menu name to i18n slug in sidebar               |
| `50505e3` | feat(admin): show store id column for device import reference           |
| `5183101` | feat(admin): show id column on business list pages                      |

## 备注

### 实施状态

**已完成并人工验收**。所有 14 个 Task（Task 1–14）均按实施计划执行完毕，后端与前端构建通过，后端全量测试通过，seed 验证通过，人工核查通过。分支已合并至 main。

### 已知偏差与遗留

1. HTTP method 与 §4.4.2 映射表差异（material approve/reject、program publish、publish status 实现为 PUT，权限码一致）——已在技术设计文档 §5.3.10、API README 注明。
2. `device-api.storeId` 为 null 时返回 null（HTTP 200）——已知留意项，未修复。
3. 后端错误消息未国际化——设计规格 §1.1 明确列为后续增强。
4. 前端动态菜单 vs 静态路由——路由静态注册 + 守卫拦截，组件级动态加载列为后续增强。
5. Dashboard `recentLogs` mock 数据——待真实 API 接入替换。
6. `cleanDatabase` 当前未被 spec 调用——已修正为可用以备将来。
7. seed 幂等对已存在账号不重置密码——核查时发现 operator 账号因历史脏哈希无法登录，已直接重置 DB；根因是 seed upsert 对已存在记录不校正密码，后续若需环境可复现，应调整 seed 对示例账号每次重置密码（列为后续改进）。
8. 角色改名提权缺口——`RoleService.update` 已禁止超管角色自身改名，但未禁止把其它角色改名为"超级管理员"（等同提权）。建议后续在 update 中拒绝 `dto.name === SUPER_ADMIN_ROLE_NAME` 的非超管角色改名。

详见验证记录"已知问题与偏差"节。

### PRD 一致性

PRD v1.2 与第二阶段实现无冲突：

- §4.12 默认日语 ✓
- §7.1 角色"菜单权限ID列表"与 `Role.menuIds` 一致 ✓
- §9.2 超级管理员"自动拥有全部菜单权限，不需要勾选"与实现一致 ✓
- §4.7–4.10 管理员/操作日志/菜单/角色管理需求均落实 ✓
- §4.3 设备 Excel 导入 ✓
