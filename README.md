# ADSpread - 信发系统

> 面向连锁门店的广告信息发布系统，基于 AI 驱动开发。

[![AI Powered](https://img.shields.io/badge/AI-Powered-blue)](CLAUDE.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-red)](https://nestjs.com/)
[![Vue3](https://img.shields.io/badge/Vue-3.4-green)](https://vuejs.org/)

## 项目概述

信发系统是一套面向连锁门店的广告信息发布系统，由 **Web 管理后台** 和 **安卓客户端** 两大部分组成：

- **管理后台**：门店管理、设备管理、素材上传管理、广告节目编排、广告分发投放
- **安卓客户端**：安装在门店展示设备，自动拉取广告节目，按屏幕配置分屏展示

## 核心功能

| 模块         | 功能特性                                   |
| ------------ | ------------------------------------------ |
| 🏪 门店管理  | 行业分类（8种）、Excel 批量导入、启用/禁用 |
| 📱 设备管理  | 分屏配置、状态监控、心跳检测               |
| 📁 素材管理  | 多格式支持、审核流程、文件管理             |
| 🎬 节目制作  | 可视化编排、分屏布局、定时播放             |
| 🚀 发布管理  | 批量推送、实时生效、发布计划               |
| 👥 RBAC 权限 | 角色管理、菜单权限、操作日志               |
| 🌍 国际化    | 中文、英语、日语三语言                     |

## 技术栈

### 后端

- **框架**: NestJS 10 + TypeScript
- **数据库**: MySQL 8.0 + Redis 7
- **ORM**: Prisma
- **实时推送**: Socket.io 4.x
- **认证**: JWT + Refresh Token

### 前端

- **框架**: Vue 3 + TypeScript
- **UI 组件**: Element Plus
- **国际化**: Vue I18n 9.x
- **状态管理**: Pinia
- **Excel处理**: SheetJS (xlsx)

### 安卓客户端

- **语言**: Kotlin 1.9+
- **UI 框架**: Jetpack Compose 1.6+
- **架构**: MVVM + Clean Architecture
- **依赖注入**: Hilt
- **网络**: Retrofit + OkHttp
- **图片加载**: Coil
- **视频播放**: ExoPlayer
- **本地数据库**: Room
- **实时推送**: Socket.io

### DevOps

- **容器化**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **代码质量**: ESLint + Prettier + Husky

## AI 驱动开发

本项目采用业界领先的 AI 原生开发模式，基于三大成熟 AI 技术构建：

| AI 技术            | 来源                              | 角色定位                  | 核心职责                                                    |
| ------------------ | --------------------------------- | ------------------------- | ----------------------------------------------------------- |
| 🧠**Hermes Agent** | Nous Research 开源（14万+ Stars） | 中枢大脑 · 自我进化智能体 | 任务编排、跨会话记忆、47+ 工具集成、技能沉淀、子 Agent 调度 |
| 💻**Claude Code**  | Anthropic 官方                    | 编码主力                  | IDE 深度集成、高质量代码实现、测试编写、调试修复            |
| ⚡**Superpowers**  | 开源技能集                        | 质量保障专家              | 多维度 Code Review、功能验证、复杂问题拆解                  |

### ✨ Hermes Agent 核心差异化能力

1. **自我进化闭环**: 每次任务完成后自动沉淀为 Markdown 格式 Skill，10-20 次相似任务后执行速度提升 2-3 倍
2. **四层持久化记忆**: 工作记忆 + 情景记忆 + 语义记忆 + 用户建模，跨会话记住项目上下文
3. **47+ 内置工具**: 网络搜索、终端执行、文件操作、浏览器自动化、Cron 调度等开箱即用
4. **子 Agent 并行**: 隔离上下文生成子智能体，避免单一 LLM 的注意力稀释

详细规范请参考:

- [AI 驱动开发规范 - CLAUDE.md](CLAUDE.md)
- [Hermes Agent 协作入口 - HERMES.md](HERMES.md)
- [AI 开发工作流](.ai/workflow.md)
- [AI 工具规则](.ai/tool-rules.md)

## 快速开始

### 环境要求

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- MySQL >= 8.0
- Redis >= 7.0

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

```bash
cp apps/backend/.env.example apps/backend/.env
# 编辑数据库配置
```

### 启动开发环境

```bash
# 启动数据库
pnpm run docker:up

# 数据库迁移
pnpm run prisma:migrate

# 启动后端
pnpm run dev:backend

# 启动前端（新终端）
pnpm run dev:admin
```

### 访问地址

- 管理后台: http://localhost:5173
- 后端 API: http://localhost:3000
- API 文档: http://localhost:3000/api/docs

## 项目结构

```
ADSpread/
├── apps/                          # 应用目录
│   ├── backend/                   # NestJS 后端服务
│   └── admin/                     # Vue3 管理后台
├── packages/                      # 共享包
│   ├── shared/                    # 工具函数
│   └── types/                     # TypeScript 类型定义
├── docs/                          # 📚 统一文档中心
│   ├── requirements/              # 需求文档
│   ├── architecture/              # 架构设计
│   ├── design/                    # 🎨 设计资源 (原型+规范)
│   ├── api/                       # API 文档
│   └── guides/                    # 开发指南
├── infra/                         # 基础设施配置
│   └── docker/                    # Docker 相关配置
├── .hermes/                       # ✨ Hermes Agent 运行时数据（自动生成）
│   ├── memory/                    # 持久化记忆和会话历史
│   ├── skills/                    # 自我进化沉淀的技能（Markdown）
│   ├── state/                     # Agent 状态和任务队列
│   └── logs/                      # 执行日志
├── .ai/                           # AI 共享规则与工作流
├── CLAUDE.md                      # Claude Code 开发规范
├── HERMES.md                      # Hermes Agent 协作入口
└── README.md                      # 项目首页
```

> 💡 **Hermes Agent 提示**: `.hermes/` 目录由 Hermes Agent 自动管理，包含项目的所有 AI 历史记忆和沉淀的技能，**不要手动编辑**。随项目开发，AI 会越来越懂这个项目。

## 开发规范

### 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(store): add industry category management
fix(device): resolve heartbeat timeout issue
docs: update API documentation
```

### 代码质量

```bash
# 代码检查
pnpm run lint

# 代码格式化
pnpm run format

# 运行测试
pnpm run test
```

## 文档

### 文档中心

- [📚 文档索引](docs/README.md) - 完整文档目录和导航

### 产品与架构

- [📋 产品需求文档](docs/requirements/信发系统_产品需求文档.md) - PRD v1.2
- [🏗️ 技术设计文档](docs/architecture/信发系统_技术设计文档.md) - 架构设计 v1.3

### 开发指南

- [⚙️ AI 开发工作流](.ai/workflow.md) - AI 协作流程、任务状态与 Superpowers 入口
- [🧩 通用编码规范](.ai/coding-standards.md) - TypeScript、Git、验证与通用编码原则
- [🛠️ 后端规范](.ai/backend-standards.md) - apps/backend NestJS 服务端规范
- [🖥️ 管理后台规范](.ai/admin-standards.md) - apps/admin Vue3 管理端规范
- [📱 Android 客户端规范](.ai/android-standards.md) - apps/android 客户端规范
- [🤖 CLAUDE.md](CLAUDE.md) - Claude Code 开发规范
- [🧠 HERMES.md](HERMES.md) - Hermes Agent 协作入口

### API 文档

- [🔌 API 文档索引](docs/api/README.md) - 接口文档概览
- 📖 在线 Swagger: 启动后端后访问 `http://localhost:3000/api/docs`

### 设计资源

- [🎨 设计资源中心](docs/design/README.md) - 原型、UI 规范、屏幕模板

## 版本历史

| 版本 | 日期       | 主要功能                           |
| ---- | ---------- | ---------------------------------- |
| v1.3 | 2026-06-24 | 门店行业分类、素材审核流程         |
| v1.2 | 2026-04-20 | RBAC 权限体系、多语言支持          |
| v1.1 | 2026-04-15 | Excel 批量导入、实时推送、操作日志 |
| v1.0 | 2026-04-08 | 基础功能版本                       |

## License

MIT
