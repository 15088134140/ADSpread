# 信发系统管理端与服务端 第二阶段设计规格（RBAC + 操作日志 + 多语言 + Excel 导入）

**日期**: 2026-06-26
**范围**: 在第一阶段 MVP 基础上补齐 PRD v1.x 的管理端与服务端功能
**参考文档**:

- [产品需求文档](../../requirements/信发系统_产品需求文档.md)
- [技术设计文档](../../architecture/信发系统_技术设计文档.md)
- [第一阶段 MVP 设计规格](./2026-06-25-adspread-admin-backend-mvp-design.md)
- [第一阶段验证记录](../reviews/2026-06-25-adspread-admin-backend-mvp-verification.md)

---

## 1. 背景与目标

第一阶段 MVP（登录、门店、设备、素材审核、节目、发布、设备拉取接口）已完成并通过验证。MVP 设计规格 §3.2 明确将以下 v1.x 功能推迟到后续阶段：

- 完整 RBAC：管理员账号、角色管理、菜单管理 CRUD
- 动态菜单权限过滤
- 完整多语言切换
- 完整操作日志页面与全链路审计
- Excel 批量导入设备

本设计落实上述功能，使管理后台达到 PRD/技术设计文档描述的完整 v1.x 形态。

### 1.1 本轮明确不做

- Android 客户端（任何形态）。
- 真实 Socket.io 设备长连接、ack、失败重试队列。
- 设备心跳上报接口（`POST /api/device/heartbeat`）。
- v2.x 后续规划：统计报表、素材标签、节目优先级、时段轮播、APK 升级。
- 后端错误消息的多语言国际化（业务错误码已统一；错误消息暂保持中文，列为后续增强）。
- 前端组件级动态加载（路由仍静态注册，仅侧边栏菜单按权限动态渲染）。

### 1.2 完成后应能验证的闭环

管理员登录（默认日语界面）→ 侧边栏按角色权限动态渲染菜单 → 新建角色并勾选菜单权限 → 新建管理员绑定角色 → 该账号登录仅见授权菜单且无权接口被拒绝 → 上述所有写操作在操作日志页可查 → 设备页通过 Excel 批量导入设备并看到成功/失败反馈 → 在日/中/英之间切换界面语言并记忆选择。

---

## 2. 标准参照与文档对齐原则

延续 MVP 设计规格的对齐原则：

1. 本轮功能严格对齐 PRD 与技术设计文档的 v1.x 描述。
2. 代码与文档不一致时，默认修改代码；若文档描述与既有 schema/实现冲突且实现更合理，则同步修订文档。
3. PRD 与技术设计文档冲突时，先列冲突、给统一方案、改文档、再实现。
4. 不做伪实现：未纳入功能明确列为后续阶段。

### 2.1 本轮发现的文档/代码偏差及处理

| 偏差             | 现状                                                                                                                      | 处理                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 行业分类枚举命名 | `packages/types` 用 `HOTEL`/`LIFE_SERVICE`，Prisma 用 `HOSPITALITY`/`LOCAL_LIFE`                                          | 以 Prisma 为准，修正共享类型，同步文档                   |
| 角色菜单权限模型 | 技术设计文档描述 `role_menu_permissions` 中间表；代码用 `Role.menuIds: number[]`（Json）                                  | 以代码为准（更轻量、与 seed 一致），修订技术设计文档该节 |
| 操作日志字段命名 | 技术设计文档用 `operation_type/target_type/target_id/content`；代码 `OperationLog` 用 `operation/method/params/menuId` 等 | 以代码为准，修订技术设计文档 §4.2.10                     |
| 默认语言         | PRD §4.12 规定默认日语；`main.ts` 现默认 `zh-CN`                                                                          | 改为默认日语                                             |
| 接口权限校验     | PRD 要求每个请求按角色权限校验；MVP 仅 JWT 校验                                                                           | 本轮全量接口加 `PermissionGuard`                         |

---

## 3. 范围与边界

### 3.1 纳入本轮的功能

#### 3.1.1 RBAC 与动态菜单

- 管理员账号管理：列表、新增、编辑、启用/禁用、重置密码、修改自己的密码。
- 角色管理：列表、新增、编辑、删除（有管理员关联时不可删）、复制、选项列表、分配菜单权限。
- 菜单管理：树形列表、新增、编辑、删除（有子菜单时不可删）、选项列表。
- 超级管理员角色（seed 已建，名称约定 `超级管理员`）自动拥有全部启用菜单，不可删除、不可修改其菜单权限。
- 登录后前端调用 `GET /api/auth/menus` 获取当前用户可见菜单树，动态渲染侧边栏。
- 路由静态注册，路由守卫按当前用户菜单权限拦截未授权路由。

#### 3.1.2 接口权限校验（全量）

- 全局 `PermissionGuard`，所有受保护接口通过 `@RequirePermission('xxx:yyy')` 声明所需权限码。
- 权限码来自菜单 `permission` 字段；角色 `menuIds` 授权后派生该角色有效权限码集合。
- 超级管理员放行所有接口。
- 公开接口（登录、设备拉取节目等）用 `@Public()` 装饰器放行，不经过权限校验。
- MVP 既有业务控制器（门店/设备/素材/节目/发布）补 `@RequirePermission` 装饰器。

#### 3.1.3 操作日志全链路审计

- NestJS 拦截器 `OperationLogInterceptor` + `@OperationLog(operation, targetType)` 装饰器，自动记录写操作。
- 记录字段：adminId、username、operation、method、params、耗时、ip、userAgent、status、errorMsg、关联 menuId（可选）。
- 登录成功、登出在 `AuthService` 内显式记录（非控制器写操作，拦截器覆盖不到）。
- 操作日志列表页：按用户名、操作类型、对象类型、时间范围筛选，分页。
- 需记录的操作类型对齐技术设计文档 §4.2.10：login/logout、store/device/material/program/publish_plan/admin/role/menu 的 create/update/delete、material audit、device batch import、publish push/batch-push 等。

#### 3.1.4 多语言切换

- 前端全量 i18n：日语、中文简体、英语三种语言。
- 默认日语（遵 PRD §4.12），`localStorage('locale')` 记忆用户选择。
- Header 语言切换器，Element Plus locale 响应式联动。
- 翻译文件按模块拆分：common、menu、store、device、material、program、publish、system、validation。
- 既有 MVP 页面（门店/设备/素材/节目/发布/登录/仪表盘）硬编码中文迁移为 `t()` key。

#### 3.1.5 Excel 批量导入设备

- 后端 `POST /api/devices/import`：multer `FileInterceptor('file')` 接收 xlsx，解析、逐行校验、事务批量创建。
- 返回 `{ successCount, failCount, failures: [{ row, field?, reason }] }`。
- 后端 `GET /api/devices/import-template`：生成并下载 xlsx 模板。
- 前端 `ExcelImportDialog` 组件：拖拽/点击选文件、上传进度、结果表格（失败行列出原因）、下载模板。
- 接入 `DeviceList.vue`"批量导入"按钮。
- 导入操作记操作日志。

### 3.2 不纳入本轮的功能

见 §1.1。

---

## 4. 数据模型

本轮**不新增数据表**，复用既有 Prisma 模型。仅扩展 seed 数据与共享类型。

### 4.1 复用模型要点

- `Admin`：`roleId` 关联 `Role`；`status` 1启用/0禁用；`lastLoginAt`/`lastLoginIp`。
- `Role`：`name` 唯一；`menuIds Json?` 存授权菜单 ID 数组；`status`。超级管理员角色由名称 `超级管理员` 约定识别。
- `Menu`：`parentId` 自关联树；`type` 1目录/2菜单/3按钮；`permission` 权限码（如 `device:list`）；`path`/`icon`/`sort`/`status`/`component`。
- `OperationLog`：字段以现有 schema 为准（`operation`/`method`/`params`/`time`/`ip`/`userAgent`/`status`/`errorMsg` 等），不按技术设计文档旧命名重命名。

### 4.2 Seed 扩展

扩展 `apps/backend/prisma/seed.ts`：

1. seed 系统菜单树，含权限码。结构（示意）：

   - 仪表盘 `dashboard`（`dashboard:view`）
   - 门店管理 `store`（`store:list`/`store:create`/`store:update`/`store:delete`）
   - 设备管理 `device`（`device:list`/`device:create`/`device:update`/`device:delete`/`device:import`）
   - 素材管理 `material`（`material:list`/`material:upload`/`material:audit`/`material:delete`）
   - 节目制作 `program`（`program:list`/`program:create`/`program:update`/`program:publish`/`program:delete`）
   - 发布管理 `publish`（`publish:list`/`publish:create`/`publish:update`/`publish:delete`/`publish:push`）
   - 系统管理 `system`（目录）
     - 管理员 `system/admin`（`admin:list`/`admin:create`/`admin:update`/`admin:reset-password`）
     - 角色 `system/role`（`role:list`/`role:create`/`role:update`/`role:delete`/`role:assign`）
     - 菜单 `system/menu`（`menu:list`/`menu:create`/`menu:update`/`menu:delete`）
     - 操作日志 `system/log`（`log:list`）

2. 超级管理员角色 `menuIds` 留空（运行时识别为全部）；如需显式授权，可写入全部菜单 ID——二者等价，实现取其一并注明。

### 4.3 共享类型对齐（`packages/types/src/index.ts`）

- 修正 `IndustryCategory` 枚举：`HOTEL → HOSPITALITY`、`LIFE_SERVICE → LOCAL_LIFE`，与 Prisma 一致。
- 同步修正 `IndustryCategoryLabels` 及任何引用处。
- 新增/补全：`Admin`/`Role`/`Menu`/`OperationLog` 的响应与 DTO 类型、`MenuType` 枚举（1目录/2菜单/3按钮）、`ImportResult` 类型。

### 4.4 初始化数据规格（seed）

本节为 `apps/backend/prisma/seed.ts` 的精确依据。菜单采用**三级建模**：`type=1` 目录、`type=2` 菜单（有 `path`）、`type=3` 按钮（无 `path`，仅 `permission`）。按钮节点挂在所属菜单下；角色通过 `menuIds` 勾选到按钮级，派生权限码集合。

#### 4.4.1 菜单初始数据

下表为 seed 菜单完整清单。`parentId` 指向同表序号；`sort` 同级排序，数字越小越靠前；`icon` 为 Element Plus 图标组件名；`path` 为前端路由（按钮节点留空）；`permission` 为权限码（目录节点留空）。

| #   | 名称(name)     | parentId | type | path          | icon      | sort | permission           |
| --- | -------------- | -------- | ---- | ------------- | --------- | ---- | -------------------- |
| 1   | 仪表盘         | -        | 2    | /dashboard    | Odometer  | 1    | dashboard:view       |
| 2   | 门店管理       | -        | 2    | /store        | Shop      | 2    | store:list           |
| 3   | ├ 新增门店     | 2        | 3    |               |           | 1    | store:create         |
| 4   | ├ 编辑门店     | 2        | 3    |               |           | 2    | store:update         |
| 5   | └ 删除门店     | 2        | 3    |               |           | 3    | store:delete         |
| 6   | 设备管理       | -        | 2    | /device       | Monitor   | 3    | device:list          |
| 7   | ├ 新增设备     | 6        | 3    |               |           | 1    | device:create        |
| 8   | ├ 编辑设备     | 6        | 3    |               |           | 2    | device:update        |
| 9   | ├ 删除设备     | 6        | 3    |               |           | 3    | device:delete        |
| 10  | └ 批量导入     | 6        | 3    |               |           | 4    | device:import        |
| 11  | 素材管理       | -        | 2    | /material     | Picture   | 4    | material:list        |
| 12  | ├ 上传素材     | 11       | 3    |               |           | 1    | material:upload      |
| 13  | ├ 审核素材     | 11       | 3    |               |           | 2    | material:audit       |
| 14  | └ 删除素材     | 11       | 3    |               |           | 3    | material:delete      |
| 15  | 节目制作       | -        | 2    | /program      | Film      | 5    | program:list         |
| 16  | ├ 新建节目     | 15       | 3    |               |           | 1    | program:create       |
| 17  | ├ 编辑节目     | 15       | 3    |               |           | 2    | program:update       |
| 18  | ├ 发布节目     | 15       | 3    |               |           | 3    | program:publish      |
| 19  | └ 删除节目     | 15       | 3    |               |           | 4    | program:delete       |
| 20  | 发布管理       | -        | 2    | /publish      | Promotion | 6    | publish:list         |
| 21  | ├ 新建计划     | 20       | 3    |               |           | 1    | publish:create       |
| 22  | ├ 编辑计划     | 20       | 3    |               |           | 2    | publish:update       |
| 23  | ├ 删除计划     | 20       | 3    |               |           | 3    | publish:delete       |
| 24  | └ 立即推送     | 20       | 3    |               |           | 4    | publish:push         |
| 25  | 系统管理       | -        | 1    |               | Setting   | 7    |                      |
| 26  | ├ 管理员       | 25       | 2    | /system/admin | User      | 1    | admin:list           |
| 27  | │ ├ 新增管理员 | 26       | 3    |               |           | 1    | admin:create         |
| 28  | │ ├ 编辑管理员 | 26       | 3    |               |           | 2    | admin:update         |
| 29  | │ └ 重置密码   | 26       | 3    |               |           | 3    | admin:reset-password |
| 30  | ├ 角色         | 25       | 2    | /system/role  | Avatar    | 2    | role:list            |
| 31  | │ ├ 新增角色   | 30       | 3    |               |           | 1    | role:create          |
| 32  | │ ├ 编辑角色   | 30       | 3    |               |           | 2    | role:update          |
| 33  | │ ├ 删除角色   | 30       | 3    |               |           | 3    | role:delete          |
| 34  | │ └ 分配权限   | 30       | 3    |               |           | 4    | role:assign          |
| 35  | ├ 菜单         | 25       | 2    | /system/menu  | Menu      | 3    | menu:list            |
| 36  | │ ├ 新增菜单   | 35       | 3    |               |           | 1    | menu:create          |
| 37  | │ ├ 编辑菜单   | 35       | 3    |               |           | 2    | menu:update          |
| 38  | │ └ 删除菜单   | 35       | 3    |               |           | 3    | menu:delete          |
| 39  | └ 操作日志     | 25       | 2    | /system/log   | Document  | 4    | log:list             |

说明：

- 目录节点（#25 系统管理）无 `path`/`permission`，仅作侧边栏分组。
- 菜单节点（type=2）的 `permission` 同时代表"进入页面"权限，与列表查看权限合并（如 `store:list` 既控制路由进入也控制列表接口）。
- 按钮节点（type=3）无 `path`，仅用于按钮显隐与接口授权。
- `/api/auth/menus` 返回树时，按钮节点作为子项返回，前端用于按钮级判断。

#### 4.4.2 接口 ↔ 权限码映射

下表确保 §5.2 守卫、§5.4 路由与 §4.4.1 菜单 `permission` 三者一致。公开接口（`@Public`）不在此表。

| 接口                                                                  | 方法   | 权限码               |
| --------------------------------------------------------------------- | ------ | -------------------- |
| `/api/stores`                                                         | GET    | store:list           |
| `/api/stores`                                                         | POST   | store:create         |
| `/api/stores/:id`                                                     | PUT    | store:update         |
| `/api/stores/:id`                                                     | DELETE | store:delete         |
| `/api/stores/industry-categories` `/api/stores/options`               | GET    | store:list           |
| `/api/devices`                                                        | GET    | device:list          |
| `/api/devices`                                                        | POST   | device:create        |
| `/api/devices/:id`                                                    | PUT    | device:update        |
| `/api/devices/:id`                                                    | DELETE | device:delete        |
| `/api/devices/import`                                                 | POST   | device:import        |
| `/api/devices/import-template`                                        | GET    | device:import        |
| `/api/devices/resolutions` `/api/devices/split-types`                 | GET    | device:list          |
| `/api/materials` `/api/materials/available`                           | GET    | material:list        |
| `/api/materials/upload`                                               | POST   | material:upload      |
| `/api/materials/:id/approve` `/api/materials/:id/reject`              | POST   | material:audit       |
| `/api/materials/:id`                                                  | DELETE | material:delete      |
| `/api/programs`                                                       | GET    | program:list         |
| `/api/programs`                                                       | POST   | program:create       |
| `/api/programs/:id`                                                   | PUT    | program:update       |
| `/api/programs/:id/publish`                                           | POST   | program:publish      |
| `/api/programs/:id`                                                   | DELETE | program:delete       |
| `/api/publish`                                                        | GET    | publish:list         |
| `/api/publish`                                                        | POST   | publish:create       |
| `/api/publish/:id`                                                    | PUT    | publish:update       |
| `/api/publish/:id`                                                    | DELETE | publish:delete       |
| `/api/publish/:id/push` `/api/publish/batch-push`                     | POST   | publish:push         |
| `/api/publish/:id/status`                                             | PATCH  | publish:update       |
| `/api/admin/admins`                                                   | GET    | admin:list           |
| `/api/admin/admins`                                                   | POST   | admin:create         |
| `/api/admin/admins/:id`                                               | PUT    | admin:update         |
| `/api/admin/admins/:id`                                               | DELETE | admin:update         |
| `/api/admin/admins/:id/reset-password`                                | POST   | admin:reset-password |
| `/api/admin/roles` `/api/admin/roles/options`                         | GET    | role:list            |
| `/api/admin/roles`                                                    | POST   | role:create          |
| `/api/admin/roles/:id`                                                | PUT    | role:update          |
| `/api/admin/roles/:id`                                                | DELETE | role:delete          |
| `/api/admin/roles/:id/menus` (分配权限)                               | PUT    | role:assign          |
| `/api/admin/menus` `/api/admin/menus/tree` `/api/admin/menus/options` | GET    | menu:list            |
| `/api/admin/menus`                                                    | POST   | menu:create          |
| `/api/admin/menus/:id`                                                | PUT    | menu:update          |
| `/api/admin/menus/:id`                                                | DELETE | menu:delete          |
| `/api/admin/logs`                                                     | GET    | log:list             |
| `/api/auth/me` `/api/auth/menus`                                      | GET    | @AuthenticatedOnly   |
| `/api/auth/logout` `/api/auth/change-password`                        | POST   | @AuthenticatedOnly   |
| `/api/device/program`                                                 | GET    | @Public              |

三类标记：

- `@Public`：完全公开，不经过认证与授权（登录、设备拉取节目）。
- `@AuthenticatedOnly`：仅需登录，不挂权限码。用于任意登录用户都可访问的接口（`/api/auth/me`/`/api/auth/menus`/`/api/auth/logout`/`/api/auth/change-password`）。`PermissionGuard` 命中该标记且 `request.user` 存在即放行。
- `@RequirePermission(code)`：需要指定权限码。

**严格兜底**：受保护接口（既无 `@Public` 也无 `@AuthenticatedOnly` 又未声明 `@RequirePermission`）一律 403 拒绝。这强制所有受保护接口必须显式声明权限码或标记，避免漏挂导致越权。MVP 既有业务控制器须逐一补齐 `@RequirePermission`（见 §5.7），否则启动后这些接口将返回 403。

#### 4.4.3 角色与账号初始数据

| 字段      | 超级管理员                            | 运营人员         |
| --------- | ------------------------------------- | ---------------- |
| `name`    | 超级管理员                            | 运营人员         |
| `remark`  | MVP 默认管理员角色                    | 业务运营示例角色 |
| `status`  | 1                                     | 1                |
| `menuIds` | 留空 `[]`（运行时识别为全部启用菜单） | 见下             |

运营人员角色 `menuIds` 授权范围（用于验证权限隔离）：

- 仪表盘 #1
- 门店管理 #2 + 新增 #3 + 编辑 #4（不含删除 #5）
- 设备管理 #6 + 新增 #7 + 编辑 #8 + 批量导入 #10（不含删除 #9）
- 素材管理 #11 + 上传 #12 + 审核 #13（不含删除 #14）
- 节目制作 #15 + 新建 #16 + 编辑 #17 + 发布 #18（不含删除 #19）
- 发布管理 #20 + 新建 #21 + 编辑 #22 + 立即推送 #24（不含删除 #23）
- **不含**系统管理 #25 及其全部子项

即运营人员可执行业务全流程的查看与写入，但不可删除任何业务数据，且完全不可见系统管理菜单与接口。

管理员账号：

| username | name       | 角色       | 密码（明文，seed 时 bcrypt 哈希） | status |
| -------- | ---------- | ---------- | --------------------------------- | ------ |
| admin    | 系统管理员 | 超级管理员 | admin123                          | 1      |
| operator | 运营示例   | 运营人员   | operator123                       | 1      |

说明：

- `admin` 沿用 MVP seed；`operator` 为本轮新增，便于手工验收权限隔离（登录后侧边栏无系统管理、删除按钮隐藏、调用删除接口返回 403）。
- 密码强度：示例账号为便于验收使用简单密码，实现时仅约束"新增/修改密码"接口的强度规则（至少 8 位含大小写字母与数字），seed 账号豁免该约束。
- seed 幂等：使用 `upsert`（按 `username`/`name` 唯一键），重复执行不报错；菜单 seed 按 `path`（菜单）或 `name+parentId`（按钮/目录）`upsert`。

---

## 5. 后端设计

### 5.1 目录结构（新增）

```
apps/backend/src/
├── common/
│   ├── decorators/
│   │   ├── public.decorator.ts            # @Public() 放行
│   │   ├── require-permission.decorator.ts # @RequirePermission('xxx')
│   │   └── operation-log.decorator.ts     # @OperationLog(operation, targetType?)
│   ├── guards/
│   │   └── permission.guard.ts            # 全局权限守卫
│   └── interceptors/
│       └── operation-log.interceptor.ts   # 操作日志拦截器
└── modules/
    ├── auth/
    │   ├── auth.controller.ts             # 扩展 /me /logout /menus /change-password
    │   └── auth.service.ts                # 扩展 me/logout/menus/change-password
    ├── device/
    │   ├── device.controller.ts           # 扩展 /import /import-template
    │   └── device.service.ts              # 扩展 batchImport
    └── system/
        ├── system.module.ts
        ├── admin/   (controller/service/dto)
        ├── role/    (controller/service/dto)
        ├── menu/    (controller/service/dto)
        └── log/
            ├── operation-log.service.ts
            └── operation-log.controller.ts
```

### 5.2 权限守卫与装饰器

三个方法级装饰器（互斥）：

- `@Public()`：完全公开，不经过认证与授权（登录、设备拉取节目）。
- `@AuthenticatedOnly()`：仅需登录，不挂权限码（`/api/auth/me` 等任意登录用户可访问的接口）。
- `@RequirePermission(code: string)`：需要指定权限码。

`PermissionGuard`（全局，在 `JwtAuthGuard` 认证之后执行授权）决策逻辑（按顺序短路）：

1. 反射读取 `@Public` → 命中放行。
2. 读取 `request.user`（JWT 已注入）；无 user → 401。
3. 超级管理员（按角色名 `超级管理员` 识别）→ 放行。
4. 反射读取 `@AuthenticatedOnly` → 命中放行（仅需登录）。
5. 反射读取 `@RequirePermission(code)`：
   - 已声明 `code` → 计算当前用户有效权限码集合 `S`，`code ∈ S` 放行，否则 403。
   - **未声明任何标记（既无 `@Public`/`@AuthenticatedOnly` 也无 `@RequirePermission`）→ 一律 403 拒绝**（严格兜底）。
6. 有效权限码集合 `S` 计算：取角色 `menuIds` 对应的、`status=1` 的菜单 `permission` 去重。因 `menuIds` 显式勾选到按钮级（type=3），派生时直接取勾选菜单的 `permission`，不递归子菜单。
7. 权限码集合请求内即时计算；后续可引入 Redis 缓存（本轮不做）。

控制器级用 `@UseGuards(JwtAuthGuard)` 保证认证；授权由全局 `PermissionGuard` 处理。公开控制器不挂 `JwtAuthGuard` 并用 `@Public()`。

**严格兜底的影响**：MVP 既有业务控制器（门店/设备/素材/节目/发布）必须按 §5.7 逐一补齐 `@RequirePermission`，否则这些接口在 `PermissionGuard` 生效后立即返回 403。需在集成测试中覆盖每个接口的权限码声明，防止漏挂。

### 5.3 操作日志

- `@OperationLog(operation: string, targetType?: string)`：方法级装饰器，标注操作类型与对象类型。
- `OperationLogInterceptor`：
  - 捕获 controller 方法调用，记录开始时间。
  - 成功/异常均记录：adminId、username（从 `request.user`）、operation、method、params（请求体/参数，敏感字段如密码脱敏）、耗时、ip、userAgent、status、errorMsg。
  - 异常时抛出原异常，不影响业务流程。
  - 异步写入，不阻塞响应。
- `AuthService.login` 成功后显式写 `login` 日志；`AuthService.logout` 写 `logout` 日志。
- `OperationLogService`：`findAll(query)` 分页筛选；`create(dto)` 供拦截器与 auth 调用。
- 路由：`GET /api/admin/logs`（`log:list` 权限）。

### 5.4 系统管理接口

路由前缀与权限码：

| 模块     | 路由                                                   | 权限码     |
| -------- | ------------------------------------------------------ | ---------- |
| 管理员   | `/api/admin/admins` CRUD + `/reset-password`           | `admin:*`  |
| 角色     | `/api/admin/roles` CRUD + `/options` + `/assign-menus` | `role:*`   |
| 菜单     | `/api/admin/menus` 树 CRUD + `/options`                | `menu:*`   |
| 操作日志 | `/api/admin/logs` 列表                                 | `log:list` |

业务规则：

- 管理员：用户名唯一；密码 bcrypt（轮次 12），至少 8 位含大小写字母与数字（遵 §9.1）；新增时必填角色；禁用管理员无法登录；不可删除自己；重置密码生成临时密码或由管理员设定。
- 角色：名称唯一；有管理员关联时不可删除；超级管理员角色不可删除、不可改其 `menuIds`；分配菜单权限更新 `menuIds`。
- 菜单：`parentId` 可空；有子菜单不可删除；`permission` 按需；树形列表按 `sort` 排序。

### 5.5 认证扩展（`/api/auth/*`）

- `POST /api/auth/login`：已存在，补登录成功日志。
- `POST /api/auth/logout`：新增，写登出日志。前端清除 token。
- `GET /api/auth/me`：返回当前管理员信息（含角色）。
- `GET /api/auth/menus`：返回当前用户可见菜单树（超级管理员返回全部启用菜单；普通用户按 `role.menuIds` 过滤，按钮型菜单一并返回用于按钮级权限判断）。
- `POST /api/auth/change-password`：校验旧密码，设新密码（同强度规则）。

### 5.6 Excel 导入

- `POST /api/devices/import`（`device:import`）：`FileInterceptor('file')`，限制 xlsx；用 `xlsx` 解析为行对象；逐行映射并校验：
  - 必填：name、code、screenOrientation、screenResolution、splitType。
  - 可选：storeId、remark。
  - 复用 `validateSplitType`、`assertStoreExists`、设备编码唯一校验。
  - 事务批量插入；单行失败收集到 `failures`，不中断整体（或事务内全成功/全失败——**采用逐行收集模式**，最大化导入成功率，符合 PRD 体验）。
  - 返回 `{ successCount, failCount, failures: [{ row, field?, reason }] }`。
- `GET /api/devices/import-template`（`device:import` 或 `device:list`）：用 `xlsx` 生成模板流（含表头与示例行、校验提示 sheet），`Content-Disposition` 下载。
- 导入写 `device:batch-import` 操作日志。

### 5.7 既有业务控制器改造

门店/设备/素材/节目/发布控制器：每个路由补 `@RequirePermission` 与 `@OperationLog`：

- 列表 `GET` → `xxx:list`（无操作日志）。
- 新增 `POST` → `xxx:create` + `@OperationLog('create', 'xxx')`。
- 编辑 `PUT` → `xxx:update` + 日志。
- 删除 `DELETE` → `xxx:delete` + 日志。
- 素材审核 → `material:audit` + 日志。
- 节目发布 → `program:publish` + 日志。
- 发布推送/批量推送 → `publish:push` + 日志。

### 5.8 测试

- service 单测：admin/role/menu/log/device.batchImport，覆盖唯一性、关联删除保护、权限码派生、导入失败行收集。
- 集成测试：`/api/admin/*`、`/api/auth/menus`、`/api/auth/me`、`/api/devices/import`、权限拒绝（403）、公开接口放行。
- 复用 `createTestApp`/`loginAndGetToken`；`prisma.service.cleanDatabase` 顺序确认含 operationLog/menu/role/admin。

---

## 6. 前端设计

### 6.1 目录结构（新增）

```
apps/admin/src/
├── api/
│   ├── admin.ts            # 管理员接口
│   ├── role.ts             # 角色接口
│   ├── menu.ts             # 菜单接口
│   ├── operationLog.ts     # 操作日志接口
│   ├── auth.ts             # 扩展 me/logout/menus/change-password
│   └── device.ts           # 扩展 import/importTemplate
├── stores/
│   ├── app.ts              # locale 状态
│   └── permission.ts       # 菜单树、权限码集合、按钮权限判断
├── locales/
│   ├── index.ts
│   ├── ja/{index,common,menu,store,device,material,program,publish,system,validation}.ts
│   ├── zh-CN/...
│   └── en/...
├── components/
│   └── business/
│       └── ExcelImportDialog.vue
└── views/
    └── system/
        ├── AdminList.vue
        ├── RoleList.vue      # 含菜单权限树勾选弹窗
        ├── MenuList.vue      # 树形表 + 弹窗
        └── OperationLogList.vue
```

### 6.2 多语言

- `main.ts`：默认 `locale: localStorage.getItem('locale') || 'ja'`，`fallbackLocale: 'ja'`；注入三语 messages。
- Element Plus locale 响应式：监听 `appStore.locale` 切换 `ConfigProvider` 的 `locale`（或重建 app 配置——采用 `ElConfigProvider` 包裹根组件的方式，避免重建）。
- Header 切换器：`el-dropdown` 或 `el-select`，三选项；切换写 `localStorage` 并即时生效。
- 既有页面 i18n 迁移：所有硬编码中文替换为 `t()` key；表单校验消息、`ElMessage`/`ElMessageBox` 文案一并迁移。

### 6.3 权限 store 与动态菜单

- `stores/permission.ts`：
  - `menuTree`：`GET /api/auth/menus` 结果。
  - `permissions`：扁平权限码 `Set<string>`，用于按钮级判断。
  - `hasPermission(code)`：按钮权限指令/函数。
  - `fetchMenus()`：登录后调用。
- `stores/app.ts`：`locale`，`setLocale`。
- `MainLayout.vue`：侧边栏由 `menuTree` 递归渲染（`el-sub-menu`/`el-menu-item`），支持目录与菜单两级；图标用菜单 `icon` 字段映射 Element Plus 图标组件。
- 路由守卫：`beforeEach` 校验 token；若目标路由 `meta.permission` 不在 `permissions` 集合，跳转 403 或仪表盘；未拉取菜单时先 `fetchMenus`。
- 新增 `v-permission` 指令（可选）或 `hasPermission` 函数控制按钮显隐。

### 6.4 路由

新增静态路由（`meta.permission` 用于守卫）：

- `/system/admin` → `AdminList.vue`（`admin:list`）
- `/system/role` → `RoleList.vue`（`role:list`）
- `/system/menu` → `MenuList.vue`（`menu:list`）
- `/system/log` → `OperationLogList.vue`（`log:list`）

### 6.5 系统管理页面

- `AdminList.vue`：列表 + 筛选 + 新增/编辑弹窗（用户名、姓名、角色、手机、邮箱、状态）+ 重置密码 + 启用禁用。复用 `StoreList.vue` 模板。
- `RoleList.vue`：列表 + 弹窗（名称、备注、状态）+ "分配权限"按钮打开菜单树勾选弹窗（`el-tree` check 严格模式，`menuIds` 双向）+ 复制角色。
- `MenuList.vue`：树形表（`el-table` `tree-props`）+ 弹窗（父菜单、名称、类型、path、icon、permission、sort、状态）。
- `OperationLogList.vue`：列表 + 筛选（用户名、操作类型、对象类型、时间范围）+ 详情弹窗（params/errorMsg）。

### 6.6 Excel 导入组件

- `ExcelImportDialog.vue`：`el-upload` 拖拽区 + "下载模板"按钮 + 上传后展示结果表格（成功数、失败数、失败行明细）。
- `DeviceList.vue`：新增"批量导入"按钮打开该弹窗；导入成功后刷新列表。

### 6.7 请求层

- `utils/request.ts`：响应拦截器错误消息改用 i18n（`t('common.networkError')` 等）；401 处理不变。
- 请求头加 `Accept-Language`（来自 `appStore.locale`）——为后端未来国际化预留，本轮后端不依赖。

---

## 7. 文档同步

- 修订 `docs/architecture/信发系统_技术设计文档.md`：
  - §4.2.6/4.2.8 角色菜单权限模型：`role_menu_permissions` 中间表 → `Role.menuIds`（说明取舍）。
  - §4.2.10 操作日志字段：以代码 `OperationLog` 为准。
  - §5 API 模块划分与接口清单：补 `/api/admin/*`、`/api/auth/menus|me|logout|change-password`、`/api/devices/import|import-template`。
  - 默认语言日语。
- 如 PRD 存在 MVP 范围内与本设计冲突处，一并修订。
- 补/更新 `docs/api/` 接口契约（若存在）。

---

## 8. 验证策略

1. 后端：`pnpm run build --workspace=@adspread/backend`、`pnpm run test --workspace=@adspread/backend -- --runInBand` 全绿。
2. 前端：`pnpm run build --workspace=@adspread/admin`（`vue-tsc && vite build`）通过。
3. 集成测试覆盖：管理员/角色/菜单/日志 CRUD、`/api/auth/menus` 权限过滤、`/api/devices/import` 成功与失败行、权限拒绝 403、公开接口放行。
4. 手工验收清单：
   - 默认管理员登录，侧边栏动态菜单完整。
   - 新建角色勾选部分菜单，新建管理员绑定该角色，登录仅见授权菜单。
   - 未授权接口返回 403，前端无权按钮隐藏。
   - 操作日志页可见登录、CRUD、导入、推送等记录。
   - 设备 Excel 导入：模板下载、合法行导入成功、非法行收集失败原因。
   - 日/中/英切换生效并记忆，Element Plus 组件文案随语言变化。
5. 在 `docs/superpowers/reviews/` 产出第二阶段验证记录。

---

## 9. 风险与取舍

- **i18n 全量迁移工作量最大**：以模块化语言文件控制；逐页迁移并保证三语 key 完整，避免遗漏硬编码。
- **全局权限守卫风险**：采用严格兜底（未声明权限标记的受保护接口一律 403），MVP 既有业务控制器必须逐一补齐 `@RequirePermission`，否则接口不可用。缓解：§4.4.2 完整映射表 + 集成测试覆盖每个接口的权限码声明 + 超级管理员放行约定。漏挂 `@Public`/`@AuthenticatedOnly` 会导致公开接口或登录态接口被误锁，需测试覆盖登录、设备拉取节目、`/api/auth/me` 等路径。
- **Excel 导入逐行校验**：复用既有 `validateSplitType`/`assertStoreExists`/编码唯一逻辑，确保与单条创建行为一致；采用逐行收集失败模式，事务分批提交。
- **操作日志覆盖登录/登出**：拦截器无法覆盖非控制器调用，需在 `AuthService` 显式落库。
- **权限码集合性能**：本轮请求内即时计算，不引入 Redis；后续可缓存（列为后续）。
- **前端动态菜单 vs 静态路由**：路由静态注册 + 守卫拦截，避免组件动态加载复杂度；与 PRD"动态路由"的差距在文档注明。

---

## 10. 后续阶段（不在本轮）

- 真实 Socket.io 推送通道、设备心跳、ack、失败重试。
- Android 客户端。
- 后端错误消息国际化。
- 前端组件级动态加载。
- v2.x：统计报表、素材标签、节目优先级、时段轮播、APK 升级。
- 权限码集合 Redis 缓存。

**文档结束**
