import {
  ERROR_MESSAGES,
  resolveLocale,
  resolveErrorMessage,
  type AppLocale,
  type ErrorMessageKey,
} from './error-messages';

describe('error-messages', () => {
  describe('resolveLocale', () => {
    it('回退 zh-CN 当 header 缺失', () => {
      expect(resolveLocale(undefined)).toBe('zh-CN');
      expect(resolveLocale('')).toBe('zh-CN');
    });

    it('匹配 ja 主语言', () => {
      expect(resolveLocale('ja')).toBe('ja');
      expect(resolveLocale('ja-JP')).toBe('ja');
      expect(resolveLocale('JA')).toBe('ja');
    });

    it('匹配 zh 主语言为 zh-CN', () => {
      expect(resolveLocale('zh')).toBe('zh-CN');
      expect(resolveLocale('zh-CN')).toBe('zh-CN');
      expect(resolveLocale('zh-TW')).toBe('zh-CN');
    });

    it('匹配 en 主语言', () => {
      expect(resolveLocale('en')).toBe('en');
      expect(resolveLocale('en-US')).toBe('en');
      expect(resolveLocale('EN')).toBe('en');
    });

    it('按顺序优先匹配第一个支持语言', () => {
      expect(resolveLocale('ja,zh-CN;q=0.9,en;q=0.8')).toBe('ja');
      expect(resolveLocale('zh-CN,ja;q=0.9')).toBe('zh-CN');
      expect(resolveLocale('fr,en;q=0.8')).toBe('en');
    });

    it('不匹配任何支持语言时回退 zh-CN', () => {
      expect(resolveLocale('fr')).toBe('zh-CN');
      expect(resolveLocale('ko-KR')).toBe('zh-CN');
      expect(resolveLocale('de,fr')).toBe('zh-CN');
    });

    it('容忍带空格与 q 值的复杂 header', () => {
      expect(resolveLocale('  en-US , ja ; q=0.7 ')).toBe('en');
    });
  });

  describe('resolveErrorMessage', () => {
    it('默认 locale 为 zh-CN（不传 locale）', () => {
      expect(resolveErrorMessage('LOGIN_FAILED')).toBe('用户名或密码错误');
    });

    it('三语解析同一 key', () => {
      expect(resolveErrorMessage('LOGIN_FAILED', [], 'zh-CN')).toBe('用户名或密码错误');
      expect(resolveErrorMessage('LOGIN_FAILED', [], 'ja')).toBe(
        'ユーザー名またはパスワードが正しくありません'
      );
      expect(resolveErrorMessage('LOGIN_FAILED', [], 'en')).toBe('Invalid username or password');
    });

    it('按序替换 {0} 占位符', () => {
      expect(resolveErrorMessage('MATERIAL_NOT_FOUND_IDS', ['1,2'], 'zh-CN')).toBe(
        '素材不存在: 1,2'
      );
      expect(resolveErrorMessage('MATERIAL_NOT_FOUND_IDS', ['1,2'], 'en')).toBe(
        'Materials not found: 1,2'
      );
      expect(resolveErrorMessage('SCREEN_ORIENTATION_INVALID', ['HORIZONTAL'], 'zh-CN')).toBe(
        '屏幕方向取值非法：HORIZONTAL'
      );
    });

    it('params 不足时占位替换为空串', () => {
      expect(resolveErrorMessage('MATERIAL_NOT_FOUND_IDS', [], 'zh-CN')).toBe('素材不存在: ');
    });

    it('支持数字类型 params', () => {
      // SCREEN_ORIENTATION_INVALID 接受任意值，数字会被 String 化
      expect(resolveErrorMessage('SCREEN_ORIENTATION_INVALID', [42], 'en')).toBe(
        'Invalid screen orientation value: 42'
      );
    });

    it('未知 key 回退为 key 字符串本身', () => {
      // 类型系统已约束 key，此处用 as 绕过以覆盖运行时防御分支
      expect(resolveErrorMessage('NON_EXISTENT_KEY' as ErrorMessageKey, [], 'zh-CN')).toBe(
        'NON_EXISTENT_KEY'
      );
    });
  });

  describe('ERROR_MESSAGES 目录完整性', () => {
    const locales: AppLocale[] = ['zh-CN', 'ja', 'en'];

    it('每个 key 都提供三语非空字符串', () => {
      const keys = Object.keys(ERROR_MESSAGES) as ErrorMessageKey[];
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        for (const locale of locales) {
          const value = ERROR_MESSAGES[key][locale];
          expect(typeof value).toBe('string');
          expect(value.length).toBeGreaterThan(0);
        }
      }
    });

    it('zh-CN 文案与改造前逐字一致（关键样本）', () => {
      // 覆盖现有 spec 直接断言 .message 的中文文案，保证默认 zh-CN 不破。
      const samples: Record<ErrorMessageKey, string> = {
        UNAUTHORIZED: '未登录',
        FORBIDDEN: '无权限访问',
        LOGIN_FAILED: '用户名或密码错误',
        ACCOUNT_DISABLED: '账号已禁用',
        USER_NOT_FOUND: '用户不存在',
        PASSWORD_OLD_WRONG: '旧密码错误',
        PASSWORD_WEAK: '密码至少 8 位，需包含大写字母、小写字母与数字',
        MATERIAL_REJECT_REASON_TOO_SHORT: '驳回原因至少10个字符',
        SCREEN_SPLIT_MISMATCH: '屏幕方向与分屏类型不匹配',
        STORE_NOT_FOUND: '门店不存在',
        STORE_CODE_EXISTS: '门店编码已存在',
        STORE_HAS_DEVICES: '门店下存在设备，无法删除',
        STORE_NOT_EXISTS: '所属门店不存在',
        DEVICE_NOT_FOUND: '设备不存在',
        DEVICE_CODE_EXISTS: '设备编码已存在',
        MATERIAL_NOT_FOUND: '素材不存在',
        MATERIAL_IN_USE: '该素材已被使用在节目中，无法删除',
        PROGRAM_NOT_FOUND: '节目不存在',
        PROGRAM_NOT_PUBLISHED: '节目未发布',
        PUBLISH_PLAN_NOT_FOUND: '发布计划不存在',
        PUBLISH_PLAN_DISABLED: '发布计划未启用',
        PUBLISH_TARGET_STORES_INVALID: '部分目标门店不存在或已禁用',
        ADMIN_NOT_FOUND: '管理员不存在',
        ADMIN_USERNAME_EXISTS: '用户名已存在',
        ADMIN_CANNOT_DISABLE_SELF: '不可禁用当前登录账号',
        ADMIN_CANNOT_DELETE_SELF: '不可删除当前登录账号',
        ROLE_NOT_FOUND: '角色不存在',
        ROLE_SELECTED_NOT_FOUND: '所选角色不存在',
        ROLE_NAME_EXISTS: '角色名称已存在',
        ROLE_HAS_ADMINS: '角色下存在关联管理员，无法删除',
        ROLE_SUPER_NAME_FIXED: '超级管理员角色名称不可修改',
        ROLE_SUPER_DELETE_FIXED: '超级管理员角色不可删除',
        ROLE_SUPER_MENU_FIXED: '超级管理员角色权限不可修改',
        MENU_NOT_FOUND: '菜单不存在',
        MENU_PARENT_NOT_FOUND: '父菜单不存在',
        MENU_HAS_CHILDREN: '存在子菜单，无法删除',
        MENU_SELF_PARENT: '不可将菜单的父级设为自身',
        EXCEL_PARSE_FAILED: '无法解析 Excel 文件，请确认上传的是 xlsx 文件',
        EXCEL_EMPTY: 'Excel 文件无数据',
        EXCEL_EMPTY_ROWS: 'Excel 文件无数据行',
        CREATE_FAILED: '创建失败',
        NOT_FOUND: '请求的资源不存在',
        INTERNAL_ERROR: '内部服务器错误',
        FILE_TYPE_UNSUPPORTED: '不支持的素材文件类型',
        FILE_REQUIRED: '请选择上传文件',
        FILE_NOT_UPLOADED: '未上传文件',
        FILE_TOO_LARGE: '素材文件不能超过100MB',
        MATERIAL_NOT_FOUND_IDS: '素材不存在: {0}',
        MATERIAL_NOT_APPROVED_IDS: '素材未审核通过: {0}',
        DEVICE_CODE_BATCH_DUPLICATE: '设备编码当批重复',
        DEVICE_ROW_NAME_REQUIRED: '缺少必填项：设备名称',
        DEVICE_ROW_CODE_REQUIRED: '缺少必填项：设备编码',
        DEVICE_ROW_SCREEN_ORIENTATION_REQUIRED: '缺少必填项：屏幕方向',
        DEVICE_ROW_SCREEN_RESOLUTION_REQUIRED: '缺少必填项：分辨率',
        DEVICE_ROW_SPLIT_TYPE_REQUIRED: '缺少必填项：分屏类型',
        SCREEN_ORIENTATION_INVALID: '屏幕方向取值非法：{0}',
        SPLIT_TYPE_INVALID: '分屏类型取值非法：{0}',
      };
      for (const [key, expected] of Object.entries(samples)) {
        expect(ERROR_MESSAGES[key as ErrorMessageKey]['zh-CN']).toBe(expected);
      }
    });
  });
});
