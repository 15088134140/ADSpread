# 管理后台前端规范（apps/admin）

本规范仅适用于 `apps/admin`。处理管理后台任务时，本文件应在 `.ai/coding-standards.md` 之后阅读，并与通用规范共同生效。

## 技术栈边界

- 管理后台是 Vue3 + TypeScript 应用。
- 不将后端或 Android 的实现约束套用到管理后台。
- 修改前先查看目标页面、相邻组件和已有 composable/store 的写法。

## Vue3 组件规范

- 使用 `<script setup lang="ts">`。
- 使用 Composition API 组织逻辑。
- 组件名使用 `PascalCase`。
- Props 必须声明类型；有默认值时显式给出默认值。
- Emits 必须声明事件类型。

## 状态管理

- 组件局部状态使用 `ref` 或 `reactive`。
- 跨页面、跨组件或需要复用的复杂状态使用 Pinia。
- 避免把一次性页面状态提升为全局状态。

## API 调用

- API 调用统一使用 `src/utils/request.ts` 或项目已有请求封装。
- 不在组件中直接裸用 `fetch` 或新建不一致的 axios 实例。
- 接口字段变化时，同步检查后端契约、`packages/api-contracts/` 或 `docs/api/`。

## 组件通信

- 父子组件通信优先使用 Props + Emits。
- 跨层级或跨页面共享状态再使用 Pinia。
- 不通过隐式全局变量传递业务状态。

## 样式规范

- 使用项目既有样式方案；新增样式优先遵循 SCSS + BEM 命名。
- 避免深层嵌套选择器。
- 不引入与设计系统冲突的局部颜色、字号或间距常量。

## 设计资源

- 设计资源目录：`docs/design`。
- 涉及界面布局、视觉或交互变更时，先查看相关设计资源。
- 无设计稿时，保持与相邻页面和组件一致。
