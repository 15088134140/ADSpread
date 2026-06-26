# 信发系统 管理端 Dashboard 重新设计规格

**日期**: 2026-06-26
**范围**: 重新设计管理端仪表盘页面（`/dashboard`）的内容与数据来源，新增后端聚合接口替换现有 mock 数据，使仪表盘反映"信发"业务链路的真实运营状态。
**参考文档**:

- [MVP 设计规格](./2026-06-25-adspread-admin-backend-mvp-design.md)
- [第二阶段 RBAC + 操作日志 + 多语言 + Excel 设计规格](./2026-06-26-adspread-phase2-rbac-audit-i18n-excel-design.md)
- [第二阶段 i18n + 动态路由增强规格](./2026-06-26-adspread-phase2-i18n-dynamic-route-design.md)
- [API 文档](../../api/README.md)

---

## 1. 背景与目标

### 1.1 现状与问题

当前 `apps/admin/src/views/Dashboard.vue` 实现存在两个根本问题：

1. **数据为 mock**：`onMounted` 中硬编码 `storeCount: 24` 等统计值与操作日志（`Dashboard.vue:121-135`，注释明确 `// Mock data - will be replaced with actual API calls`），后端无任何 dashboard 相关接口。
2. **内容无业务依据**：四张统计卡（门店数/设备数/素材数/在线设备数）只反映"存量计数"，不反映业务链路状态；MVP 设计规格对 dashboard 的规定仅限于"登录后跳转 `/dashboard`"和"侧边栏含仪表盘菜单项"（spec §8.1、第 455/462/928 行），**未规定页面内容**。页面 UI 结构为开发期自行设计，无对应设计文档。

信发系统的业务核心是一条链路：**素材审核 → 节目制作 → 发布计划 → 推送到门店设备播放**。当前仪表盘既不反映这条链路的健康度，也不提供运营待办，对运营决策无价值。

### 1.2 目标

重新设计仪表盘，使其围绕业务链路提供三方面价值：

1. **链路健康度**：内容从审核到播放，各环节的状态分布与积压情况。
2. **运营待办**：当前需要处理的事项（待审核素材、推送失败、未绑定门店的设备）。
3. **核心运营指标**：设备在线率、推送成功率——信发系统运营的核心指标，而非裸存量计数。

### 1.3 完成后应能验证的闭环

- 登录后 `/dashboard` 展示的所有数字来自后端真实聚合接口，无任何 mock。
- 待审核素材数与 `/material?auditStatus=PENDING` 列表一致；点击可跳转处理。
- 设备在线率 = 在线设备数 / 启用设备数，"在线"定义见 §5.2，可在页面查看在线/离线/未绑定分项。
- 运营人员（operator）登录后看到业务链路与待办，但看不到操作日志区块（无 `log:list` 权限）。
- 切换语言（ja/zh-CN/en）后仪表盘文案正确切换。

### 1.4 本轮明确不做

- **设备在线趋势图（近 N 天折线）**：需要历史心跳数据表，工程量大且当前无 `device_heartbeat_log` 表。本轮仅做实时在线率快照，趋势图列入后续阶段（§10）。
- **播放时长/曝光等业务统计**：当前数据模型无播放记录表，无法统计。列入后续。
- **新增数据表 / Prisma schema 变更**：本轮不新增表，所有指标基于现有表实时聚合。
- **新增角色或权限码**：复用现有 `dashboard:view` 及各业务权限码。

---

## 2. 标准参照与对齐原则

- 代码与文档不一致时默认修改代码；本设计新增后端聚合接口与前端页面重写，不改变既有 API 路径、权限码语义与数据模型。
- 后端遵循 `.ai/backend-standards.md`：Controller 只处理 HTTP 层，业务逻辑在 Service，数据访问经 Prisma。
- 前端遵循 `.ai/admin-standards.md`：`<script setup lang="ts">`、Composition API、API 调用经 `utils/request.ts`、样式遵循既有 SCSS + BEM。
- 接口变更同步更新 `docs/api/README.md`。
- 多语言：后端错误消息已三语化（第二阶段增强），前端文案经 `vue-i18n` 三语化；仪表盘新增文案加入 `apps/admin/src/locales/{zh-CN,en,ja}/common.ts` 的 `dashboard` 命名空间。

---

## 3. 范围与边界

### 3.1 纳入本轮

#### 3.1.1 后端

- 新增 `DashboardModule`（controller + service），提供 `GET /api/dashboard/overview` 聚合接口。
- 接口按 `@RequirePermission('dashboard:view')` 保护。
- 实现各业务表的 `groupBy` / `count` 聚合查询，返回链路各环节状态分布、待办计数与最近操作日志。
- 操作日志区块按当前用户 `log:list` 权限裁剪：无权限则 `recentLogs` 返回空数组（最小权限原则）。

#### 3.1.2 前端

- 重写 `apps/admin/src/views/Dashboard.vue`，移除全部 mock 数据。
- 引入 `echarts`（仅按需引入 `PieChart` / `BarChart` 等必要组件）渲染状态分布。
- 新增 `apps/admin/src/api/dashboard.ts` 封装聚合接口调用。
- 按角色权限（`hasPermission`）显隐业务区块。
- 三语文案补充。

#### 3.1.3 文档

- 更新 `docs/api/README.md` 新增 dashboard 模块说明。
- 在 `docs/superpowers/reviews/` 产出验证记录。

### 3.2 不纳入本轮

见 §1.4。

---

## 4. 数据模型

**无变更**。不新增数据表，不修改 Prisma schema、seed。

仪表盘各指标基于以下现有表与字段实时聚合：

| 指标维度 | 数据来源（表.字段） |
| --- | --- |
| 设备在线/离线/未绑定 | `Device.lastActiveAt`、`Device.status`、`Device.storeId` |
| 素材审核状态分布 | `Material.auditStatus`（PENDING/APPROVED/REJECTED） |
| 节目状态分布 | `Program.status`（0 草稿 / 1 已发布） |
| 发布计划状态分布 | `PublishPlan.status`（1 启用 / 0 停用） |
| 推送成功率 | `PushMessageLog.status`（1 成功 / 0 失败）、`createdAt` |
| 门店计数 | `Store.status` |
| 待办-未绑定设备 | `Device.storeId IS NULL` 且 `status = 1` |
| 最近操作日志 | `OperationLog`（按 `createdAt` desc 取 10 条） |

---

## 5. 后端设计

### 5.1 目录结构（新增）

```
apps/backend/src/modules/dashboard/dashboard.module.ts
apps/backend/src/modules/dashboard/dashboard.controller.ts
apps/backend/src/modules/dashboard/dashboard.service.ts
apps/backend/src/modules/dashboard/dto/dashboard-overview.dto.ts   # 响应类型
apps/backend/src/modules/dashboard/dashboard.service.spec.ts
```

### 5.2 "在线"定义

设备在线判定（service 内常量，不暴露为配置项，符合"不引入未被要求的配置项"原则）：

```
ONLINE_THRESHOLD_SECONDS = 300  // 5 分钟
在线 = status = 1 AND lastActiveAt >= now - 5min
离线 = status = 1 AND (lastActiveAt IS NULL OR lastActiveAt < now - 5min)
未绑定 = storeId IS NULL（与在线状态无关，单独统计）
```

> 注：`status = 0`（禁用）的设备不计入在线/离线分母，仅计入设备总数。在线率 = 在线数 / 启用设备数（`status = 1`）。

### 5.3 接口设计

#### `GET /api/dashboard/overview`

- **权限**：`@RequirePermission('dashboard:view')`
- **响应**（`code: 0`，`data` 结构）：

```jsonc
{
  "device": {
    "total": 156,          // 全部设备
    "enabled": 150,        // status=1
    "online": 148,         // 启用且在线
    "offline": 2,          // 启用且离线
    "unbound": 6,          // storeId IS NULL（含禁用）
    "onlineRate": 0.987    // online / enabled，保留 3 位小数；enabled=0 时为 0
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
    "active": 5,           // status=1
    "inactive": 2,         // status=0
    "recentPushTotal": 42, // 近 7 天 PushMessageLog 总数
    "recentPushSuccess": 40,
    "recentPushFail": 2,
    "pushSuccessRate": 0.952 // 近 7 天；recentPushTotal=0 时为 0
  },
  "store": {
    "total": 24,
    "active": 22           // status=1
  },
  "todo": {
    "pendingMaterial": 3,    // 等于 material.pending
    "pushFail": 2,           // 等于 publish.recentPushFail
    "unboundDevice": 6       // 等于 device.unbound
  },
  "recentLogs": [            // 最近 10 条操作日志；当前用户无 log:list 权限时为 []
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

字段命名说明：`durationMs` 对应 `OperationLog.time`（耗时 ms），重命名为语义更清晰的 `durationMs`，仅作用于本响应 DTO，不改动表字段。

### 5.4 Service 实现要点

- 单个 `getOverview(adminId, hasLogPermission)` 方法，内部并行执行各 `prisma.*.groupBy` / `count` 查询（`Promise.all`）。
- 设备在线/离线计数：Prisma 不便直接表达"`lastActiveAt >= threshold`"的 `count`，使用 `prisma.device.count({ where: { status: 1, lastActiveAt: { gte: threshold } } })` 与 `{ lt: threshold }` 分别计数；`lastActiveAt IS NULL` 归入离线（`lastActiveAt: { not: { gte: threshold } }` 不含 null，需用 `{ OR: [{ lastActiveAt: { lt: threshold } }, { lastActiveAt: null }] }`）。
- 推送统计限定 `createdAt >= now - 7d`。
- `recentLogs`：`prisma.operationLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10, select: { id, username, operation, status, time, createdAt } })`；当 `!hasLogPermission` 时直接返回 `[]`，不查询。
- `hasLogPermission` 由 Controller 从当前用户权限集合判定后传入 Service（Controller 层职责：认证上下文）。

### 5.5 Controller 实现要点

```ts
@Get('overview')
@RequirePermission('dashboard:view')
async getOverview(@CurrentAdmin() admin: AuthAdmin) {
  const hasLogPermission = admin.permissions?.includes('log:list') ?? false;
  return this.dashboardService.getOverview(admin.id, hasLogPermission);
}
```

> `@CurrentAdmin()` 与权限集合的取法参照既有模块（如 `LogModule` 中获取当前用户的写法）；若当前 JWT payload 未携带权限集合，则在 service 内按 `roleId` 查询角色 `menuIds` 推导，复用既有 `PermissionGuard` 的解析逻辑。实现时以既有代码为准，不新建权限解析路径。

### 5.6 测试

- `dashboard.service.spec.ts`：mock Prisma，验证各计数字段计算正确（在线率、推送成功率、enabled=0 边界、无 log 权限时 `recentLogs` 为空）。
- 不新增 controller 集成测试（既有项目 controller 层薄，依赖 e2e；若既有有 controller spec 模式则对齐）。

---

## 6. 前端设计

### 6.1 目录结构（新增/改动）

```
apps/admin/src/api/dashboard.ts                 # 新：聚合接口封装
apps/admin/src/views/Dashboard.vue              # 改：完全重写
apps/admin/src/locales/{zh-CN,en,ja}/common.ts  # 改：扩展 dashboard 命名空间
apps/admin/package.json                         # 改：新增 echarts 依赖
```

### 6.2 API 封装

`api/dashboard.ts`：

```ts
import request from '@/utils/request';
export interface DashboardOverview { /* 与后端 DTO 一致 */ }
export function getDashboardOverview() {
  return request.get<DashboardOverview>('/dashboard/overview');
}
```

### 6.3 页面分区

Dashboard.vue 自上而下分为四个区块，均数据驱动：

#### 区块 A：核心指标卡（4 张，带状态分项）

| 卡片 | 主数值 | 分项/副文本 |
| --- | --- | --- |
| 设备在线率 | `device.onlineRate`（百分比） | 在线 / 离线 / 未绑定 |
| 待审核素材 | `material.pending` | 已通过 / 已驳回 |
| 启用中发布计划 | `publish.active` | 停用数 |
| 推送成功率（近 7 天） | `publish.pushSuccessRate`（百分比） | 成功 / 失败次数 |

卡片点击跳转对应列表页（设备→`/device`、素材→`/material?auditStatus=PENDING`、发布→`/publish`）。

#### 区块 B：内容链路漏斗（横向流程图）

`素材(待审/已通过) → 节目(草稿/已发布) → 发布计划(启用/停用) → 推送(成功/失败)`

用 echarts 横向漏斗或步骤条展示各环节状态分布数量，一眼看出积压环节。数据来自 `material` / `program` / `publish` 字段。

#### 区块 C：运营待办（可点击跳转）

- 待审核素材（`todo.pendingMaterial`）→ `/material?auditStatus=PENDING`
- 推送失败（`todo.pushFail`）→ `/publish`
- 未绑定门店设备（`todo.unboundDevice`）→ `/device`

待办数为 0 时显示"暂无待办"。

#### 区块 D：最近操作日志（仅 `log:list` 权限可见）

- 复用后端 `recentLogs`，展示最近 10 条：操作人、操作内容、耗时、时间、成功/失败标记。
- "查看全部"跳转 `/system/log`。
- 无 `log:list` 权限时（如 operator）整个区块不渲染（`v-if="hasPermission('log:list')"`）。

### 6.4 权限差异化

区块显隐规则（使用既有 `permissionStore.hasPermission`）：

| 区块 | 显隐权限 |
| --- | --- |
| 核心指标卡-设备 | `device:list` |
| 核心指标卡-素材 | `material:list` |
| 核心指标卡-发布 | `publish:list` |
| 内容链路漏斗 | 始终显示（链路概览，所有有 `dashboard:view` 的角色均可见） |
| 运营待办-待审核素材 | `material:audit` |
| 运营待办-推送失败 | `publish:list` |
| 运营待办-未绑定设备 | `device:list` |
| 最近操作日志 | `log:list` |

> 超级管理员全部可见；运营人员（operator）可见业务区块，不可见操作日志区块。指标卡无对应权限时该卡隐藏，不影响布局。

### 6.5 echarts 引入

- `package.json` 新增 `"echarts": "^5.5.0"`。
- 按需引入：`import * as echarts from 'echarts/core'; import { BarChart } from 'echarts/charts'; import { GridComponent, TooltipComponent } from 'echarts/components'; import { CanvasRenderer } from 'echarts/renderers';`，注册最小集，避免全量打包。
- 在 `onMounted` 初始化、`onBeforeUnmount` 销毁，复用既有页面（若有图表）的写法；当前项目无图表先例，建立此模式。

### 6.6 响应式与加载态

- 接口加载中显示 `el-skeleton`；接口失败显示 `el-empty` + 错误提示，不阻塞其他区块（单接口聚合，整体失败则整体兜底）。
- 响应式布局沿用既有 `el-row` / `el-col`（与现有 Dashboard 一致）。

### 6.7 多语言

`common.ts` 的 `dashboard` 命名空间扩展为：

```ts
dashboard: {
  title: '仪表盘',
  // 指标卡
  deviceOnlineRate: '设备在线率',
  pendingMaterial: '待审核素材',
  activePublishPlan: '启用中发布计划',
  pushSuccessRate: '推送成功率（近7天）',
  online: '在线', offline: '离线', unbound: '未绑定',
  approved: '已通过', rejected: '已驳回',
  active: '启用', inactive: '停用',
  success: '成功', fail: '失败',
  // 链路漏斗
  contentFunnel: '内容链路',
  stepMaterial: '素材', stepProgram: '节目', stepPublish: '发布计划', stepPush: '推送',
  // 待办
  todo: '运营待办',
  todoPendingMaterial: '待审核素材',
  todoPushFail: '推送失败',
  todoUnboundDevice: '未绑定门店的设备',
  noTodo: '暂无待办',
  // 日志
  recentLogs: '最近操作',
  viewAll: '查看全部',
  operator: '操作人', operationContent: '操作内容', durationMs: '耗时(ms)', time: '时间',
}
```

`zh-CN` 值逐字沿用现有 dashboard key 中已有的部分（operator/operationContent/durationMs/time/recentOperations），新增项翻译参照既有术语；`en`/`ja` 由前端开发者按既有 locale 用词补齐。

### 6.8 验证

- `pnpm --filter @adspread/admin run build`（vue-tsc && vite build）通过。
- 手工：admin 登录看到全部区块；operator 登录无操作日志区块；切换语言文案正确；数字与对应列表页一致。

---

## 7. 接口契约同步

更新 `docs/api/README.md`：

- "API 模块"表格新增行：`仪表盘 | /dashboard | 概览聚合 GET /overview | dashboard:view`。
- 在"REST API 概览"后或适当位置补充 `GET /api/dashboard/overview` 响应结构说明（引用本规格 §5.3）。

`packages/api-contracts/README.md` 为索引性质，无需改动（项目契约以 Swagger + `docs/api/` 为准）。

---

## 8. 验证策略

1. **后端**：
   - `pnpm --filter @adspread/backend run build` 通过。
   - `cd apps/backend && npx jest --runInBand` 全绿（含新增 `dashboard.service.spec.ts`）。
2. **前端**：
   - `pnpm --filter @adspread/admin run build` 通过。
3. **契约**：启动后端访问 `/api/docs` 确认 `GET /dashboard/overview` 出现且权限码正确。
4. **手工验收**（§1.3 闭环）：
   - 数据真实性：仪表盘各数字与对应列表页 total 一致。
   - 待办跳转：点击待审核素材跳 `/material?auditStatus=PENDING`。
   - 角色差异：operator 看不到操作日志区块。
   - 多语言：切换 ja/en/zh-CN 文案正确。
5. 在 `docs/superpowers/reviews/` 产出验证记录。

---

## 9. 风险与取舍

- **在线判定的近似性**：`lastActiveAt` 仅记录最后一次活跃时间，无法回溯历史在线状态，故趋势图不在本轮（§1.4）。5 分钟阈值是约定常量，非配置项，避免引入未被要求的配置。
- **聚合接口性能**：单接口内 6+ 次 `count`/`groupBy`，数据量大时可能偏慢。当前 MVP 数据量级可接受；若未来设备/日志规模增长，可加 Redis 缓存或预聚合表（列入后续）。本轮不做缓存。
- **权限裁剪在 Service 层**：`recentLogs` 按 `log:list` 裁剪，避免无权限用户读到操作日志明细；其余汇总数为非敏感聚合数据，不裁剪。
- **echarts 打包体积**：按需引入最小集控制；全量引入会显著增大 bundle，明确禁止。
- **字段重命名 `time → durationMs`**：仅在 dashboard 响应 DTO 内重命名，不改动 `OperationLog` 表与既有 `/admin/logs` 接口，无破坏性。

---

## 10. 后续阶段（不在本轮）

- 设备在线率趋势图（需新增 `device_heartbeat_log` 表定时记录心跳）。
- 播放时长 / 素材曝光等业务统计（需播放记录表）。
- 聚合接口 Redis 缓存或预聚合报表。
- Dashboard 按角色定制默认聚焦区块（如审核员默认聚焦待审核）。

**文档结束**
