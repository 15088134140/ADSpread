# 信发系统 第二阶段实施计划（RBAC + 操作日志 + 多语言 + Excel 导入）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在第一阶段 MVP 基础上补齐 PRD v1.x 的 RBAC（管理员/角色/菜单 + 动态菜单 + 全量接口权限校验）、操作日志全链路审计、完整多语言（日/中/英，默认日语）、Excel 批量导入设备。

**设计依据:** `docs/superpowers/specs/2026-06-26-adspread-phase2-rbac-audit-i18n-excel-design.md`

**Architecture:** 复用既有 NestJS + Prisma + Vue3 架构，不新增数据表。新增全局 `PermissionGuard`（严格兜底：未声明权限标记的受保护接口一律 403）、`OperationLogInterceptor`、系统管理模块、i18n 与权限 store。

**Tech Stack:** NestJS 10, Prisma 5, MySQL, JWT, bcryptjs, xlsx, Vue 3, TypeScript, Pinia, Vue Router, Element Plus, vue-i18n, Jest, supertest。

---

## 0. Required context before implementation

Read these files before starting Task 1:

- `docs/superpowers/specs/2026-06-26-adspread-phase2-rbac-audit-i18n-excel-design.md`（必读 §4.4 初始化数据、§5.2 权限守卫、§4.4.2 接口↔权限码映射）
- `docs/superpowers/specs/2026-06-25-adspread-admin-backend-mvp-design.md`（第一阶段范围）
- `docs/requirements/信发系统_产品需求文档.md`
- `docs/architecture/信发系统_技术设计文档.md`
- `.ai/workflow.md`、`.ai/tool-rules.md`、`.ai/coding-standards.md`、`.ai/backend-standards.md`、`.ai/admin-standards.md`

Important execution rules:

- 派遣子代理时，每个实现子代理 prompt 必须以 `⚠️ 重要规则：不要执行 git commit 命令！完成后只需要列出你修改/创建的所有文件路径，提交操作由父代理统一执行。` 结尾。
- 子代理不得 commit。父代理在审查与验证后统一提交。
- 当前分支 `feat/admin-backend-mvp`；如需隔离可在其上继续，或按用户指示新开分支。
- **严格兜底策略**：`PermissionGuard` 生效后，MVP 既有业务控制器若未补齐 `@RequirePermission` 将返回 403。Task 7 必须完成既有控制器改造，否则站点不可用。

---

## 1. File structure map

### Backend files to create

- `apps/backend/src/common/constants/rbac.constants.ts` — `SUPER_ADMIN_ROLE_NAME` 等常量、权限码元数据 key
- `apps/backend/src/common/decorators/public.decorator.ts` — `@Public()` 标记
- `apps/backend/src/common/decorators/authenticated-only.decorator.ts` — `@AuthenticatedOnly()` 标记
- `apps/backend/src/common/decorators/require-permission.decorator.ts` — `@RequirePermission(code)`
- `apps/backend/src/common/decorators/operation-log.decorator.ts` — `@OperationLog(operation, targetType?)`
- `apps/backend/src/common/guards/permission.guard.ts` — 全局权限守卫
- `apps/backend/src/common/interceptors/operation-log.interceptor.ts` — 操作日志拦截器
- `apps/backend/src/modules/system/system.module.ts`
- `apps/backend/src/modules/system/admin/` — controller、service、dto
- `apps/backend/src/modules/system/role/` — controller、service、dto
- `apps/backend/src/modules/system/menu/` — controller、service、dto
- `apps/backend/src/modules/system/log/` — operation-log.service、controller、dto
- `apps/backend/src/modules/system/**/*.spec.ts` — service 单测与集成测试
- `apps/backend/src/modules/device/dto/import-device.dto.ts` — 导入结果类型

### Backend files to modify

- `apps/backend/prisma/seed.ts` — 扩展菜单树、运营角色、operator 账号（见 specs §4.4）
- `apps/backend/src/app.module.ts` — 注册 SystemModule、全局 PermissionGuard、OperationLogInterceptor
- `apps/backend/src/modules/auth/auth.controller.ts` — 扩展 `/me` `/logout` `/menus` `/change-password`
- `apps/backend/src/modules/auth/auth.service.ts` — 扩展对应方法，登录/登出写日志
- `apps/backend/src/modules/auth/auth.module.ts` — 引入所需依赖
- `apps/backend/src/modules/device/device.controller.ts` — 扩展 `/import` `/import-template`，补 `@RequirePermission`
- `apps/backend/src/modules/device/device.service.ts` — 扩展 `batchImport`、`getImportTemplate`
- `apps/backend/src/modules/store/store.controller.ts` — 补 `@RequirePermission` + `@OperationLog`
- `apps/backend/src/modules/material/material.controller.ts` — 同上
- `apps/backend/src/modules/program/program.controller.ts` — 同上
- `apps/backend/src/modules/publish/publish.controller.ts` — 同上
- `apps/backend/src/modules/device-api/device-api.controller.ts` — 确认 `@Public` 标记
- `apps/backend/src/modules/prisma/prisma.service.ts` — 确认 `cleanDatabase` 顺序
- `apps/backend/src/test/test-app.ts` — 确认全局守卫/拦截器在测试 app 中生效

### Shared package to modify

- `packages/types/src/index.ts` — 修正 `IndustryCategory`，补 `MenuType`/`Admin`/`Role`/`Menu`/`OperationLog`/`ImportResult` 类型

### Frontend files to create

- `apps/admin/src/locales/index.ts` 及 `ja/`、`zh-CN/`、`en/` 分模块翻译文件（common/menu/store/device/material/program/publish/system/validation）
- `apps/admin/src/stores/app.ts` — locale 状态
- `apps/admin/src/stores/permission.ts` — 菜单树、权限码集合、`hasPermission`
- `apps/admin/src/api/admin.ts`、`role.ts`、`menu.ts`、`operationLog.ts`
- `apps/admin/src/views/system/AdminList.vue`、`RoleList.vue`、`MenuList.vue`、`OperationLogList.vue`
- `apps/admin/src/components/business/ExcelImportDialog.vue`
- `apps/admin/src/directives/permission.ts`（可选，`v-permission` 按钮指令）

### Frontend files to modify

- `apps/admin/src/main.ts` — 默认 `ja`、注入三语 messages、locale 联动
- `apps/admin/src/App.vue` — `ElConfigProvider` 包裹，绑定 `appStore.locale`
- `apps/admin/src/layouts/MainLayout.vue` — 侧边栏改由 permission store 递归渲染、Header 加语言切换器
- `apps/admin/src/router/index.ts` — 新增 system 路由，守卫加菜单权限校验
- `apps/admin/src/stores/user.ts` — 登录后拉取菜单；logout 清理 permission store
- `apps/admin/src/utils/request.ts` — 错误消息 i18n、`Accept-Language` 头
- `apps/admin/src/api/auth.ts` — 扩展 me/logout/menus/change-password
- `apps/admin/src/api/device.ts` — 扩展 import/importTemplate
- 既有页面 i18n 迁移：`views/auth/Login.vue`、`Dashboard.vue`、`store/StoreList.vue`、`device/DeviceList.vue`、`material/MaterialList.vue`、`program/ProgramList.vue`、`publish/PublishList.vue`

### Docs to modify/create

- `docs/architecture/信发系统_技术设计文档.md` — 角色菜单权限模型、操作日志字段、API 清单、默认语言
- `docs/requirements/信发系统_产品需求文档.md` — 仅若发现 MVP 范围冲突
- `docs/api/` — 同步接口契约（若存在）
- `docs/superpowers/reviews/2026-06-26-adspread-phase2-verification.md` — 验证记录
- `tasks/in-progress/` — 第二阶段任务文档

---

## 2. Implementation tasks

### Task 1: 共享类型对齐

**Files:** `packages/types/src/index.ts`

- [ ] **Step 1: 修正行业分类枚举。** `HOTEL → HOSPITALITY`、`LIFE_SERVICE → LOCAL_LIFE`，同步修正 `IndustryCategoryLabels` 及所有引用处，与 Prisma `schema.prisma` 保持一致。

- [ ] **Step 2: 新增/补全 RBAC 相关类型。** 新增 `MenuType` 枚举（`DIRECTORY=1`/`MENU=2`/`BUTTON=3`）、`Admin`、`Role`、`Menu`（含 `children?`）、`MenuTreeNode`、`OperationLog`、`ImportResult`。其中 `ImportResult` 结构为 `{ successCount: number; failCount: number; failures: Array<{ row: number; field?: string; reason: string }> }`。

- [ ] **Step 3: 验证构建与引用。** 构建 `@adspread/types`（或确认被 backend/admin 引用时不报错），grep `HOTEL`/`LIFE_SERVICE` 确认无残留引用断裂。

**Expected:** 共享类型与 Prisma 对齐；无 `HOTEL`/`LIFE_SERVICE` 残留。

---

### Task 2: 后端 RBAC 常量与装饰器

**Files:** `apps/backend/src/common/constants/rbac.constants.ts`、`apps/backend/src/common/decorators/public.decorator.ts`、`apps/backend/src/common/decorators/authenticated-only.decorator.ts`、`apps/backend/src/common/decorators/require-permission.decorator.ts`、`apps/backend/src/common/decorators/operation-log.decorator.ts`

- [ ] **Step 1: 创建 rbac 常量。** 定义 `SUPER_ADMIN_ROLE_NAME = '超级管理员'`，以及元数据 key：`PERMISSION_META_KEY`、`PUBLIC_META_KEY`、`AUTHENTICATED_ONLY_META_KEY`、`OPERATION_LOG_META_KEY`。

- [ ] **Step 2: 创建 `@Public()` 与 `@AuthenticatedOnly()`。** 均用 `SetMetadata` 设置对应 key 为 `true`。

- [ ] **Step 3: 创建 `@RequirePermission(code)`。** 用 `SetMetadata(PERMISSION_META_KEY, code)`。

- [ ] **Step 4: 创建 `@OperationLog(operation, targetType?)`。** 用 `SetMetadata(OPERATION_LOG_META_KEY, { operation, targetType })`。

**Expected:** 四个装饰器与常量就绪，无业务逻辑。

---

### Task 3: PermissionGuard

**Files:** `apps/backend/src/common/guards/permission.guard.ts`

- [ ] **Step 1: 实现决策逻辑（specs §5.2，按顺序短路）。** ① `Reflector` 读 `PUBLIC_META_KEY` 命中则放行；② `request.user` 不存在则抛 `BusinessException('未登录', UNAUTHORIZED, 401)`；③ 加载角色，角色名 === `SUPER_ADMIN_ROLE_NAME` 则放行；④ `Reflector` 读 `AUTHENTICATED_ONLY_META_KEY` 命中则放行；⑤ `Reflector` 读 `PERMISSION_META_KEY` 得 `code`，`code` 存在则计算权限码集合 `S` 比对，命中放行否则抛 403，`code` 不存在则抛 403（严格兜底）。

- [ ] **Step 2: 实现权限码集合 `S` 计算。** `menuIds = role.menuIds ?? []`，查 `prisma.menu.findMany({ where: { id: { in: menuIds }, status: 1 }, select: { permission: true } })`，`S = new Set(menus.map(m => m.permission).filter(Boolean))`。不递归子菜单（`menuIds` 已勾选到按钮级）。

- [ ] **Step 3: 注册为全局守卫。** 用 `APP_GUARD` provider 注册，注入 `Reflector` 与 `PrismaService`。全局守卫默认在控制器级 `JwtAuthGuard` 之后执行，顺序正确。

- [ ] **Step 4: 单元测试 `permission.guard.spec.ts`。** 覆盖六个分支：公开放行、未登录 401、超管放行、AuthenticatedOnly 放行、有权限码放行、无权限码 403、未声明标记 403。

**Expected:** 守卫逻辑完整，单测覆盖全部分支。

---

### Task 4: 操作日志拦截器与服务

**Files:** `apps/backend/src/modules/system/log/operation-log.service.ts`、`apps/backend/src/common/interceptors/operation-log.interceptor.ts`

- [ ] **Step 1: 实现 `OperationLogService`。** `create(data)` 写入 `operationLog` 表；`findAll(query)` 分页筛选（username、operation、时间范围），复用 `getPagination/paginated`。

- [ ] **Step 2: 实现 `OperationLogInterceptor`。** `Reflector` 读 `OPERATION_LOG_META_KEY` 未命中则直接放行不记录；命中则记录开始时间，响应后/异常后写日志。字段：`adminId`、`username`（取自 `request.user`）、`operation`、`method`、`params`（`request.body` + `request.params`，密码字段脱敏）、`time`（耗时 ms）、`ip`、`userAgent`、`status`（1 成功 / 0 失败）、`errorMsg`。异常时 `throwError` 透传原异常，不改变响应；用 `defer` 异步写入，不阻塞响应。

- [ ] **Step 3: 单元测试 `operation-log.interceptor.spec.ts`。** 成功写 `status=1`；异常写 `status=0` 且透传异常；密码字段脱敏。

**Expected:** 拦截器对声明 `@OperationLog` 的方法自动落库，异常透传不吞错。

---

### Task 5: Seed 扩展（菜单树、运营角色、operator 账号）

**Files:** `apps/backend/prisma/seed.ts`

- [ ] **Step 1: 按 specs §4.4.1 表格 seed 39 条菜单。** 三级建模：目录(type=1)、菜单(type=2)、按钮(type=3)。`parentId` 指向已创建记录，创建顺序先顶级 → 再二级 → 再按钮。`upsert` 幂等：菜单节点按 `path`、按钮/目录按 `name + parentId` 组合查找。

- [ ] **Step 2: seed 运营角色。** `name='运营人员'`，`menuIds` 取 specs §4.4.3 列出的菜单 ID：仪表盘 #1；门店 #2/#3/#4（不含删除 #5）；设备 #6/#7/#8/#10（不含删除 #9）；素材 #11/#12/#13（不含删除 #14）；节目 #15/#16/#17/#18（不含删除 #19）；发布 #20/#21/#22/#24（不含删除 #23）；不含系统管理 #25 及其全部子项。因 menu ID 在 seed 后才确定，需先创建全部菜单、收集对应 ID、再 upsert 角色。

- [ ] **Step 3: seed operator 账号。** `username='operator'`、`name='运营示例'`、`roleId` 绑定运营角色、密码 `operator123`（bcrypt 哈希）、`status=1`。沿用既有 `admin`/`admin123` 超管账号 seed。

- [ ] **Step 4: 运行 seed 验证。** `pnpm run prisma:generate --workspace=@adspread/backend`，`pnpm run prisma:seed --workspace=@adspread/backend`。若 DB 不可用则记录，但 seed 文件须语法正确。

**Expected:** seed 幂等可重复执行；菜单 39 条、角色 2 个、账号 2 个。

---

### Task 6: 系统管理模块（admin/role/menu/log）

**Files:** `apps/backend/src/modules/system/**`

- [ ] **Step 1: AdminService/Controller + DTO。** 路由与权限码见 specs §4.4.2：`GET /api/admin/admins`（`admin:list`，分页 + 按 username/name/status 筛选）；`POST`（`admin:create`，`@OperationLog('create','admin')`）；`PUT /:id`（`admin:update`，`@OperationLog('update','admin')`）；`DELETE /:id`（`admin:update`，`@OperationLog('delete','admin')`）；`POST /:id/reset-password`（`admin:reset-password`，`@OperationLog('reset-password','admin')`）。业务规则：用户名唯一；密码强度 ≥8 位含大小写字母与数字，bcrypt 哈希；不可改自己状态为禁用；不可删除自己。

- [ ] **Step 2: RoleService/Controller + DTO。** 路由：`GET /api/admin/roles` 与 `/options`（`role:list`）；`POST`（`role:create`）；`PUT /:id`（`role:update`）；`DELETE /:id`（`role:delete`）；`PUT /:id/menus`（`role:assign`，`@OperationLog('assign','role')`）。业务规则：名称唯一；有关联管理员不可删除；超管角色不可删除、不可改其 `menuIds`。

- [ ] **Step 3: MenuService/Controller + DTO。** 路由：`GET /api/admin/menus`、`/tree`、`/options`（`menu:list`，树形 `parentId` 自关联按 `sort` 排序）；`POST`（`menu:create`）；`PUT /:id`（`menu:update`）；`DELETE /:id`（`menu:delete`）。业务规则：有子菜单不可删除。各写操作加 `@OperationLog`。

- [ ] **Step 4: OperationLogController。** `GET /api/admin/logs`（`log:list`），复用 Task 4 的 `findAll`。

- [ ] **Step 5: 聚合 SystemModule。** 导入 PrismaModule，聚合 admin/role/menu/log 子模块。

- [ ] **Step 6: service 单元测试。** admin 用户名唯一、不可删自己；role 关联删除保护、超管保护；menu 有子菜单删除保护；log 分页筛选。

- [ ] **Step 7: 集成测试 `system.controller.spec.ts`。** 超管账号 CRUD 全通；operator 账号访问 `/api/admin/*` 返回 403。

**Expected:** 系统管理 CRUD 全通，权限隔离生效。

---

### Task 7: 认证扩展 + 既有控制器改造

**Files:** `auth/*`、`store/*`、`device/*`、`material/*`、`program/*`、`publish/*`、`device-api/*` controller、`app.module.ts`、`test-app.ts`

- [ ] **Step 1: AuthController 扩展。** `POST /api/auth/login` 补 `@Public`，登录成功后写 `login` 操作日志；`POST /api/auth/logout`（`@AuthenticatedOnly`）写 `logout` 日志；`GET /api/auth/me`（`@AuthenticatedOnly`）返回当前 admin + role；`GET /api/auth/menus`（`@AuthenticatedOnly`）返回当前用户可见菜单树（超管返回全部启用菜单，普通用户按 `role.menuIds` 过滤含按钮节点，复用 MenuService 树构建 + 权限过滤）；`POST /api/auth/change-password`（`@AuthenticatedOnly`）校验旧密码、设新密码（强度规则），`@OperationLog('change-password','admin')`。

- [ ] **Step 2: AuthService 扩展。** 新增 `me/logout/menus/change-password` 方法；登录/登出显式调 `OperationLogService.create`（拦截器覆盖不到非控制器逻辑）。

- [ ] **Step 3: 既有业务控制器补权限标记（按 specs §4.4.2 映射表）。** Store：list `store:list`，create `store:create`+log，update `store:update`+log，delete `store:delete`+log，`industry-categories`/`options` 用 `store:list`。Device：list `device:list`，create/update/delete + log，`import` `device:import`+log，`import-template` `device:import`，`resolutions`/`split-types` 用 `device:list`。Material：list/available `material:list`，upload `material:upload`+log，approve/reject `material:audit`+log，delete `material:delete`+log。Program：list `program:list`，create/update/delete + log，publish `program:publish`+log。Publish：list `publish:list`，create/update/delete + log，push/batch-push `publish:push`+log，status `publish:update`+log。DeviceApi：`GET /api/device/program` 补 `@Public`。

- [ ] **Step 4: 注册全局组件。** `app.module.ts` 注册 `SystemModule`，`APP_GUARD` = `PermissionGuard`，`APP_INTERCEPTOR` = `OperationLogInterceptor`。

- [ ] **Step 5: 同步测试 app。** `test-app.ts` 注册全局守卫与拦截器，保持与 main.ts 一致。

- [ ] **Step 6: 集成测试。** admin token 各业务接口正常；operator token 调删除接口 403；未带 token 401；`/api/device/program` 无 token 可访问。

**Expected:** 全量接口权限生效；admin 全通；operator 按授权范围访问；公开接口可匿名访问。

---

### Task 8: Excel 批量导入设备

**Files:** `apps/backend/src/modules/device/device.service.ts`、`device.controller.ts`、`dto/import-device.dto.ts`

- [ ] **Step 1: `DeviceService.batchImport(file)`。** `xlsx.read(file.buffer)` 解析，取第一个 sheet 转 JSON 行。表头映射：设备名称→name、设备编码→code、屏幕方向→screenOrientation、分辨率→screenResolution、分屏类型→splitType、所属门店ID→storeId、备注→remark。逐行校验：必填项、`validateSplitType`、`assertStoreExists`、设备编码唯一（DB + 当批去重）。合法行事务批量 `device.createMany`，非法行收集 `{ row, field?, reason }`，返回 `{ successCount, failCount, failures }`。

- [ ] **Step 2: `DeviceService.getImportTemplate()`。** `xlsx.utils.book_new` + `aoa_to_sheet` 生成含表头与示例行的 sheet，可选第二 sheet 写校验说明，`xlsx.write` 返回 Buffer。

- [ ] **Step 3: Controller 路由。** `POST /api/devices/import`（`@RequirePermission('device:import')` + `@OperationLog('batch-import','device')` + `@UseInterceptors(FileInterceptor('file'))`）；`GET /api/devices/import-template`（`@RequirePermission('device:import')`，`res.set` 设置 Content-Type / Content-Disposition，返回 Buffer）。

- [ ] **Step 4: 单元测试 `device.service.spec.ts`。** 合法行导入成功；非法行收集失败；当批重复编码去重；splitType 不匹配失败。用真实 xlsx buffer 构造测试数据。

- [ ] **Step 5: 集成测试。** admin 上传合法 xlsx 返回 successCount；上传含错误行返回 failures；operator 无 `device:import` 权限 403。

**Expected:** 导入逐行收集失败、模板可下载、权限隔离生效。

---

### Task 9: 后端测试收口与构建

**Files:** `apps/backend/src/modules/**/*.spec.ts`

- [ ] **Step 1: 确认 `cleanDatabase` 顺序。** 按外键依赖：`operationLog` → `pushMessageLog` → `publishPlan` → `program` → `material` → `device` → `store` → `admin` → `role` → `menu`。

- [ ] **Step 2: 集成测试覆盖 specs §8.3 清单。** admin/role/menu/log CRUD；`/api/auth/menus` 权限过滤；`/api/devices/import`；权限拒绝 403；公开接口放行。

- [ ] **Step 3: 运行构建与测试。** `pnpm run build --workspace=@adspread/backend`，`pnpm run test --workspace=@adspread/backend -- --runInBand`，修复失败。

**Expected:** 后端构建与全量测试通过。

---

### Task 10: 前端 i18n 落地

**Files:** `apps/admin/src/locales/**`、`main.ts`、`App.vue`、`stores/app.ts`

- [ ] **Step 1: 创建分模块翻译文件。** ja、zh-CN、en 各一套，模块：common、menu、store、device、material、program、publish、system、validation。菜单 key 与 specs §4.4.1 菜单 name 对应（如 `menu.dashboard`、`menu.store`、`menu.system.admin`）。

- [ ] **Step 2: `locales/index.ts` 聚合并导出 `createI18n` 配置。**

- [ ] **Step 3: `main.ts` 配置。** `locale: localStorage.getItem('locale') || 'ja'`，`fallbackLocale: 'ja'`，注入 messages。

- [ ] **Step 4: `stores/app.ts`。** `locale` ref，`setLocale(l)` 写 localStorage 并更新 `i18n.global.locale`。

- [ ] **Step 5: `App.vue`。** 用 `ElConfigProvider` 包裹根，`:locale` 绑定 Element Plus locale（ja/zh-CN/en 映射）。

- [ ] **Step 6: 构建验证。** `pnpm run build --workspace=@adspread/admin`，修复类型错误。

**Expected:** 三语翻译就绪，默认日语，Element Plus locale 联动。

---

### Task 11: 权限 store + 动态菜单 + 路由守卫

**Files:** `apps/admin/src/stores/permission.ts`、`stores/user.ts`、`layouts/MainLayout.vue`、`router/index.ts`、`utils/request.ts`

- [ ] **Step 1: `stores/permission.ts`。** 状态 `menuTree`、`permissions: Set<string>`；方法 `fetchMenus()`（调 `GET /api/auth/menus`，扁平化取所有节点 `permission` 填集合）、`hasPermission(code)`（判断按钮显隐）、`reset()`（登出时清空）。

- [ ] **Step 2: `stores/user.ts`。** 登录成功后调 `permissionStore.fetchMenus()`；`logout` 调 `permissionStore.reset()`。

- [ ] **Step 3: `MainLayout.vue` 侧边栏递归渲染。** 由 `menuTree` 递归渲染：type=1 → `el-sub-menu`，type=2 → `el-menu-item`（`index` = `path`），type=3 不渲染（按钮级用 `hasPermission`）。图标按 `icon` 字段动态映射 Element Plus 图标组件。

- [ ] **Step 4: Header 加语言切换器。** `el-select` 三选项（日/中/英），绑 `appStore.locale`。

- [ ] **Step 5: `router/index.ts` 路由与守卫。** 新增 system 路由：`/system/admin`→`admin:list`、`/system/role`→`role:list`、`/system/menu`→`menu:list`、`/system/log`→`log:list`。守卫 `beforeEach`：未拉菜单先 `fetchMenus`，目标路由 `meta.permission` 不在 `permissions` 集合则跳 `/dashboard`。

- [ ] **Step 6: `utils/request.ts`。** 请求头加 `Accept-Language: appStore.locale`，错误消息用 `t()`。

- [ ] **Step 7: （可选）`directives/permission.ts`。** 实现 `v-permission="'xxx'"` 控制按钮显隐。

**Expected:** 侧边栏按权限动态渲染；无权路由被守卫拦截；语言切换即时生效。

---

### Task 12: 前端 API 层 + 系统管理页面 + Excel 导入组件

**Files:** `apps/admin/src/api/admin.ts`、`role.ts`、`menu.ts`、`operationLog.ts`、`views/system/*.vue`、`components/business/ExcelImportDialog.vue`、`api/auth.ts`、`api/device.ts`、`views/device/DeviceList.vue`

- [ ] **Step 1: 新建系统管理 API 模块。** `api/admin.ts`、`role.ts`、`menu.ts`、`operationLog.ts`，沿用既有 `http` 封装模式（见 `api/store.ts`）。

- [ ] **Step 2: 扩展既有 API。** `api/auth.ts` 补 me/logout/menus/change-password；`api/device.ts` 补 import/importTemplate。

- [ ] **Step 3: `AdminList.vue`。** 复用 `StoreList.vue` 列表+弹窗模板，字段 username/name/role/status，操作含重置密码、启用禁用、编辑、删除，`v-permission` 控制按钮。

- [ ] **Step 4: `RoleList.vue`。** 列表 + 弹窗（name/remark/status）+ "分配权限"按钮打开 `el-tree`（check 严格模式，data 为菜单树，`menuIds` 双向）+ 复制角色按钮。

- [ ] **Step 5: `MenuList.vue`。** `el-table` `tree-props` 树形表 + 弹窗（parentId select、name、type、path、icon、permission、sort、status）。

- [ ] **Step 6: `OperationLogList.vue`。** 列表 + 筛选（username、operation、时间范围）+ 详情弹窗（params/errorMsg JSON 展示）。

- [ ] **Step 7: `ExcelImportDialog.vue`。** `el-upload` 拖拽区 + "下载模板"按钮（调 `importTemplate`，blob 下载）+ 结果表格（successCount、failCount、failures 明细）。

- [ ] **Step 8: `DeviceList.vue` 接入。** 加"批量导入"按钮打开 `ExcelImportDialog`，导入成功后刷新列表。

- [ ] **Step 9: 构建验证。** `pnpm run build --workspace=@adspread/admin`，修复类型错误。

**Expected:** 系统管理四页面 + Excel 导入组件可用，构建通过。

---

### Task 13: 既有页面 i18n 迁移

**Files:** `views/auth/Login.vue`、`Dashboard.vue`、`store/StoreList.vue`、`device/DeviceList.vue`、`material/MaterialList.vue`、`program/ProgramList.vue`、`publish/PublishList.vue`

- [ ] **Step 1: 逐页替换硬编码中文为 `t()` key。** 使用 Task 10 的翻译文件，覆盖表格列标题、按钮文案、表单 label、校验消息、`ElMessage`/`ElMessageBox` 文案。

- [ ] **Step 2: 确认三语 key 完整。** grep 中文字符排查遗漏，三语文件 key 对齐。

- [ ] **Step 3: 构建验证。** `pnpm run build --workspace=@adspread/admin` 通过。

**Expected:** 全站无硬编码中文，三语切换全覆盖。

---

### Task 14: 文档同步与验证记录

**Files:** `docs/architecture/信发系统_技术设计文档.md`、`docs/api/`、`docs/superpowers/reviews/2026-06-26-adspread-phase2-verification.md`、`tasks/`

- [ ] **Step 1: 修订技术设计文档。** §4.2.6/4.2.8 角色菜单权限模型（`role_menu_permissions` → `Role.menuIds`，说明取舍）；§4.2.10 操作日志字段以代码为准；§5 API 清单补 `/api/admin/*` 与 `/api/auth/*` 扩展；默认语言日语。

- [ ] **Step 2: 同步其他文档。** 若 PRD 发现 MVP 范围冲突一并修订；同步 `docs/api/` 接口契约。

- [ ] **Step 3: 运行验证。** 后端与前端构建/测试，记录实际结果。

- [ ] **Step 4: 创建验证记录。** `docs/superpowers/reviews/2026-06-26-adspread-phase2-verification.md`，填入命令结果、API 集成测试覆盖、手工验收清单（登录与动态菜单、权限隔离、操作日志、Excel 导入、三语切换）、未验证项、已知问题。

- [ ] **Step 5: 任务文档流转。** `tasks/in-progress/` 建第二阶段任务文档。

- [ ] **Step 6: 最终状态检查。** `git status --short` 确认仅任务相关文件变更，无 node_modules/uploads/构建产物误入。

**Expected:** 文档与实现一致；验证记录真实可查。

---

## 3. Self-review checklist

- [ ] specs §4.4 初始化数据（39 菜单 + 2 角色 + 2 账号）已 seed 且幂等
- [ ] `PermissionGuard` 严格兜底生效：未声明标记的受保护接口 403
- [ ] specs §4.4.2 接口↔权限码映射全部落地，无漏挂
- [ ] 超级管理员放行；operator 按授权范围访问，删除/系统管理被拒
- [ ] 操作日志覆盖登录/登出/CRUD/审核/推送/导入
- [ ] Excel 导入逐行收集失败、模板可下载
- [ ] 默认日语，三语切换并记忆，Element Plus locale 联动
- [ ] 既有页面无硬编码中文
- [ ] 后端 build + test 通过；前端 build 通过
- [ ] 技术设计文档与实现一致；验证记录真实

---

## 4. Recommended commit grouping

仅在用户授权后提交。建议分组：

1. `feat(shared): align industry category enum and add rbac types`
2. `feat(backend): add permission guard and operation log interceptor`
3. `feat(backend): add system management modules (admin/role/menu/log)`
4. `feat(backend): extend auth with menus/me/logout and permission annotations`
5. `feat(backend): add excel device import`
6. `feat(backend): expand seed with menus, operator role and account`
7. `feat(admin): add i18n with ja/zh-CN/en`
8. `feat(admin): add permission store and dynamic menu`
9. `feat(admin): add system pages and excel import dialog`
10. `feat(admin): migrate existing pages to i18n`
11. `docs(phase2): sync design docs and add verification record`

每个 commit message 末尾：

```text
Co-Authored-By: Claude <noreply@anthropic.com>
```
