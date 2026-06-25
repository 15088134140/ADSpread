# Android 客户端规范（apps/android）

本规范仅适用于 `apps/android`。处理 Android 任务时，本文件应在 `.ai/coding-standards.md` 之后阅读，并与通用规范共同生效。

## 技术栈边界

- 修改前先查看 `apps/android/README.md`，如该文件存在。
- 以 `apps/android` 当前工程结构、语言栈、构建脚本和相邻代码为准。
- 不将 Vue、NestJS 或 Web 管理后台规则套用到 Android 客户端。

## 修改原则

- 保持改动小，并直接对应任务目标。
- 匹配现有目录结构和命名风格。
- 不在未确认技术栈前新增框架、插件或架构层。
- 涉及与后端接口交互时，同步检查 `packages/api-contracts/` 或 `docs/api/`。

## 验证原则

- 修改前先确认当前 Android 工程的构建、测试或运行命令。
- 优先运行范围最小且相关的 Android 验证。
- 如果本地环境缺少 Android 构建依赖，必须说明无法验证的具体原因和已完成的静态检查。
