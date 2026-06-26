# 任务：管理端 Dashboard 重新设计

## 背景

当前 `apps/admin/src/views/Dashboard.vue` 为 mock 实现（`Dashboard.vue:121-135` 硬编码统计与日志），后端无 dashboard 接口；页面内容（四张存量计数卡）无设计文档依据，不反映信发业务链路（素材审核→节目→发布→推送）的真实运营状态。MVP 设计规格仅规定 dashboard 作为登录后首页，未规定页面内容。

详见 `docs/superpowers/specs/2026-06-26-adspread-dashboard-redesign-design.md`。

## 目标

重新设计仪表盘，围绕业务链路提供：链路健康度、运营待办、核心运营指标（设备在线率、推送成功率），全部数据来自后端真实聚合接口，并按角色权限差异化显示。

## 范围

- 后端新增 `DashboardModule` + `GET /api/dashboard/overview` 聚合接口（`dashboard:view` 保护）。
- 前端重写 `Dashboard.vue`，引入 echarts，按权限显隐区块，三语化。
- 同步 `docs/api/README.md`。
- 产出验证记录。

## 非范围

- 设备在线趋势图（需心跳历史表）。
- 播放时长/曝光统计（需播放记录表）。
- 新增数据表、schema 变更、新增角色或权限码。
- 聚合接口缓存或预聚合。

## 相关文件

- 规格：`docs/superpowers/specs/2026-06-26-adspread-dashboard-redesign-design.md`
- 计划：`docs/superpowers/plans/2026-06-26-adspread-dashboard-redesign.md`
- 现状：`apps/admin/src/views/Dashboard.vue`
- Schema：`apps/backend/prisma/schema.prisma`
- Seed（角色/权限）：`apps/backend/prisma/seed.ts`
- API 文档：`docs/api/README.md`

## 验收标准

- [x] `/dashboard` 所有数字来自 `GET /api/dashboard/overview`，无 mock 残留。
- [x] 设备在线率 = 在线/启用，"在线"为 `lastActiveAt >= now-5min` 且 `status=1`。
- [x] 待审核素材数与 `/material?auditStatus=PENDING` 列表一致，可点击跳转。
- [x] operator 登录看不到操作日志区块（无 `log:list`）；超管全区块可见。
- [x] 切换 ja/zh-CN/en 文案正确。
- [x] 后端 `jest` 全绿（含新增 `dashboard.service.spec.ts`），前端 `build` 通过。
- [x] `docs/api/README.md` 新增 dashboard 模块说明。
- [x] `docs/superpowers/reviews/` 产出验证记录。

## 验证方式

```bash
pnpm --filter @adspread/backend run build
cd apps/backend && npx jest --runInBand
pnpm --filter @adspread/admin run build
```

启动后端访问 `/api/docs` 确认 `GET /dashboard/overview`；手工验收 admin/operator 差异、多语言、数据一致性、待办跳转（详见 spec §8）。

## 备注

- 在线阈值 5 分钟为约定常量，非配置项（避免引入未被要求的配置）。
- `recentLogs` 按 `log:list` 权限裁剪（最小权限原则）；其余汇总数据不裁剪。
- `OperationLog.time` 在 DTO 映射为 `durationMs`，不改表字段。
- echarts 按需引入最小集，禁止全量打包。
