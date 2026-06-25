# 后端规范（apps/backend）

本规范仅适用于 `apps/backend`。处理后端任务时，本文件应在 `.ai/coding-standards.md` 之后阅读，并与通用规范共同生效。

## 技术栈边界

- 后端是 NestJS + TypeScript 服务。
- 不将前端、Android 或其他端的实现约束套用到后端。
- 修改前先查看当前模块的既有结构和命名，按局部模式实现。

## 模块组织

- 按业务领域组织模块。
- 常见模块结构包括：`controller`、`service`、`dto`、`entities` 或 Prisma 相关文件。
- 新增文件时优先放在对应业务模块目录下，不为单次使用创建跨模块抽象。

## Controller 层

- Controller 只处理 HTTP 层职责：路由、参数接收、认证上下文、响应封装。
- 不在 Controller 中写核心业务逻辑。
- 参数校验优先依赖 DTO 和验证管道，不把大量校验逻辑散落在 Controller 方法中。

## Service 层

- Service 承载核心业务逻辑。
- 数据访问应通过 Prisma 或项目既有数据访问方式完成。
- 复杂逻辑应拆成有明确业务含义的私有方法，避免为了抽象而抽象。

## DTO 与输入校验

- 入参 DTO 使用 `class-validator` 表达校验规则。
- DTO 字段类型应与接口文档、前端调用和数据库含义保持一致。
- 新增或变更接口时，同步更新 `packages/api-contracts/` 或 `docs/api/` 中对应契约说明。

## 错误处理

- 业务错误应明确抛出异常，不吞掉错误。
- 使用项目既有的统一异常处理方式返回错误。
- 不在 catch 中静默忽略异常；如需降级，必须说明降级行为和日志。

## 日志

- 使用 NestJS Logger 或项目既有日志方式。
- 关键业务操作、异常路径和外部依赖失败应记录必要日志。
- 日志不得包含密码、令牌或敏感个人信息。

## 后端验证命令

优先运行与后端改动最相关的命令：

```bash
# 后端单元测试
npm run test --workspace=@adspread/backend

# 后端覆盖率
npm run test:cov --workspace=@adspread/backend
```

涉及 Prisma 或数据库结构变更时，先查看 `apps/backend` 下的 package scripts，再运行项目已有的 Prisma generate/migrate 命令；不要凭空添加迁移流程。
