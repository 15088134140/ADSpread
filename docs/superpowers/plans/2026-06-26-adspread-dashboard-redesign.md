# 实施计划：管理端 Dashboard 重新设计

**日期**: 2026-06-26
**设计规格**: `docs/superpowers/specs/2026-06-26-adspread-dashboard-redesign-design.md`
**任务文档**: `tasks/in-progress/2026-06-26-adspread-dashboard-redesign.md`

---

## 总览

| Task   | 内容                       | 执行方                   | 依赖           |
| ------ | -------------------------- | ------------------------ | -------------- |
| Task 1 | 后端 Dashboard 聚合接口    | 后端架构师（子代理）     | 无             |
| Task 2 | 前端 Dashboard 页面重写    | 前端开发者（子代理）     | Task 1 契约确定 |
| Task 3 | API 文档同步               | 技术文档工程师（子代理） | Task 1 完成    |
| Task 4 | 验证与记录                 | 父代理 + 证据收集者      | Task 1–3 完成  |

Task 1 与 Task 2 存在契约依赖：Task 1 须先确定 `GET /dashboard/overview` 响应字段（已在 spec §5.3 固定），Task 2 据此实现。因契约已在规格中冻结，**Task 1、2 可并行派遣**——前端按 spec §5.3 的字段开发，后端按同一字段实现。Task 3 在 Task 1 完成后进行。子代理不执行 `git commit`，提交由父代理统一处理。

---

## Task 1：后端 Dashboard 聚合接口

### 改动文件

- 新建 `apps/backend/src/modules/dashboard/dashboard.module.ts`
- 新建 `apps/backend/src/modules/dashboard/dashboard.controller.ts`
- 新建 `apps/backend/src/modules/dashboard/dashboard.service.ts`
- 新建 `apps/backend/src/modules/dashboard/dto/dashboard-overview.dto.ts`
- 新建 `apps/backend/src/modules/dashboard/dashboard.service.spec.ts`
- 改 `apps/backend/src/app.module.ts`（注册 DashboardModule）

### 步骤

1. 建 `dashboard-overview.dto.ts`：导出 `DashboardOverview` 响应类型（字段与 spec §5.3 完全一致：`device`/`material`/`program`/`publish`/`store`/`todo`/`recentLogs`），含 `recentLogs` 元素类型（`id`/`username`/`operation`/`status`/`durationMs`/`createdAt`）。
2. 建 `dashboard.service.ts`：
   - 常量 `ONLINE_THRESHOLD_SECONDS = 300`。
   - `getOverview(adminId, hasLogPermission)`：`Promise.all` 并行执行：
     - 设备：`count({ where: { status: 1 } })`（enabled）、`count({ where: { status: 1, lastActiveAt: { gte: threshold } } })`（online）、离线 = enabled − online、`count()`（total）、`count({ where: { storeId: null } })`（unbound）、`onlineRate = enabled ? online/enabled : 0`。
     - 素材：`groupBy({ by: ['auditStatus'], _count: { _all: true } })` → 映射 pending/approved/rejected。
     - 节目：`groupBy({ by: ['status'], _count: { _all: true } })` → draft(0)/published(1)。
     - 发布计划：`groupBy({ by: ['status'], _count: { _all: true } })` → active(1)/inactive(0)。
     - 推送：近 7 天 `count()`（total）、`count({ where: { status: 1 } })`（success）、fail = total − success、`pushSuccessRate`。
     - 门店：`count()`（total）、`count({ where: { status: 1 } })`（active）。
     - `recentLogs`：`hasLogPermission` 为 false 直接 `[]`；否则 `findMany({ orderBy: { createdAt: 'desc' }, take: 10, select: { id, username, operation, status, time, createdAt } })`，映射 `time → durationMs`。
   - 组装 `todo`：`pendingMaterial = material.pending`、`pushFail = publish.recentPushFail`、`unboundDevice = device.unbound`。
3. 建 `dashboard.controller.ts`：`@Get('overview')` + `@RequirePermission('dashboard:view')`，从当前用户取 `hasLogPermission`（参照 `LogModule` 既有写法取权限集合，判定是否含 `log:list`），调用 service。
4. 建 `dashboard.module.ts`：`@Module({ controllers, providers })`，导出。
5. `app.module.ts` 注册 `DashboardModule`。
6. `dashboard.service.spec.ts`：mock `PrismaService`，覆盖：在线率计算（enabled=0 → 0）、离线含 `lastActiveAt: null`、推送成功率（total=0 → 0）、`hasLogPermission=false` 时 `recentLogs=[]` 不调用 `findMany`、`todo` 字段映射。

### 关键不变量

- 不新增数据表、不改 schema、不改 seed。
- 不改动既有接口与权限码；`dashboard:view` 复用 seed 既有定义。
- `OperationLog.time` 字段不改，仅在 DTO 映射为 `durationMs`。
- 现有全量 jest 用例不破。

### 验证

- `pnpm --filter @adspread/backend run build`
- `cd apps/backend && npx jest --runInBand`（含新增 spec）
- 启动后端，`curl -H "Authorization: Bearer <token>" http://localhost:3000/api/dashboard/overview` 返回结构符合 spec §5.3。

---

## Task 2：前端 Dashboard 页面重写

### 改动文件

- 新建 `apps/admin/src/api/dashboard.ts`
- 改 `apps/admin/src/views/Dashboard.vue`（完全重写）
- 改 `apps/admin/src/locales/zh-CN/common.ts`、`en/common.ts`、`ja/common.ts`（扩展 `dashboard` 命名空间）
- 改 `apps/admin/package.json`（新增 `echarts` 依赖）

### 步骤

1. `package.json` 新增 `"echarts": "^5.5.0"`，`pnpm install`。
2. 建 `api/dashboard.ts`：`DashboardOverview` 接口（字段与 spec §5.3 / 后端 DTO 一致）+ `getDashboardOverview()`。
3. 扩展三语 `common.ts` 的 `dashboard` 命名空间（spec §6.7 完整 key 清单）；`zh-CN` 已有 key（operator/operationContent/durationMs/time/recentOperations）逐字保留，新增 key 补中文；`en`/`ja` 按既有 locale 用词补齐。
4. 重写 `Dashboard.vue`：
   - `<script setup lang="ts">`：`onMounted` 调 `getDashboardOverview()`，`ref` 存 `overview`、`loading`、`error`；`onBeforeUnmount` 销毁 echarts 实例。
   - 按需引入 echarts（core + BarChart + GridComponent + TooltipComponent + CanvasRenderer）。
   - 区块 A：4 张指标卡（设备在线率/待审核素材/启用中发布计划/推送成功率），带分项副文本，点击跳转。
   - 区块 B：内容链路漏斗（echarts 横向条形或步骤条，展示 素材→节目→发布→推送 各状态分布）。
   - 区块 C：运营待办（3 项，可点击跳转；全 0 显示"暂无待办"）。
   - 区块 D：最近操作日志表格（`v-if="hasPermission('log:list')"`，最近 10 条 + "查看全部"跳 `/system/log`）。
   - 按区块显隐权限表（spec §6.4）施加 `v-if`。
   - 加载态 `el-skeleton`，失败态 `el-empty` + `ElMessage` 提示。
   - 样式沿用既有 SCSS + BEM，与原 Dashboard 卡片风格一致。
5. 移除全部 mock 数据与原 `stats`/`recentLogs` 硬编码。

### 关键不变量

- 不新建 axios 实例，统一用 `@/utils/request`。
- 不全量引入 echarts，按需注册最小集。
- 不引入新全局状态；`hasPermission` 复用 `permissionStore`。
- 响应字段与后端 DTO 一致，不擅自重命名。

### 验证

- `pnpm --filter @adspread/admin run build`（vue-tsc && vite build）
- 手工：admin 登录全区块可见、operator 无日志区块、切换语言文案正确、各数字与列表页 total 一致、待办跳转正确。

---

## Task 3：API 文档同步

### 改动文件

- 改 `docs/api/README.md`

### 步骤

1. "API 模块"表格新增行：`仪表盘 | /dashboard | 概览聚合 GET /overview | dashboard:view`。
2. 在"统一响应格式"后补 `GET /api/dashboard/overview` 响应结构说明，引用 spec §5.3。
3. 不改 `packages/api-contracts/README.md`（索引性质）。

### 验证

- 人工核对表格与 spec §5.3 字段一致。

---

## Task 4：验证与记录

### 步骤

1. 父代理运行 Task 1、2 的全部验证命令，确认绿。
2. 证据收集者（子代理）按 spec §1.3 闭环 + §8 验证策略收集证据：后端测试输出、前端 build 输出、`/api/docs` 截图或 curl 响应、手工验收记录（admin/operator 差异、多语言、数据一致性、待办跳转）。
3. 在 `docs/superpowers/reviews/` 产出 `2026-06-26-adspread-dashboard-redesign-verification.md`，记录验证结果、已知偏差与后续项。
4. 父代理按任务 `git add` + `git commit`（子代理不提交）。

### 验证

- 全部 spec §8 验证项通过并在验证记录中举证。

---

## 执行顺序

1. 并行派遣 Task 1（后端架构师）与 Task 2（前端开发者）——契约已在 spec 冻结。
2. Task 1 完成后派遣 Task 3（技术文档工程师）。
3. Task 1–3 完成后执行 Task 4（父代理 + 证据收集者）。
4. 父代理统一提交。

**计划结束**
