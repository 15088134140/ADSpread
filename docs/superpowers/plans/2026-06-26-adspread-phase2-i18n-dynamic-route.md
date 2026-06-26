# 实施计划：第二阶段增强（后端错误消息国际化 + 前端动态路由）

**日期**: 2026-06-26
**设计规格**: `docs/superpowers/specs/2026-06-26-adspread-phase2-i18n-dynamic-route-design.md`
**任务文档**: `tasks/in-progress/2026-06-26-adspread-phase2-i18n-dynamic-route.md`

---

## 总览

| Task   | 内容                   | 执行方                   | 依赖           |
| ------ | ---------------------- | ------------------------ | -------------- |
| Task 1 | 后端错误消息 i18n      | 后端架构师（子代理）     | 无             |
| Task 2 | 前端按权限动态注册路由 | 前端开发者（子代理）     | 无             |
| Task 3 | 文档同步               | 技术文档工程师（子代理） | Task 1、2 完成 |
| Task 4 | 验证与记录             | 父代理 + 证据收集者      | Task 1–3 完成  |

Task 1、2 互不依赖，**并行派遣**。子代理不执行 `git commit`，提交由父代理统一处理。

---

## Task 1：后端错误消息国际化

### 改动文件

- 新建 `apps/backend/src/common/i18n/error-messages.ts`
- 新建 `apps/backend/src/common/i18n/error-messages.spec.ts`
- 改 `apps/backend/src/common/errors/business.exception.ts`
- 改 `apps/backend/src/filters/all-exceptions.filter.ts`
- 改 throw 站点（约 11 文件）：
  - `apps/backend/src/common/guards/permission.guard.ts`
  - `apps/backend/src/common/utils/file.ts`
  - `apps/backend/src/common/utils/layout.ts`
  - `apps/backend/src/modules/auth/auth.service.ts`
  - `apps/backend/src/modules/device/device.service.ts`
  - `apps/backend/src/modules/device/device.controller.ts`
  - `apps/backend/src/modules/device-api/device-api.service.ts`
  - `apps/backend/src/modules/material/material.service.ts`
  - `apps/backend/src/modules/program/program.service.ts`
  - `apps/backend/src/modules/publish/publish.service.ts`
  - `apps/backend/src/modules/store/store.service.ts`
  - `apps/backend/src/modules/system/admin/admin.service.ts`
  - `apps/backend/src/modules/system/role/role.service.ts`
  - `apps/backend/src/modules/system/menu/menu.service.ts`

### 步骤

1. 建 `error-messages.ts`：`AppLocale`、`ERROR_MESSAGES`（zh-CN 逐字复制现状）、`resolveLocale`、`resolveErrorMessage`。
2. 改 `BusinessException` 构造为 `(key, params?, businessCode?, status?, details?)`，`super` 传 zh-CN 解析结果；加 `messageKey`/`messageParams`。
3. 改 `AllExceptionsFilter`：取 `Accept-Language` → `resolveLocale`；`BusinessException` 按 `messageKey`/`messageParams` 解析；通用 401/403/404/500 按 locale 解析；ValidationPipe 数组消息保持现状。
4. 逐文件迁移 throw 站点至 key 形式（含 `PASSWORD_STRENGTH_MESSAGE` → `PASSWORD_WEAK`）。
5. `device.service.ts` `batchImport(file, locale)` / `validateRow(..., locale)` 接收 locale，reason 用 `resolveErrorMessage`；`device.controller.ts` 从请求头取 locale 传入。fallback `e.message` 保留原文，`'创建失败'`→`CREATE_FAILED`。
6. 新增 `error-messages.spec.ts`；视情扩展 filter/guard 的 locale 用例。

### 关键不变量

- `BusinessException.message` 默认 zh-CN，与现有中文字符串逐字一致 → 现有 137 用例不破。
- `device.service.spec.ts` `stringContaining('门店不存在')` 在无 header（zh-CN）下仍通过。

### 验证

```bash
pnpm --filter @adspread/backend run build
cd apps/backend && npx jest --runInBand   # 期望全绿（137 + 新增）
```

---

## Task 2：前端按权限动态注册路由

### 改动文件

- 改 `apps/admin/src/router/index.ts`（仅静态路由）
- 新建 `apps/admin/src/router/dynamic.ts`
- 改 `apps/admin/src/stores/permission.ts`（动态注册/移除）
- 改 `apps/admin/src/stores/user.ts`（确认 logout 调 `permissionStore.reset()`，缺则补）

### 步骤

1. `router/index.ts`：保留 `/login`、`/`（Layout 外壳，`name:'Layout'`，`redirect:'/dashboard'`，无 children）、`/:pathMatch(.*)*`；删除 10 个业务 children。
2. `dynamic.ts`：`componentMap`（10 个菜单 path → 懒加载组件）+ `buildDynamicRoutes(menuTree)`（仅 type=MENU 且 path 命中 componentMap 的节点生成子路由，name=`menu_${id}`，相对 path）。
3. `permission.ts`：加 `isRoutesAdded`、`addedRouteNames`；`fetchMenus` 后 `router.addRoute('Layout', route)` 逐条注册并记录 name；`reset` 逐条 `router.removeRoute(name)` 并复位。
4. 守卫：已登录且 `!isRoutesAdded` → `await fetchMenus()` → `next({ ...to, replace: true })`。
5. 确认 `userStore.logout()` 调 `permissionStore.reset()`。

### 验证

```bash
pnpm --filter @adspread/admin run build   # vue-tsc && vite build
```

手工：admin 全路由可达；operator `/system/admin` 落 NotFound；登出再登录路由刷新无冲突。

---

## Task 3：文档同步

### 改动文件

- `docs/architecture/信发系统_技术设计文档.md`（§5.4 错误处理、§5.5.3/§7.4.3 前端路由）
- `docs/superpowers/specs/2026-06-26-adspread-phase2-rbac-audit-i18n-excel-design.md`（§1.1/§10）
- `docs/api/README.md`（错误响应说明，若相关段落存在）

### 步骤

1. 技术设计文档 §5.4：移除"错误消息暂保持中文，列为后续增强"，改为按 `Accept-Language` 三语；注明 class-validator 字段级消息仍英文。
2. 技术设计文档 §5.5.3/§7.4.3：移除"组件级动态加载列为后续增强"，改为按权限动态注册路由。
3. 第二阶段设计规格 §1.1/§10：标注两项已由本增强落实。
4. `docs/api/README.md`：错误响应 `message` 随 `Accept-Language` 变化说明。

### 验证

文档改动需与 Task 1/2 实现一致；父代理审查。

---

## Task 4：验证与记录

1. 父代理运行：后端 build + jest、前端 build。
2. 按 Task 分别 `git commit`（Conventional Commits）。
3. 产出 `docs/superpowers/reviews/2026-06-26-adspread-phase2-i18n-dynamic-route-verification.md`（证据收集者或技术文档工程师）。
4. 任务文档移至 `tasks/done/`。

### 提交分组（预期）

| commit type     | 说明                                 |
| --------------- | ------------------------------------ |
| `feat(backend)` | 后端错误消息 i18n                    |
| `feat(admin)`   | 前端按权限动态注册路由               |
| `docs`          | 同步技术设计文档/spec/api + 验证记录 |

---

## 风险与回滚

- 现有测试红 → 核对 zh-CN 翻译逐字一致；`BusinessException` 默认 zh-CN 不变。
- 动态路由名称冲突 → `reset` 逐条移除 + `isRoutesAdded` 守护。
- 路由未注册导致 404 → 守卫 `next({ ...to, replace: true })` 重新解析。

**文档结束**
