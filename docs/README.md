# 文档中心

欢迎来到 ADSpread 信发系统文档中心。本目录包含所有项目相关的文档资源。

---

## 📂 文档结构

```
docs/
├── README.md                    # 本文档 - 文档索引
├── requirements/                # 需求文档
│   └── 信发系统_产品需求文档.md  # PRD v1.2
├── architecture/                # 架构设计
│   └── 信发系统_技术设计文档.md  # 技术架构设计 v1.3
├── design/                      # 🎨 设计资源 (新增)
│   ├── README.md               # 设计资源索引
│   └── mockups/                 # HTML 静态原型、设计稿
├── api/                         # API 文档
│   └── README.md               # REST API / Socket.io 文档
├── guides/                      # 指南
│   ├── deployment.md           # 部署指南
│   ├── development.md          # 开发指南
│   └── ai-workflow.md          # AI 驱动开发工作流指南
└── changelogs/                  # 变更日志
    └── CHANGELOG.md            # 版本历史记录
```

---

## 📋 文档索引

### 产品文档

| 文档                                                              | 版本 | 说明                     |
| ----------------------------------------------------------------- | ---- | ------------------------ |
| [信发系统\_产品需求文档](./requirements/信发系统_产品需求文档.md) | v1.2 | 完整的产品需求规格说明书 |

### 技术文档

| 文档                                                              | 版本 | 说明                                     |
| ----------------------------------------------------------------- | ---- | ---------------------------------------- |
| [信发系统\_技术设计文档](./architecture/信发系统_技术设计文档.md) | v1.3 | 系统架构、技术选型、数据库设计、API 设计 |

### AI 开发指南

| 文档                                              | 版本 | 说明                                     |
| ------------------------------------------------- | ---- | ---------------------------------------- |
| [AI 开发工作流](../.ai/workflow.md)               | v1.0 | AI 协作流程、任务状态与 Superpowers 入口 |
| [通用编码规范](../.ai/coding-standards.md)        | v1.0 | TypeScript、Git、验证与通用编码原则      |
| [后端规范](../.ai/backend-standards.md)           | v1.0 | apps/backend NestJS 服务端规范           |
| [管理后台规范](../.ai/admin-standards.md)         | v1.0 | apps/admin Vue3 管理端规范               |
| [Android 客户端规范](../.ai/android-standards.md) | v1.0 | apps/android 客户端规范                  |
| [AI 工具规则](../.ai/tool-rules.md)               | v1.0 | Hermes、Claude Code 与子代理工具规则     |
| [CLAUDE.md](../CLAUDE.md)                         | v1.3 | Claude Code 开发规范                     |
| [HERMES.md](../HERMES.md)                         | v1.0 | Hermes Agent 协作入口                    |

### 设计资源

设计资源统一托管在 `docs/design/` 目录下：

| 文档                                                            | 说明                                   |
| --------------------------------------------------------------- | -------------------------------------- |
| [设计资源索引](./design/README.md)                              | 设计资源总览、预览方式、设计规范       |
| [静态原型](./design/mockups/)                                   | 30+ 个 HTML 页面原型，可直接浏览器预览 |
| [设计说明](./design/mockups/设计说明.md)                        | UI 设计规范、交互规范、色彩规范        |
| [分屏设计哲学](./design/mockups/tablet-landscape-philosophy.md) | 分屏布局设计理念说明                   |

---

## 🔗 相关文档

- [项目根目录 README](../README.md) - 快速开始指南
- [CLAUDE.md](../CLAUDE.md) - Claude Code 开发规范
- [HERMES.md](../HERMES.md) - Hermes Agent 协作入口
- [AI 开发工作流](../.ai/workflow.md) - AI 协作流程与任务状态

---

## 📝 文档更新规范

1. **版本号规则**：遵循语义化版本 `主版本.次版本.修订号`
2. **更新记录**：每次文档更新需记录变更内容到 `changelogs/CHANGELOG.md`
3. **PRD 变更**：需求变更需同步更新需求文档并标注版本
4. **架构变更**：技术架构变更需同步更新技术设计文档并评审

---

_最后更新: 2026-06-24 v1.3 初始化文档中心_
