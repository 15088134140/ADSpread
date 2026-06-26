# 信发系统 第二阶段增强验证记录（后端错误消息国际化 + 前端动态路由）

**日期**: 2026-06-26
**范围**: 补齐第二阶段设计规格 §1.1 中"列为后续增强"的两项
**依据设计规格**: `docs/superpowers/specs/2026-06-26-adspread-phase2-i18n-dynamic-route-design.md`
**依据实施计划**: `docs/superpowers/plans/2026-06-26-adspread-phase2-i18n-dynamic-route.md`

## 概述

落实第二阶段遗留的两项后续增强：

1. **后端错误消息国际化**：`BusinessException` 业务错误消息与 `AllExceptionsFilter` 通用 HTTP 兜底消息按请求 `Accept-Language`（ja/zh-CN/en）本地化；Excel 导入失败 reason 同步本地化。class-validator 字段级校验消息保持英文（用户确认边界）。
2. **前端按权限动态注册路由**：路由表不再静态全量注册，登录后按后端菜单树 `router.addRoute` 动态注册，登出 `router.removeRoute` 移除。

## 验证命令与结果

| 命令                                        | 结果 | 备注                                                                                                          |
| ------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @adspread/backend run build` | PASS | `nest build` 无错误                                                                                           |
| `cd apps/backend && npx jest --runInBand`   | PASS | **23 套件 / 154 用例全绿**（基线 137 + 新增 17），~42s                                                        |
| `pnpm --filter @adspread/admin run build`   | PASS | `vue-tsc && vite build`，1767 模块，~12s；仅既有 sass/ chunk size 非阻塞警告                                  |
| `npx eslint <改动文件>`                     | PASS | 修复 `.eslintrc.js` project 指向各 app tsconfig 后，改动文件 0 error（`no-explicit-any` 既有 warning 不阻塞） |

## 后端测试增量（+17）

| spec                                              | 用例 | 覆盖                                                                                                                                                                                                       |
| ------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/common/i18n/error-messages.spec.ts`（新）    | 15   | `resolveLocale`（ja/zh/en/优先级/不匹配回退/复杂 header）、`resolveErrorMessage`（三语/默认 zh-CN/占位替换/params 不足/数字 params/未知 key 防御）、目录完整性（每 key 三语非空 + zh-CN 关键样本逐字校验） |
| `src/test/permission.integration.spec.ts`（扩展） | +2   | 401 通用兜底 locale（en/ja/zh 三语断言 body.message）、403 BusinessException locale（en/ja 断言）                                                                                                          |

## 关键不变量核对

| 不变量                                                     | 结果 | 证据                                                                                                                                                                                |
| ---------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BusinessException.message` 默认 zh-CN，与现有中文逐字一致 | ✓    | `error-messages.ts` zh-CN 值逐字复制现状；`permission.guard.spec.ts` `toBe('未登录'/'无权限访问')`、`auth.service.spec.ts` `toThrow('用户名或密码错误'/'账号已禁用')` 等 20+ 处通过 |
| 导入失败 reason zh-CN 默认不破现有断言                     | ✓    | `device.service.spec.ts` `stringContaining('门店不存在')`、`'设备编码已存在'` 精确匹配、`stringContaining('当批重复')`、`stringContaining('屏幕方向取值非法')` 均通过               |
| `system.controller.spec.ts` e2e 无 header → zh-CN          | ✓    | `body.message.toContain(...)` 与原中文文案一致                                                                                                                                      |
| 未改变 API 路径/权限码/HTTP 状态码/`BusinessErrorCode`     | ✓    | 代码审查确认                                                                                                                                                                        |
| 未引入 i18n 第三方框架                                     | ✓    | 仅内置消息目录                                                                                                                                                                      |
| class-validator 字段级消息保持英文                         | ✓    | ValidationPipe 未改，filter 中 `Array.isArray(message)` 分支保持现状                                                                                                                |

## 实现要点

### 后端 i18n

- 新增 `apps/backend/src/common/i18n/error-messages.ts`：57 个 key 的三语 `ERROR_MESSAGES`、`resolveLocale`、`resolveErrorMessage`（`{0}{1}` 占位）。
- `BusinessException` 构造改为 `(key, params?, businessCode?, status?, details?)`，`super` 始终以 zh-CN 解析传入（保证 `.message` 默认值不变），新增只读 `messageKey`/`messageParams`。
- `AllExceptionsFilter`：取 `Accept-Language` → `resolveLocale`；`BusinessException` 按 `messageKey`/`messageParams`+locale 解析；通用 401/403/404/500 用 `GENERIC_MESSAGE_BY_STATUS` map 按 locale 解析（避免 number 与 HttpStatus 枚举的不安全比较）。
- 全部 `throw new BusinessException('中文', ...)` 站点（约 50 处，跨 16 文件）迁移至 key 形式。
- Excel 导入：`batchImport(file, locale='zh-CN')`/`validateRow(...,locale)` 接收 locale，reason 用 `resolveErrorMessage`；`device.controller.ts` 从 `@Headers('accept-language')` 取 locale 传入；fallback `e.message` 保留原文，`'创建失败'`→`CREATE_FAILED` 本地化。

### 前端动态路由

- `router/index.ts` 仅保留静态路由：`/login`、`/`（`name:'Layout'`，`redirect:'/dashboard'`，`children:[]` 占位）、`/:pathMatch(.*)*`。
- 新增 `router/dynamic.ts`：`componentMap`（10 菜单 path → 懒加载组件）+ `buildDynamicRoutes(menuTree)`（仅 type=MENU 且 path 命中 componentMap 的节点生成子路由，name=`menu_${id}`）。
- `stores/permission.ts`：`fetchMenus` 后 `router.addRoute('Layout', route)` 逐条注册并记录 name，`isRoutesAdded=true`；`reset` 逐条 `router.removeRoute(name)` 复位。
- 守卫：已登录且 `!isRoutesAdded` → `await fetchMenus()` → `next({ ...to, replace: true })` 重新解析。
- `userStore.logout()` 已调 `permissionStore.reset()`，登出移除动态路由避免名称冲突。

## 过程中解决的问题

### ESLint 钩子阻塞（非本任务引入）

会话开始时存在未提交的根 `tsconfig.json` 改动（后由用户提交为 `74f7449` "移除弃用的 baseUrl 并精简根配置"），将根 tsconfig `include` 改为仅 `packages/**/*`，导致 `.eslintrc.js`（`parserOptions.project: 'tsconfig.json'`）对 `apps/**` 文件报 "TSConfig does not include this file"，pre-commit 钩子阻塞所有 backend .ts 提交。

**处理**：修改 `.eslintrc.js` `parserOptions.project` 为数组 `['tsconfig.json', 'apps/backend/tsconfig.json', 'apps/admin/tsconfig.json']`（typescript-eslint 按文件归属匹配 project），尊重"根 tsconfig 仅管 packages"的精简意图，恢复对 apps 文件的类型化检查。提交为 `chore(eslint): point project at per-app tsconfigs`。

### 新代码的 lint error 修复

- `all-exceptions.filter.ts`：`switch(httpStatus) { case HttpStatus.X }` 触发 `no-unsafe-enum-comparison`（number vs 枚举）→ 改用 `GENERIC_MESSAGE_BY_STATUS` map。
- `router/dynamic.ts`：`node.type === MenuType.MENU`（`MenuTreeNode.type: number` vs 枚举）→ 用 `const menuTypeMenu: number = MenuType.MENU` 承接，避免枚举比较且无需断言。

## 未验证项

- **前端 dev server 实时交互**：构建通过，未启动 dev server 逐页点击验证动态路由实时效果（admin 全路由可达、operator 未授权路由落 NotFound、登出再登录路由刷新）。逻辑由构建 + 代码审查保证。
- **后端真实 HTTP `Accept-Language` 端到端**：通过集成测试（`permission.integration.spec.ts` +2 用例）覆盖 filter 按 header 返回 ja/en/zh；未用 curl 逐接口验证。

## 已知偏差

- **class-validator 字段级校验消息仍为英文**：用户确认边界，非缺陷。后续若需全量本地化，须逐 DTO 装饰器加 i18n message（列为后续）。
- **首屏重定向 `/dashboard`**：依赖 dashboard 必授权（seed 中 operator 与超管均含 #1）。若未来出现无 dashboard 权限的角色，需改为重定向到第一个可见菜单（列为后续）。
- **后端默认 locale 为 zh-CN**：对无 `Accept-Language` 的调用方保持当前中文行为；前端始终发送 header，正常用户按所选语言返回。

## Self-review checklist

| 检查项                                            | 状态 | 证据                                                           |
| ------------------------------------------------- | ---- | -------------------------------------------------------------- |
| 后端 build + 154 用例全绿                         | ✓    | 验证命令节                                                     |
| 前端 build 通过                                   | ✓    | 验证命令节                                                     |
| `BusinessException` 按 `Accept-Language` 三语返回 | ✓    | `error-messages.spec.ts` + `permission.integration.spec.ts` +2 |
| 现有测试不破（zh-CN 默认不变）                    | ✓    | 137→154，原 137 全部通过                                       |
| Excel 导入 reason 随 locale 变化，zh-CN 不破断言  | ✓    | `device.service.spec.ts` 通过                                  |
| 前端路由按权限动态注册，登出移除                  | ✓    | `router/dynamic.ts`、`permission.ts`、构建通过                 |
| 技术设计文档 / 第二阶段 spec / API README 同步    | ✓    | commit `2c57f9a`                                               |
| 未引入 i18n 框架，未改 API/权限码/数据模型        | ✓    | 代码审查                                                       |

## 实施 commit 列表

| commit    | 说明                                                               |
| --------- | ------------------------------------------------------------------ |
| `cf8a080` | docs(superpowers): add phase2 i18n and dynamic route spec and plan |
| `8b1eec3` | feat(backend): localize business error messages by accept-language |
| `93972a6` | feat(admin): register routes dynamically by permission             |
| `2c57f9a` | docs(architecture): sync i18n and dynamic route implementation     |

> 另含解锁提交的 `chore(eslint): point project at per-app tsconfigs`（修复非本任务引入的 eslint 钩子阻塞）。

---

**文档结束**
