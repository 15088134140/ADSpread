/**
 * 后端菜单 name（中文）→ 前端 i18n key 段（英文 slug）映射。
 *
 * 侧边栏只渲染目录(type=1)与菜单(type=2)节点，按钮(type=3)不渲染，
 * 故此表仅覆盖目录与菜单节点的 name。按钮节点不经过侧边栏渲染，
 * 其文案由各业务页面按需使用对应模块 key。
 *
 * 后端菜单 name 是业务数据（中文，用于操作日志、菜单管理页等），
 * 不改后端；前端通过此表将 name 映射到 locales/menu.ts 的英文 key 段。
 * 未命中映射的节点回退显示 name 本身。
 */
const MENU_NAME_TO_SLUG: Record<string, string> = {
  仪表盘: 'dashboard',
  门店管理: 'store',
  设备管理: 'device',
  素材管理: 'material',
  节目制作: 'program',
  发布管理: 'publish',
  系统管理: 'system',
  管理员: 'admin',
  角色: 'role',
  菜单: 'menu',
  操作日志: 'log',
};

/**
 * 将后端菜单 name 转为 i18n key 段；未命中则回退原 name。
 */
export function menuNameToSlug(name: string): string {
  return MENU_NAME_TO_SLUG[name] ?? name;
}
