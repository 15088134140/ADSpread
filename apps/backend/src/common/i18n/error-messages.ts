/**
 * 后端业务错误消息国际化目录（specs §5.2）。
 *
 * 设计要点：
 * - zh-CN 为默认语言，其值与改造前各 throw 站点的中文字符串逐字一致，
 *   保证 BusinessException.message 默认值不变、现有测试断言不破。
 * - ja / en 翻译参照前端 apps/admin/src/locales/{ja,en} 既有用词，保持术语一致。
 * - 占位符统一使用 {0}{1}... 形式，由 resolveErrorMessage 按序替换。
 * - 不引入第三方 i18n 框架，仅维护轻量内置目录。
 */

export type AppLocale = 'ja' | 'zh-CN' | 'en';

/**
 * 错误消息目录。
 * key 命名采用 SCREAMING_SNAKE_CASE；zh-CN 值逐字复制自原 throw 站点中文文案。
 */
export const ERROR_MESSAGES = {
  // 通用 / 鉴权兜底
  UNAUTHORIZED: {
    'zh-CN': '未登录',
    ja: '未ログインです',
    en: 'Not logged in',
  },
  FORBIDDEN: {
    'zh-CN': '无权限访问',
    ja: 'アクセス権限がありません',
    en: 'No permission to access',
  },
  NOT_FOUND: {
    'zh-CN': '请求的资源不存在',
    ja: 'リクエストされたリソースは存在しません',
    en: 'The requested resource does not exist',
  },
  INTERNAL_ERROR: {
    'zh-CN': '内部服务器错误',
    ja: 'サーバー内部エラーが発生しました',
    en: 'Internal server error',
  },

  // 认证
  LOGIN_FAILED: {
    'zh-CN': '用户名或密码错误',
    ja: 'ユーザー名またはパスワードが正しくありません',
    en: 'Invalid username or password',
  },
  ACCOUNT_DISABLED: {
    'zh-CN': '账号已禁用',
    ja: 'アカウントが無効化されています',
    en: 'Account has been disabled',
  },
  USER_NOT_FOUND: {
    'zh-CN': '用户不存在',
    ja: 'ユーザーが存在しません',
    en: 'User does not exist',
  },
  PASSWORD_OLD_WRONG: {
    'zh-CN': '旧密码错误',
    ja: '旧パスワードが正しくありません',
    en: 'Old password is incorrect',
  },
  PASSWORD_WEAK: {
    'zh-CN': '密码至少 8 位，需包含大写字母、小写字母与数字',
    ja: 'パスワードは8文字以上で、大文字・小文字・数字を含める必要があります',
    en: 'Password must be at least 8 chars, with upper/lower case and digit',
  },

  // 文件 / 素材校验
  FILE_TYPE_UNSUPPORTED: {
    'zh-CN': '不支持的素材文件类型',
    ja: 'サポートされていない素材ファイル形式です',
    en: 'Unsupported material file type',
  },
  FILE_REQUIRED: {
    'zh-CN': '请选择上传文件',
    ja: 'アップロードファイルを選択してください',
    en: 'Please select a file to upload',
  },
  FILE_NOT_UPLOADED: {
    'zh-CN': '未上传文件',
    ja: 'ファイルがアップロードされていません',
    en: 'No file uploaded',
  },
  FILE_TOO_LARGE: {
    'zh-CN': '素材文件不能超过100MB',
    ja: '素材ファイルは100MBを超えることはできません',
    en: 'Material file cannot exceed 100MB',
  },
  SCREEN_SPLIT_MISMATCH: {
    'zh-CN': '屏幕方向与分屏类型不匹配',
    ja: '画面方向と分割タイプが一致しません',
    en: 'Screen orientation and split type do not match',
  },

  // 门店
  STORE_NOT_FOUND: {
    'zh-CN': '门店不存在',
    ja: '店舗が存在しません',
    en: 'Store does not exist',
  },
  STORE_CODE_EXISTS: {
    'zh-CN': '门店编码已存在',
    ja: '店舗コードが既に存在します',
    en: 'Store code already exists',
  },
  STORE_HAS_DEVICES: {
    'zh-CN': '门店下存在设备，无法删除',
    ja: '店舗にデバイスが存在するため削除できません',
    en: 'Store has devices, cannot be deleted',
  },
  STORE_NOT_EXISTS: {
    'zh-CN': '所属门店不存在',
    ja: '所属店舗が存在しません',
    en: 'Associated store does not exist',
  },

  // 设备
  DEVICE_NOT_FOUND: {
    'zh-CN': '设备不存在',
    ja: 'デバイスが存在しません',
    en: 'Device does not exist',
  },
  DEVICE_CODE_EXISTS: {
    'zh-CN': '设备编码已存在',
    ja: 'デバイスコードが既に存在します',
    en: 'Device code already exists',
  },
  DEVICE_CODE_BATCH_DUPLICATE: {
    'zh-CN': '设备编码当批重复',
    ja: 'デバイスコードがバッチ内で重複しています',
    en: 'Device code duplicated within the batch',
  },

  // 素材
  MATERIAL_NOT_FOUND: {
    'zh-CN': '素材不存在',
    ja: '素材が存在しません',
    en: 'Material does not exist',
  },
  MATERIAL_IN_USE: {
    'zh-CN': '该素材已被使用在节目中，无法删除',
    ja: 'この素材はプログラムで使用されているため削除できません',
    en: 'Material is used in a program, cannot be deleted',
  },
  MATERIAL_REJECT_REASON_TOO_SHORT: {
    'zh-CN': '驳回原因至少10个字符',
    ja: '却下理由は10文字以上で入力してください',
    en: 'Reject reason must be at least 10 characters',
  },
  MATERIAL_NOT_FOUND_IDS: {
    'zh-CN': '素材不存在: {0}',
    ja: '素材が存在しません: {0}',
    en: 'Materials not found: {0}',
  },
  MATERIAL_NOT_APPROVED_IDS: {
    'zh-CN': '素材未审核通过: {0}',
    ja: '素材が承認されていません: {0}',
    en: 'Materials not approved: {0}',
  },

  // 节目 / 发布
  PROGRAM_NOT_FOUND: {
    'zh-CN': '节目不存在',
    ja: 'プログラムが存在しません',
    en: 'Program does not exist',
  },
  PROGRAM_NOT_PUBLISHED: {
    'zh-CN': '节目未发布',
    ja: 'プログラムが公開されていません',
    en: 'Program is not published',
  },
  PUBLISH_PLAN_NOT_FOUND: {
    'zh-CN': '发布计划不存在',
    ja: '配信計画が存在しません',
    en: 'Publish plan does not exist',
  },
  PUBLISH_PLAN_DISABLED: {
    'zh-CN': '发布计划未启用',
    ja: '配信計画が有効化されていません',
    en: 'Publish plan is not enabled',
  },
  PUBLISH_TARGET_STORES_INVALID: {
    'zh-CN': '部分目标门店不存在或已禁用',
    ja: '一部の対象店舗が存在しないか無効化されています',
    en: 'Some target stores do not exist or are disabled',
  },

  // 系统管理 - 管理员
  ADMIN_NOT_FOUND: {
    'zh-CN': '管理员不存在',
    ja: '管理者が存在しません',
    en: 'Administrator does not exist',
  },
  ADMIN_USERNAME_EXISTS: {
    'zh-CN': '用户名已存在',
    ja: 'ユーザー名が既に存在します',
    en: 'Username already exists',
  },
  ADMIN_CANNOT_DISABLE_SELF: {
    'zh-CN': '不可禁用当前登录账号',
    ja: '現在ログイン中のアカウントを無効化することはできません',
    en: 'Cannot disable the currently logged-in account',
  },
  ADMIN_CANNOT_DELETE_SELF: {
    'zh-CN': '不可删除当前登录账号',
    ja: '現在ログイン中のアカウントを削除することはできません',
    en: 'Cannot delete the currently logged-in account',
  },

  // 系统管理 - 角色
  ROLE_NOT_FOUND: {
    'zh-CN': '角色不存在',
    ja: 'ロールが存在しません',
    en: 'Role does not exist',
  },
  ROLE_SELECTED_NOT_FOUND: {
    'zh-CN': '所选角色不存在',
    ja: '選択されたロールが存在しません',
    en: 'Selected role does not exist',
  },
  ROLE_NAME_EXISTS: {
    'zh-CN': '角色名称已存在',
    ja: 'ロール名が既に存在します',
    en: 'Role name already exists',
  },
  ROLE_HAS_ADMINS: {
    'zh-CN': '角色下存在关联管理员，无法删除',
    ja: 'ロールに管理者が関連付けられているため削除できません',
    en: 'Role has associated administrators, cannot be deleted',
  },
  ROLE_SUPER_NAME_FIXED: {
    'zh-CN': '超级管理员角色名称不可修改',
    ja: 'スーパー管理者ロールの名称は変更できません',
    en: 'Super admin role name cannot be modified',
  },
  ROLE_SUPER_DELETE_FIXED: {
    'zh-CN': '超级管理员角色不可删除',
    ja: 'スーパー管理者ロールは削除できません',
    en: 'Super admin role cannot be deleted',
  },
  ROLE_SUPER_MENU_FIXED: {
    'zh-CN': '超级管理员角色权限不可修改',
    ja: 'スーパー管理者ロールの権限は変更できません',
    en: 'Super admin role permissions cannot be modified',
  },

  // 系统管理 - 菜单
  MENU_NOT_FOUND: {
    'zh-CN': '菜单不存在',
    ja: 'メニューが存在しません',
    en: 'Menu does not exist',
  },
  MENU_PARENT_NOT_FOUND: {
    'zh-CN': '父菜单不存在',
    ja: '親メニューが存在しません',
    en: 'Parent menu does not exist',
  },
  MENU_HAS_CHILDREN: {
    'zh-CN': '存在子菜单，无法删除',
    ja: '子メニューが存在するため削除できません',
    en: 'Menu has sub-menus, cannot be deleted',
  },
  MENU_SELF_PARENT: {
    'zh-CN': '不可将菜单的父级设为自身',
    ja: 'メニューの親を自身に設定することはできません',
    en: "Cannot set a menu's parent to itself",
  },

  // Excel 导入
  EXCEL_PARSE_FAILED: {
    'zh-CN': '无法解析 Excel 文件，请确认上传的是 xlsx 文件',
    ja: 'Excelファイルを解析できません。xlsxファイルをアップロードしてください',
    en: 'Cannot parse Excel file, please ensure an xlsx file is uploaded',
  },
  EXCEL_EMPTY: {
    'zh-CN': 'Excel 文件无数据',
    ja: 'Excelファイルにデータがありません',
    en: 'Excel file has no data',
  },
  EXCEL_EMPTY_ROWS: {
    'zh-CN': 'Excel 文件无数据行',
    ja: 'Excelファイルにデータ行がありません',
    en: 'Excel file has no data rows',
  },
  CREATE_FAILED: {
    'zh-CN': '创建失败',
    ja: '作成に失敗しました',
    en: 'Create failed',
  },

  // Excel 导入行级校验 reason（device.service.validateRow）
  DEVICE_ROW_NAME_REQUIRED: {
    'zh-CN': '缺少必填项：设备名称',
    ja: '必須項目が未入力：デバイス名',
    en: 'Missing required field: Device Name',
  },
  DEVICE_ROW_CODE_REQUIRED: {
    'zh-CN': '缺少必填项：设备编码',
    ja: '必須項目が未入力：デバイスコード',
    en: 'Missing required field: Device Code',
  },
  DEVICE_ROW_SCREEN_ORIENTATION_REQUIRED: {
    'zh-CN': '缺少必填项：屏幕方向',
    ja: '必須項目が未入力：画面方向',
    en: 'Missing required field: Screen Orientation',
  },
  DEVICE_ROW_SCREEN_RESOLUTION_REQUIRED: {
    'zh-CN': '缺少必填项：分辨率',
    ja: '必須項目が未入力：解像度',
    en: 'Missing required field: Resolution',
  },
  DEVICE_ROW_SPLIT_TYPE_REQUIRED: {
    'zh-CN': '缺少必填项：分屏类型',
    ja: '必須項目が未入力：分割タイプ',
    en: 'Missing required field: Split Type',
  },
  SCREEN_ORIENTATION_INVALID: {
    'zh-CN': '屏幕方向取值非法：{0}',
    ja: '画面方向の値が無効です：{0}',
    en: 'Invalid screen orientation value: {0}',
  },
  SPLIT_TYPE_INVALID: {
    'zh-CN': '分屏类型取值非法：{0}',
    ja: '分割タイプの値が無効です：{0}',
    en: 'Invalid split type value: {0}',
  },
} as const;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;

/**
 * 解析 Accept-Language 请求头为应用支持的语言。
 *
 * 匹配规则：按逗号分割，取每个标签的主语言（`-` 前部分，小写）依次匹配；
 * 命中 ja→'ja'、zh→'zh-CN'、en→'en'；全部不匹配或 header 缺失时回退 'zh-CN'，
 * 保持对无 Accept-Language 调用方（如现有单测、curl）的当前行为。
 */
export function resolveLocale(acceptLanguage?: string): AppLocale {
  if (!acceptLanguage) return 'zh-CN';
  const tags = acceptLanguage
    .split(',')
    .map((t) => t.trim().split(';')[0].trim().toLowerCase())
    .filter((t) => t.length > 0);
  for (const tag of tags) {
    const primary = tag.split('-')[0];
    if (primary === 'ja') return 'ja';
    if (primary === 'zh') return 'zh-CN';
    if (primary === 'en') return 'en';
  }
  return 'zh-CN';
}

/**
 * 按语言解析消息 key 为最终文案。
 *
 * - locale 无对应 key 时回退 zh-CN（保证始终有输出）。
 * - 按序用 params 替换模板中的 {0}{1}... 占位；params 不足时替换为空串。
 */
export function resolveErrorMessage(
  key: ErrorMessageKey,
  params: unknown[] = [],
  locale: AppLocale = 'zh-CN'
): string {
  const entry = ERROR_MESSAGES[key];
  if (!entry) return String(key);
  const template = entry[locale] ?? entry['zh-CN'];
  return template.replace(/\{(\d+)\}/g, (_match, idx) => {
    const i = Number(idx);
    return params[i] !== undefined ? String(params[i]) : '';
  });
}
