# 任务：信发系统 第二阶段增强（后端错误消息国际化 + 前端动态路由）

## 背景

第二阶段（RBAC + 操作日志 + 多语言 + Excel 导入）已完成并合并（见 `tasks/done/2026-06-26-adspread-phase2-rbac-audit-i18n-excel.md`、`docs/superpowers/reviews/2026-06-26-adspread-phase2-verification.md`）。其设计规格 §1.1 将以下两项明确列为"后续增强"：

1. 后端错误消息的多语言国际化（业务错误消息暂保持中文）。
2. 前端组件级动态加载（路由仍静态注册，仅侧边栏按权限动态渲染）。

本任务落实这两项，使后端业务错误消息随 `Accept-Language` 返回日/中/英三语，前端路由按当前用户菜单权限动态注册。

## 目标

- 后端：`BusinessException` 消息按请求 `Accept-Language` 三语返回；Excel 导入失败 reason 同步本地化；class-validator 字段级消息保持英文。
- 前端：登录后按后端菜单树 `router.addRoute` 动态注册路由，登出移除；未授权路由不可达。

## 范围

### 纳入

- 后端消息目录 `apps/backend/src/common/i18n/error-messages.ts` + 解析器 + 测试。
- `BusinessException`、`AllExceptionsFilter` 改造。
- 全部 `throw new BusinessException` 站点迁移至 key 形式。
- Excel 导入 reason 本地化。
- 前端路由拆分（静态 + dynamic.ts）、`permissionStore` 动态注册/移除、守卫、登出清理。
- 文档同步：技术设计文档、第二阶段 spec §1.1/§10、API README。
- 验证记录。

### 非范围

- class-validator 字段级校验消息逐装饰器本地化（保持英文）。
- 不引入 i18n 第三方框架。
- 不改变 API 路径、权限码、数据模型。

## 相关文件

### 设计与计划

- 设计规格：`docs/superpowers/specs/2026-06-26-adspread-phase2-i18n-dynamic-route-design.md`
- 实施计划：`docs/superpowers/plans/2026-06-26-adspread-phase2-i18n-dynamic-route.md`
- 验证记录：`docs/superpowers/reviews/2026-06-26-adspread-phase2-i18n-dynamic-route-verification.md`（待产出）

### 后端

- `apps/backend/src/common/i18n/error-messages.ts`（新）+ `.spec.ts`
- `apps/backend/src/common/errors/business.exception.ts`
- `apps/backend/src/filters/all-exceptions.filter.ts`
- throw 站点：`common/guards/permission.guard.ts`、`common/utils/{file,layout}.ts`、`modules/{auth,device,device-api,material,program,publish,store}/*.service.ts`、`modules/device/device.controller.ts`、`modules/system/{admin,role,menu}/*.service.ts`

### 前端

- `apps/admin/src/router/index.ts`、`apps/admin/src/router/dynamic.ts`（新）
- `apps/admin/src/stores/permission.ts`、`apps/admin/src/stores/user.ts`

### 文档

- `docs/architecture/信发系统_技术设计文档.md`
- `docs/superpowers/specs/2026-06-26-adspread-phase2-rbac-audit-i18n-excel-design.md`
- `docs/api/README.md`

## 验收标准

- [ ] 后端 `nest build` 通过
- [ ] 后端 `jest --runInBand` 全绿（现有 137 + 新增 i18n 用例）
- [ ] 前端 `vue-tsc && vite build` 通过
- [ ] `BusinessException.message` 默认 zh-CN，与现有中文字符串逐字一致（现有测试不破）
- [ ] `AllExceptionsFilter` 按 `Accept-Language` 返回 ja/zh-CN/en
- [ ] Excel 导入 reason 随 locale 变化，zh-CN 默认不破现有断言
- [ ] 前端动态路由：admin 全路由可达；operator 未授权路由落 NotFound；登出再登录路由刷新无冲突
- [ ] 技术设计文档、第二阶段 spec、API README 同步
- [ ] 验证记录真实可查

## 验证方式

```bash
pnpm --filter @adspread/backend run build
cd apps/backend && npx jest --runInBand
pnpm --filter @adspread/admin run build
```

手工：切换语言触发业务错误观察 message；admin/operator 路由差异；登出再登录。

## 备注

- 实施状态：进行中。
- 子代理派遣：Task 1（后端架构师）、Task 2（前端开发者）并行；Task 3（技术文档工程师）后续；Task 4 验证记录。
