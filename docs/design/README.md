# 设计资源

> 本目录包含 ADSpread 信发系统的所有设计资源。

---

## 📂 目录结构

```
docs/design/
├── README.md                # 本文档 - 设计资源索引
├── mockups/                 # 静态原型 & 设计稿
│   ├── 设计说明.md          # UI 设计规范说明
│   ├── index.html           # 首页原型
│   ├── admin-login.html     # 登录页
│   ├── store-list.html      # 门店列表
│   ├── store-edit.html      # 门店编辑
│   ├── device-list.html     # 设备列表
│   ├── device-edit.html     # 设备编辑
│   ├── material.html        # 素材管理
│   ├── program-list.html    # 节目列表
│   ├── program-edit.html    # 节目编辑
│   ├── publish.html         # 发布管理
│   ├── new-publish-plan.html      # 新建发布计划
│   ├── new-publish-plan-modal.html # 发布计划弹窗
│   ├── role-list.html       # 角色列表
│   ├── role-edit.html       # 角色编辑
│   ├── admin-list.html      # 管理员列表
│   ├── menu-list.html       # 菜单管理
│   ├── operation-log.html   # 操作日志
│   ├── styles.css           # 公共样式
│   ├── i18n.js              # 国际化脚本
│   ├── tablet-landscape-*.html # 横屏分屏模板
│   └── android-portrait-*.html  # 竖屏分屏模板
└── assets/                  # 设计资源文件（图片、图标等）
```

---

## 🎨 设计资源说明

### 静态原型 (Mockups)

所有原型均为纯 HTML + CSS 实现，可直接在浏览器中预览查看交互效果。

**预览方式**：

```bash
# 方式 1: 直接用浏览器打开
open docs/design/mockups/index.html

# 方式 2: 使用本地服务器
cd docs/design/mockups && python -m http.server 8080
open http://localhost:8080
```

### 屏幕模板

设计稿包含多种屏幕方向和分屏模板：

| 模板类型 | 屏幕方向 | 分屏方式 | 说明 |
|---------|----------|----------|------|
| tablet-landscape-1split | 横屏 | 全屏 | 单屏广告 |
| tablet-landscape-2split | 横屏 | 左右分屏 | 视频 + 图片 |
| tablet-landscape-3split | 横屏 | 左 1 右 2 | 多内容组合 |
| tablet-landscape-3-1split | 横屏 | 上 1 下 3 | 跑马灯布局 |
| tablet-landscape-4split | 横屏 | 四分屏 | 网格布局 |
| android-portrait-1split | 竖屏 | 全屏 | 竖屏广告 |
| android-portrait-2split | 竖屏 | 上下分屏 | 图片 + 文字 |
| android-portrait-3split | 竖屏 | 三分屏 | 多区域内容 |

详细设计哲学请参考：[tablet-landscape-philosophy.md](./mockups/tablet-landscape-philosophy.md)

---

## 📐 设计规范

详见 [设计说明.md](./mockups/设计说明.md)

### 核心设计原则

1. **视觉一致性**：统一的颜色、字体、间距、图标风格
2. **操作一致性**：统一的按钮、弹窗、表单交互
3. **国际化支持**：内置中/英/日三语言切换
4. **响应式设计**：适配不同屏幕尺寸

### 色彩规范

| 颜色类型 | 色值 | 用途 |
|----------|------|------|
| 主色 | #409EFF | 主要按钮、链接、选中态 |
| 成功色 | #67C23A | 成功状态、通过审核 |
| 警告色 | #E6A23C | 警告状态、待审核 |
| 危险色 | #F56C6C | 删除、驳回、错误 |
| 信息色 | #909399 | 次要信息 |

---

## 🔗 相关文档

- [产品需求文档](../requirements/信发系统_产品需求文档.md)
- [技术设计文档](../architecture/信发系统_技术设计文档.md)
- [开发指南](../guides/development.md)
