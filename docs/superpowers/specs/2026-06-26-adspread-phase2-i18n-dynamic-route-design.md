# 信发系统 第二阶段增强设计规格（后端错误消息国际化 + 前端动态路由）

**日期**: 2026-06-26
**范围**: 补齐第二阶段设计规格 §1.1 中明确"列为后续增强"的两项：后端错误消息多语言国际化、前端组件级动态加载（按权限动态注册路由）。
**参考文档**:

- [第二阶段设计规格（RBAC + 操作日志 + 多语言 + Excel 导入）](./2026-06-26-adspread-phase2-rbac-audit-i18n-excel-design.md)
- [第二阶段验证记录](../reviews/2026-06-26-adspread-phase2-verification.md)
- [产品需求文档](../../requirements/信发系统_产品需求文档.md)
- [技术设计文档](../../architecture/信发系统_技术设计文档.md)

---

## 1. 背景与目标

第二阶段（RBAC + 操作日志 + 多语言 + Excel 导入）已合并并通过验证。其设计规格 §1.1 将以下两项明确列为"本轮不做 / 后续增强"：

1. **后端错误消息的多语言国际化**：业务错误码已统一，但错误消息暂保持中文。
2. **前端组件级动态加载**：路由仍静态注册，仅侧边栏菜单按权限动态渲染。

第二阶段验证记录"已知问题与偏差"第 3、4 条同样将这两项列为遗留。本增强规格落实这两项，使后端业务错误消息随请求 `Accept-Language` 返回日/中/英三语，并使前端路由按当前用户菜单权限动态注册，符合 PRD"动态路由"语义。

### 1.1 完成后应能验证的闭环

- 前端切换语言后，触发任意业务错误（如登录密码错误、删除不存在的资源、无权限访问），后端按 `Accept-Language` 返回对应语言的 `message`，前端 `ElMessage` 展示对应语言文案。
- admin 登录后路由表含全部业务路由；operator 登录后路由表仅含授权菜单对应路由，未授权路由（如 `/system/admin`）直接访问落到 NotFound；登出后再以另一账号登录，路由表正确刷新无名称冲突。

### 1.2 本轮明确不做

- class-validator 字段级校验消息（`@IsString` 等产生的 "name must be a string"）**保持英文**，不做逐装饰器本地化（用户确认边界）。仅本地化 `BusinessException` 业务错误消息与 `AllExceptionsFilter` 通用 HTTP 兜底消息。
- 不引入 i18n 第三方框架（如 nestjs-i18n），采用轻量内置消息目录。
- 不改变现有业务错误码（`BusinessErrorCode`）与 HTTP 状态码语义。

---

## 2. 标准参照与对齐原则

延续第二阶段对齐原则：代码与文档不一致时默认修改代码；本增强不新增数据表、不改变既有 API 路径与权限码；仅扩展错误响应 `message` 的语言行为与前端路由注册方式。完成后同步修订第二阶段设计规格 §1.1/§10、技术设计文档对应章节。

---

## 3. 范围与边界

### 3.1 纳入本轮

#### 3.1.1 后端错误消息国际化

- 新增消息目录 `apps/backend/src/common/i18n/error-messages.ts`：`ERROR_MESSAGES` 三语映射 + `resolveErrorMessage` + `resolveLocale`。
- 改造 `BusinessException`：构造以消息 key + 参数为主，默认 zh-CN 解析传入 `super`（保持 `.message` 与现有测试断言一致），新增 `messageKey`/`messageParams` 字段。
- 改造 `AllExceptionsFilter`：按请求 `Accept-Language` 解析 `BusinessException` 与通用 HTTP 兜底消息。
- 迁移全部 `throw new BusinessException('中文', ...)` 站点至 key 形式（约 50 处，跨 guards/utils/auth/device/device-api/material/program/publish/store/system）。
- Excel 导入失败 `reason` 本地化：`batchImport`/`validateRow` 接收 locale 参数，按 locale 解析 reason。
- 新增 `error-messages.spec.ts`；现有 spec 保持绿。

#### 3.1.2 前端按权限动态注册路由

- 拆分 `router/index.ts`：仅保留静态路由（login / MainLayout 外壳 / NotFound）。
- 新增 `router/dynamic.ts`：`componentMap`（菜单 path → 懒加载组件）+ `buildDynamicRoutes(menuTree)`。
- 扩展 `permissionStore`：`fetchMenus` 后 `router.addRoute` 动态注册，`reset` 时 `router.removeRoute` 移除。
- 路由守卫：未注册动态路由时先 `fetchMenus` 再 `next({ ...to, replace: true })` 重新解析。
- 登出清理动态路由，避免再次登录名称冲突。

### 3.2 不纳入本轮

见 §1.2。

---

## 4. 数据模型

**无变更**。不新增数据表，不修改 Prisma schema、seed。

---

## 5. 后端设计

### 5.1 目录结构（新增）

```
apps/backend/src/common/i18n/error-messages.ts   # 消息目录与解析器
apps/backend/src/common/i18n/error-messages.spec.ts
```

### 5.2 消息目录

`error-messages.ts`：

- `type AppLocale = 'ja' | 'zh-CN' | 'en'`。
- `ErrorMessageKey` 为 `ERROR_MESSAGES` 的 key 联合类型，命名 `SCREAMING_SNAKE_CASE`。
- `ERROR_MESSAGES: Record<ErrorMessageKey, Record<AppLocale, string>>`。占位用 `{0}{1}...`。
  - **zh-CN 值逐字复制现有中文字符串**，保证 `BusinessException.message` 默认值不变、现有测试不破。
  - ja / en 翻译参照前端 `apps/admin/src/locales/{ja,en}` 既有用词，保持术语一致。
- `resolveLocale(acceptLanguage?: string): AppLocale`：解析 header（匹配 `ja`/`zh`/`en`，不匹配回退 `zh-CN`，保持对非浏览器调用方的当前行为）。
- `resolveErrorMessage(key, params?, locale?): string`：locale 不支持时回退 zh-CN；按序用 `params` 替换 `{n}` 占位。

消息 key 清单（按现有 throw 站点归纳，实现时以代码为准）：

| key                                | zh-CN（现状）                                 |
| ---------------------------------- | --------------------------------------------- |
| `UNAUTHORIZED`                     | 未登录                                        |
| `FORBIDDEN`                        | 无权限访问                                    |
| `LOGIN_FAILED`                     | 用户名或密码错误                              |
| `ACCOUNT_DISABLED`                 | 账号已禁用                                    |
| `USER_NOT_FOUND`                   | 用户不存在                                    |
| `PASSWORD_OLD_WRONG`               | 旧密码错误                                    |
| `PASSWORD_WEAK`                    | （取自 `PASSWORD_STRENGTH_MESSAGE`）          |
| `FILE_TYPE_UNSUPPORTED`            | 不支持的素材文件类型                          |
| `FILE_REQUIRED`                    | 请选择上传文件 / 未上传文件                   |
| `FILE_TOO_LARGE`                   | 素材文件不能超过100MB                         |
| `SCREEN_SPLIT_MISMATCH`            | 屏幕方向与分屏类型不匹配                      |
| `STORE_NOT_FOUND`                  | 门店不存在                                    |
| `STORE_CODE_EXISTS`                | 门店编码已存在                                |
| `STORE_HAS_DEVICES`                | 门店下存在设备，无法删除                      |
| `STORE_NOT_EXISTS`                 | 所属门店不存在 / 门店不存在（导入行）         |
| `DEVICE_NOT_FOUND`                 | 设备不存在                                    |
| `DEVICE_CODE_EXISTS`               | 设备编码已存在                                |
| `MATERIAL_NOT_FOUND`               | 素材不存在                                    |
| `MATERIAL_IN_USE`                  | 该素材已被使用在节目中，无法删除              |
| `MATERIAL_REJECT_REASON_TOO_SHORT` | 驳回原因至少10个字符                          |
| `MATERIAL_NOT_FOUND_IDS`           | 素材不存在: {0}                               |
| `MATERIAL_NOT_APPROVED_IDS`        | 素材未审核通过: {0}                           |
| `PROGRAM_NOT_FOUND`                | 节目不存在                                    |
| `PUBLISH_PLAN_NOT_FOUND`           | 发布计划不存在                                |
| `PROGRAM_NOT_PUBLISHED`            | 节目未发布                                    |
| `PUBLISH_TARGET_STORES_INVALID`    | 部分目标门店不存在或已禁用                    |
| `PUBLISH_PLAN_DISABLED`            | 发布计划未启用                                |
| `ADMIN_NOT_FOUND`                  | 管理员不存在                                  |
| `ADMIN_USERNAME_EXISTS`            | 用户名已存在                                  |
| `ROLE_NOT_FOUND`                   | 所选角色不存在 / 角色不存在                   |
| `ROLE_NAME_EXISTS`                 | 角色名称已存在                                |
| `ROLE_HAS_ADMINS`                  | 角色下存在管理员，无法删除                    |
| `ROLE_SUPER_PROTECTED`             | 超级管理员角色不可删除/不可改 menuIds         |
| `MENU_NOT_FOUND`                   | 菜单不存在                                    |
| `MENU_PARENT_NOT_FOUND`            | 父菜单不存在                                  |
| `MENU_HAS_CHILDREN`                | 菜单下存在子菜单，无法删除                    |
| `EXCEL_PARSE_FAILED`               | 无法解析 Excel 文件，请确认上传的是 xlsx 文件 |
| `EXCEL_EMPTY`                      | Excel 文件无数据                              |
| `EXCEL_EMPTY_ROWS`                 | Excel 文件无数据行                            |
| `CREATE_FAILED`                    | 创建失败                                      |
| `VALIDATION_ERROR`                 | 参数校验失败（通用兜底，若需）                |
| `INTERNAL_ERROR`                   | 内部服务器错误                                |

> 上表为归纳，实际 key 以实现时代码为准；新增/合并 key 须保证 zh-CN 与现状逐字一致。

### 5.3 BusinessException 改造

```ts
constructor(
  key: ErrorMessageKey,
  params: unknown[] = [],
  businessCode: BusinessErrorCodeValue = BusinessErrorCode.BUSINESS_RULE_VIOLATION,
  status: HttpStatus = HttpStatus.BAD_REQUEST,
  details: unknown = null,
)
```

- `super({ code: businessCode, message: resolveErrorMessage(key, params, 'zh-CN'), data: details }, status)` —— 默认 zh-CN，保证 `.message` 与现有测试断言一致。
- 新增只读 `messageKey: ErrorMessageKey`、`messageParams: unknown[]`。
- `PASSWORD_STRENGTH_MESSAGE` 常量（`create-admin.dto.ts`）保留导出供前端/复用，但 throw 改用 `PASSWORD_WEAK` key。

### 5.4 AllExceptionsFilter 改造

- 从 `request.headers['accept-language']` 取 locale（经 `resolveLocale`）。
- `exception instanceof BusinessException` → `message = resolveErrorMessage(err.messageKey, err.messageParams, locale)`。
- 通用 HTTP 兜底（401/403/404/500）→ 对应 `UNAUTHORIZED`/`FORBIDDEN`/`NOT_FOUND`/`INTERNAL_ERROR` 按 locale 解析。
- ValidationPipe 产生的 `HttpException`（`responseObject.message` 为数组）：保持现状，不本地化（符合 §1.2）。

### 5.5 throw 站点迁移

按模块逐一将 `throw new BusinessException('中文', code, status)` 改为 `throw new BusinessException(KEY, params?, code, status)`。代表文件：

- `common/guards/permission.guard.ts`
- `common/utils/file.ts`、`common/utils/layout.ts`
- `modules/auth/auth.service.ts`
- `modules/device/device.service.ts`（含 `batchImport`/`validateRow`）、`modules/device/device.controller.ts`
- `modules/device-api/device-api.service.ts`
- `modules/material/material.service.ts`、`modules/program/program.service.ts`、`modules/publish/publish.service.ts`、`modules/store/store.service.ts`
- `modules/system/admin|role|menu/*.service.ts`

### 5.6 Excel 导入失败 reason 本地化

- `device.controller.ts` `/import`：从请求头取 locale 传入 `batchImport(file, locale)`。
- `batchImport`/`validateRow`/`assertStoreExists` 等 reason 生成处改用 `resolveErrorMessage(key, params, locale)`。
- 事务回退逐条创建的 fallback：`e.message`（Prisma 原始错误）保留原文；`'创建失败'` → `CREATE_FAILED` 本地化。
- 无 `Accept-Language` 时 locale=zh-CN，`device.service.spec.ts` 的 `stringContaining('门店不存在')` 仍通过。

### 5.7 测试

- 现有 spec 全部保持绿（zh-CN 默认不变是关键不变量）。
- 新增 `error-messages.spec.ts`：三语解析、占位替换、locale 回退。
- 在 `permission.guard.spec.ts` 或新增 filter 行为用例中，覆盖"`Accept-Language: en/ja` 时 filter 返回对应语言 message"。

---

## 6. 前端设计

### 6.1 目录结构（新增/改动）

```
apps/admin/src/router/index.ts        # 改：仅静态路由
apps/admin/src/router/dynamic.ts      # 新：componentMap + buildDynamicRoutes
apps/admin/src/stores/permission.ts   # 改：动态注册/移除路由
```

### 6.2 路由拆分

`router/index.ts` 仅保留：

- `/login`（懒加载 Login.vue）
- `/`（MainLayout 外壳，`name: 'Layout'`，`redirect: '/dashboard'`，无 children）
- `/:pathMatch(.*)*`（NotFound）

删除原有 10 个业务 children 路由。

### 6.3 dynamic.ts

- `componentMap: Record<string, () => Promise<unknown>>`，key 为菜单 `path`（带前导斜杠，与 seed 一致），value 为 `() => import('@/views/...')`。覆盖：`/dashboard`、`/store`、`/device`、`/material`、`/program`、`/publish`、`/system/admin`、`/system/role`、`/system/menu`、`/system/log`。
- `buildDynamicRoutes(menuTree: MenuTreeNode[]): RouteRecordRaw[]`：递归遍历，对 `type === MenuType.MENU` 且 `path` 且 `componentMap[path]` 命中的节点，生成 `{ path: path.replace(/^\//, ''), name: 'menu_' + node.id, component, meta: { title, icon, permission: node.permission } }`。按钮（type=3）/目录（type=1）节点跳过。

### 6.4 permissionStore 扩展

- `isRoutesAdded: ref(false)`、`addedRouteNames: string[]`（模块内或 state）。
- `fetchMenus()`：拉菜单后 `import router from '@/router'`，对 `buildDynamicRoutes(menuTree)` 每条 `router.addRoute('Layout', route)`，记录 name，置 `isRoutesAdded=true`。
- `reset()`：逐条 `router.removeRoute(name)`，清空，`isRoutesAdded=false`。

### 6.5 路由守卫

`router.beforeEach`：

1. 未登录访问受保护 → `/login`。
2. 已登录访问 `/login` → `/`。
3. 已登录且 `!permissionStore.isRoutesAdded` → `await fetchMenus()` → `next({ ...to, replace: true })` 重新解析后 return（使动态路由生效）。
4. `meta.permission` 校验保留作防御；未授权 → `/dashboard`。

### 6.6 首屏重定向

Layout 根 `redirect: '/dashboard'` 保留（seed 中 operator 与超管均含 dashboard #1）。

### 6.7 登出清理

`userStore.logout()` 须调用 `permissionStore.reset()`（探查确认，若未调用则补），由 `reset` 移除动态路由，避免再次登录 `addRoute` 名称冲突。

### 6.8 验证

- `pnpm --filter @adspread/admin run build`（vue-tsc && vite build）通过。
- 手工：admin 登录后所有路由可访问；operator 登录后 `/system/admin` 不可达（落 NotFound）；登出再以另一账号登录路由表正确刷新。

---

## 7. 文档同步

- 修订 `docs/architecture/信发系统_技术设计文档.md`：
  - §5.4 错误处理：移除"错误消息暂保持中文，列为后续增强"，改为按 `Accept-Language` 三语返回；注明 class-validator 字段级消息仍为英文。
  - §5.5.3 / §7.4.3 前端路由：移除"组件级动态加载列为后续增强"，改为按权限动态注册路由。
- 修订第二阶段设计规格 `2026-06-26-adspread-phase2-rbac-audit-i18n-excel-design.md` §1.1 / §10：将两项从"不做/后续"移除或标注已由本增强落实。
- 更新 `docs/api/README.md` 错误响应说明（若存在相关段落）。

---

## 8. 验证策略

1. 后端：`pnpm --filter @adspread/backend run build`、`cd apps/backend && npx jest --runInBand` 全绿（现有 137 + 新增 i18n 用例）。
2. 前端：`pnpm --filter @adspread/admin run build` 通过。
3. 集成/单元覆盖：
   - `resolveErrorMessage` 三语 + 占位 + 回退。
   - `AllExceptionsFilter` 按 `Accept-Language` 返回 ja/en/zh-CN。
   - Excel 导入 reason 随 locale 变化（zh-CN 默认不破现有断言）。
4. 手工验收：
   - 切换前端语言后触发业务错误，`ElMessage` 展示对应语言。
   - admin/operator 路由表差异；未授权路由不可达；登出再登录路由刷新。
5. 在 `docs/superpowers/reviews/` 产出本增强验证记录。

---

## 9. 风险与取舍

- **现有测试断言中文 `.message`**：通过让 `BusinessException` 默认 zh-CN 解析传入 `super` 保持不变量；zh-CN 翻译逐字复制现状。迁移时须逐处核对，避免笔误导致测试红。
- **throw 站点多且分散**：约 50 处，跨 11+ 文件；须逐文件迁移并保证 build + 全量 test 通过。缓解：完整 key 清单 + 全量 jest 验证。
- **动态路由名称冲突**：登出未清理则再次 `addRoute` 同名路由冲突。缓解：`reset` 逐条 `removeRoute`，守卫以 `isRoutesAdded` 守护只注册一次。
- **首屏重定向**：依赖 dashboard 必授权（seed 保证）。若未来出现无 dashboard 权限的角色，需改为重定向到第一个可见菜单（列为后续）。
- **locale 默认 zh-CN**：后端对无 `Accept-Language` 的调用方默认 zh-CN，保持当前行为；前端始终发送 header，正常用户按所选语言返回。

---

## 10. 后续阶段（不在本轮）

- class-validator 字段级校验消息逐装饰器本地化。
- 首屏重定向改为"第一个可见菜单"。
- 权限码集合 Redis 缓存、真实 Socket.io 推送、Android 客户端等（沿用第二阶段 §10）。

**文档结束**
