# 任务：信发系统管理端与服务端 MVP

## 背景

基于已批准的设计规格（`docs/superpowers/specs/2026-06-25-adspread-admin-backend-mvp-design.md`）与实施计划（`docs/superpowers/plans/2026-06-25-adspread-admin-backend-mvp.md`），构建管理端 + 服务端 MVP 垂直切片：登录、门店、设备、素材上传/审核、节目、发布计划、推送记录、设备节目查询。

## 目标

交付一个可运行、可验收的 MVP：真实 NestJS + Prisma 后端 + Vue3 + Element Plus 管理端，对齐 PRD 与技术设计，覆盖核心业务闭环。

## 范围

- 共享包契约对齐（`packages/types`、`packages/shared`）：响应格式 `code:0` + 数字 `timestamp`，状态枚举对齐。
- Prisma schema 对齐：设备门店可空、Program 状态 0/1、PublishPlan 启用/停用、新增 PushMessageLog。
- 后端七大模块：auth / store / device / material / program / publish / device-api。
- 前端 API 层、共享工具、5 个管理页面、登录与路由。
- 后端单元测试 + 集成测试（基于真实 MySQL）。
- Swagger 接口文档完善。
- 验证记录与收尾文档。

## 非范围

- 系统管理（管理员/角色/菜单/日志）页面——MVP 隐藏菜单、移除路由。
- WebSocket 实时推送——MVP 用推送日志记录替代。
- Android 端。

## 相关文件

- 后端：`apps/backend/src/{common,modules,filters,interceptors,main.ts}`、`prisma/{schema.prisma,seed.ts}`
- 前端：`apps/admin/src/{api,utils,views,layouts,router}/`
- 共享：`packages/{types,shared}/src/`
- 计划/验证：`docs/superpowers/{plans,specs,reviews}/2026-06-25-*.md`

## 验收标准

- [x] 后端 `nest build` 通过
- [x] 后端 `jest` 全部通过（14 套件 / 32 测试）
- [x] 前端 `vue-tsc && vite build` 通过
- [x] 响应契约：成功 `code:0` + 数字 `timestamp`，错误用业务码
- [x] 前端仅接受 `code === 0`
- [x] Prisma schema 对齐（设备门店可空、Program 0/1、推送日志模型）
- [x] 七大模块业务闭环可人工验收
- [x] Swagger 文档含接口说明/参数描述/示例
- [x] 验证记录文档落地

## 验证方式

- 自动化：`pnpm run build --workspace=@adspread/backend` / `npx jest` / `pnpm run build --workspace=@adspread/admin`
- 人工：登录 → 门店 → 设备 → 素材上传审核 → 节目制作发布 → 发布计划推送 → 设备节目接口
- 数据库：Docker MySQL 8.0 + `prisma db push` + `prisma:seed`

## 备注

### 实施过程中的关键修复（人工验收阶段）

1. **后端 dev 启动失败**：tsconfig `paths` 指向源码 + `incremental` 缓存中毒导致 tsc 不输出 dist。修复：移除 paths、关闭 incremental、清除 tsbuildinfo。
2. **中文文件名乱码**：Multer 以 Latin-1 解析文件名，新增 `decodeFilename` 用 `Buffer.from(name,'latin1').toString('utf8')` 还原。
3. **节目更新 500**：`update` 方法透传整个 DTO 导致 Prisma 报未知字段 `regions`。改为显式构造 updateData。
4. **节目重复发布报错**：移除"已发布就拒绝"限制，允许重新发布并刷新 publishedAt。
5. **device/program 500（两个叠加 bug）**：`programId:{not:null}` Prisma 非法 → 移除；返回值含 BigInt fileSize 无法序列化 → main.ts 全局 `BigInt.prototype.toJSON` polyfill。
6. **日志中间件崩溃**：`main.ts` 用 `app.use(new LoggingMiddleware().use)` 丢失 `this`，移除该行（已由 AppModule consumer 注册）。
7. **发布管理显示优化**：结束时间空显示"永久"、最后推送空显示"-"(dateUtils 兼容空值)；目标门店显示"门店名（启用设备数）"，设备数与推送口径一致（仅统计 status=1）。
8. **素材预览**：新增预览对话框（图片/视频）+ 文件信息描述列表。
9. **弹层交互**：新增/编辑类弹层 `:close-on-click-modal="false"`，避免误触丢失输入。
10. **bcrypt 原生绑定缺失**：改用 bcryptjs（API 兼容）。
11. **Swagger 文档完善**：所有控制器/DTO 补充 `@ApiTags`/`@ApiOperation`/`@ApiProperty` 装饰器。

### 已知遗留

- ESLint 配置缺少 `eslint-config-prettier`（预先存在，非本次引入），lint 命令失败，不影响 build/test。
- element-plus chunk 体积超 500KB 警告（可接受的优化项）。
- 迁移使用 `prisma db push` 而非 `prisma migrate dev`（dev 数据库用户无创建影子库权限）。

### 提交分组

按计划第 4 节分组提交，合并至 main 后删除特性分支。
