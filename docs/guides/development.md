# 开发指南

> 本指南面向 ADSpread 项目的开发人员，涵盖开发环境搭建、开发流程、编码规范等内容。

---

## 🚀 快速开始

### 环境要求

| 工具 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | >= 20.0.0 | 推荐使用 LTS 版本 |
| npm | >= 10.0.0 | 包管理器 |
| MySQL | >= 8.0 | 关系型数据库 |
| Redis | >= 7.0 | 缓存服务 |
| Docker | >= 20.0 | 容器化部署 (可选) |

### 本地开发环境搭建

#### 1. 克隆项目

```bash
git clone <repository-url>
cd ADSpread
```

#### 2. 安装依赖

```bash
npm install
```

#### 3. 启动数据库服务

推荐使用 Docker 启动数据库和 Redis：

```bash
docker-compose up -d mysql redis
```

#### 4. 配置环境变量

```bash
# 复制后端环境变量
cp apps/backend/.env.example apps/backend/.env

# 编辑数据库配置
vim apps/backend/.env
```

#### 5. 初始化数据库

```bash
# 生成 Prisma Client
npm run prisma:generate --workspace=@adspread/backend

# 执行数据库迁移
npm run prisma:migrate --workspace=@adspread/backend
```

#### 6. 启动开发服务

```bash
# 启动后端 (端口 3000)
npm run dev:backend

# 启动前端 (端口 5173) - 新开终端
npm run dev:admin
```

#### 7. 访问应用

- 管理后台: http://localhost:5173
- API 文档: http://localhost:3000/api/docs

---

## 📁 项目结构

### Monorepo 结构说明

```
ADSpread/
├── apps/                     # 应用目录
│   ├── backend/              # NestJS 后端服务
│   │   ├── src/
│   │   │   ├── modules/     # 业务模块 (按领域划分)
│   │   │   ├── common/      # 公共工具
│   │   │   ├── filters/     # 异常过滤器
│   │   │   ├── guards/      # 权限守卫
│   │   │   ├── interceptors/ # 拦截器
│   │   │   └── middleware/  # 中间件
│   │   └── prisma/          # 数据库 Schema
│   └── admin/                # Vue3 管理后台
│       ├── src/
│       │   ├── api/         # API 接口封装
│       │   ├── views/       # 页面组件
│       │   ├── components/  # 公共组件
│       │   ├── layouts/     # 布局组件
│       │   ├── stores/      # Pinia 状态管理
│       │   └── router/      # 路由配置
├── packages/                 # 共享包
│   ├── types/               # TypeScript 类型定义
│   └── shared/              # 共享工具函数
├── docs/                     # 项目文档
└── design/                   # 设计资源
```

### 模块创建规范

**后端模块**：每个业务领域一个独立模块

```
modules/store/
├── store.module.ts          # 模块定义
├── store.controller.ts      # 控制器
├── store.service.ts         # 业务逻辑
├── dto/                     # 数据传输对象
│   ├── create-store.dto.ts
│   └── update-store.dto.ts
└── entities/                # 实体定义 (如需要)
```

**前端页面**：按路由层级组织

```
views/store/
├── StoreList.vue            # 列表页
├── StoreDetail.vue          # 详情页
└── StoreForm.vue            # 表单组件
```

---

## 🤖 AI 驱动开发流程

### 标准开发工作流

```
1. 需求理解
   └─ Hermes: 分析需求，输出任务分解清单

2. 任务分配
   └─ Hermes: 按模块分配任务给 Claude Code

3. 代码实现 (并行)
   └─ Claude Code: 按模块实现功能 + 单元测试

4. 代码审查
   └─ Superpower: Code Review + 架构一致性检查

5. 集成测试
   └─ Claude Code: 集成测试 + 端到端验证

6. 发布
   └─ Superpower: 自动化构建 + 部署
```

### 与 AI 交互规范

**给 Claude Code 的任务指令格式**：

```markdown
**任务**: [清晰描述任务目标]
**相关文档**:
- PRD: 链接/位置
- 技术设计: 链接/位置

**验收标准**:
- [ ] 功能点 1
- [ ] 功能点 2
- [ ] 单元测试覆盖 > 80%

**技术约束**:
- 遵循现有架构模式
- 使用项目指定的技术栈
- 遵循编码规范
```

---

## 📝 编码规范

### TypeScript 规范

1. **严格模式**：启用 `strict: true`
2. **禁止 any**：使用 `unknown` 替代，必须做类型守卫
3. **类型导出**：共享类型定义在 `packages/types`
4. **命名规范**：
   - 类名：`PascalCase` (如 `UserService`)
   - 函数/变量：`camelCase` (如 `getUserList`)
   - 常量：`UPPER_SNAKE_CASE` (如 `MAX_RETRY_COUNT`)
   - 类型/接口：`PascalCase` (如 `User`, `IUserService`)

### 后端规范

1. **Controller 层**：只做参数校验和响应封装，不包含业务逻辑
2. **Service 层**：核心业务逻辑，通过 Prisma 操作数据库
3. **DTO 验证**：使用 `class-validator` 做入参校验
4. **错误处理**：抛出自定义异常，由全局过滤器统一处理
5. **日志规范**：使用 NestJS Logger，关键操作必须记录日志

### 前端规范

1. **Composition API**：使用 `<script setup lang="ts">` 语法
2. **状态管理**：简单状态用 `ref`/`reactive`，全局状态用 Pinia
3. **API 调用**：统一使用 `src/utils/request.ts` 封装的请求
4. **组件通信**：Props + Emits，复杂场景用 Pinia
5. **样式规范**：SCSS + BEM 命名，避免深层嵌套

### Git 提交规范

使用 **Conventional Commits** 格式：

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Type 类型**：

| 类型 | 说明 |
|------|------|
| feat | 新功能 |
| fix | Bug 修复 |
| docs | 文档更新 |
| style | 代码格式调整 (不影响运行) |
| refactor | 代码重构 (无功能变更) |
| perf | 性能优化 |
| test | 测试相关 |
| chore | 构建/工具/依赖更新 |

**示例**：

```
feat(store): add industry category management

- 新增门店行业分类字段
- 支持按行业分类筛选和查询
- 添加行业分类枚举类型定义

Closes #123
```

---

## ✅ 代码质量

### 代码检查

```bash
# 运行 ESLint
npm run lint

# 运行 Prettier 格式化
npm run format
```

### 提交前检查

项目已配置 Husky + lint-staged，提交代码时自动执行：

1. ESLint 检查
2. Prettier 格式化
3. Commit message 格式校验

### 测试规范

```bash
# 运行单元测试
npm run test --workspace=@adspread/backend

# 运行测试覆盖率
npm run test:cov --workspace=@adspread/backend
```

---

## 🔗 参考资源

- [产品需求文档](../requirements/信发系统_产品需求文档.md)
- [技术设计文档](../architecture/信发系统_技术设计文档.md)
- [CLAUDE.md](../../CLAUDE.md) - AI 编码规范
- [AGENTS.md](../../AGENTS.md) - Agent 协作协议
