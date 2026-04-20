// 多语言翻译配置
const translations = {
    ja: {
        // 通用
        systemName: '信発システム',
        adminPanel: '管理画面',
        home: 'ホーム',
        logout: 'ログアウト',
        search: '検索',
        reset: 'リセット',
        add: '追加',
        edit: '編集',
        delete: '削除',
        save: '保存',
        cancel: 'キャンセル',
        confirm: '確認',
        preview: 'プレビュー',
        enabled: '有効',
        disabled: '無効',
        draft: '下書き',
        published: '公開済',
        allStatus: '全てのステータス',
        allStores: '全ての店舗',
        previous: '前へ',
        next: '次へ',

        // 侧边栏菜单
        storeManagement: '店舗管理',
        deviceManagement: 'デバイス管理',
        programProduction: '番組制作',
        materialManagement: '素材管理',
        publishManagement: '公開管理',
        systemManagement: 'システム管理',
        accountManagement: 'アカウント管理',
        roleManagement: '権限管理',
        menuManagement: 'メニュー管理',
        operationLog: '操作ログ',

        // 门店管理
        storeManagementTitle: '店舗管理',
        storeName: '店舗名',
        storeCode: '店舗コード',
        address: '住所',
        contactPerson: '担当者',
        contactPhone: '連絡先電話',
        deviceCount: 'デバイス数',
        status: 'ステータス',
        action: '操作',
        addStore: '店舗を追加',
        searchStorePlaceholder: '店舗名またはコードを検索...',

        // 门店编辑
        editStore: '店舗編集',
        addNewStore: '新店舗を追加',
        basicInfo: '基本情報',
        storeAddress: '店舗住所',
        contactInfo: '連絡先情報',
        storeStatus: '店舗ステータス',
        storeDescription: '店舗説明',
        enterStoreName: '店舗名を入力してください',
        enterStoreCode: '店舗コードを入力してください',
        enterAddress: '住所を入力してください',
        enterContactPerson: '担当者名を入力してください',
        enterPhone: '電話番号を入力してください',
        enterDescription: '店舗説明を入力してください',

        // 设备管理
        deviceManagementTitle: 'デバイス管理',
        deviceName: 'デバイス名',
        deviceCode: 'デバイスコード',
        belongStore: '所属店舗',
        screenSpec: '画面スペック',
        lastOnline: '最終オンライン',
        addDevice: 'デバイスを追加',
        searchDevicePlaceholder: 'デバイス名またはコードを検索...',

        // 设备编辑
        editDevice: 'デバイス編集',
        addNewDevice: '新しいデバイスを追加',
        deviceBasicInfo: 'デバイス基本情報',
        selectStore: '店舗を選択してください',
        screenResolution: '画面解像度',
        screenOrientation: '画面方向',
        landscape: '横画面',
        portrait: '縦画面',
        deviceStatus: 'デバイスステータス',
        remarks: '備考',
        enterDeviceName: 'デバイス名を入力してください',
        enterDeviceCode: 'デバイスコードを入力してください',
        enterResolution: '解像度を入力してください（例：1920x1080）',
        enterRemarks: '備考を入力してください',

        // 素材管理
        materialManagementTitle: '素材管理',
        materialName: '素材名',
        materialType: '素材タイプ',
        fileSize: 'ファイルサイズ',
        uploadTime: 'アップロード時間',
        uploader: 'アップローダー',
        uploadMaterial: '素材をアップロード',
        materialLibrary: '素材ライブラリ',
        allTypes: '全てのタイプ',
        image: '画像',
        video: '動画',
        searchMaterialPlaceholder: '素材名を検索...',

        // 节目列表
        programListTitle: '番組リスト',
        programName: '番組名',
        layoutTemplate: 'レイアウトテンプレート',
        materialCount: '素材数',
        createTime: '作成時間',
        creator: '作成者',
        createProgram: '番組を作成',
        searchProgramPlaceholder: '番組名を検索...',

        // 节目编辑
        editProgram: '番組編集',
        createNewProgram: '新しい番組を作成',
        programInfo: '番組情報',
        enterProgramName: '番組名を入力してください',
        selectLayout: 'レイアウトを選択してください',
        materialLibrary: '素材ライブラリ',
        programPreview: '番組プレビュー',
        area1: 'エリア1',
        area2: 'エリア2',
        area3: 'エリア3',
        area4: 'エリア4',
        region1: '領域1',
        region2: '領域2',
        region3: '領域3',
        remove: '削除',
        dropMaterial: '素材をドロップ',
        saveDraft: '下書き保存',
        saveAndPublish: '保存して公開',
        layoutTemplate: 'レイアウトテンプレート',

        // 发布管理
        publishManagementTitle: '公開管理',
        publishName: '公開名',
        targetDevice: '対象デバイス',
        publishTime: '公開時間',
        publishStatus: '公開ステータス',
        createPublish: '公開を作成',
        searchPublishPlaceholder: '公開名を検索...',
        pending: '待機中',
        publishing: '公開中',
        completed: '完了',
        failed: '失敗',

        // 管理员列表
        adminListTitle: '管理者アカウント管理',
        adminName: '管理者名',
        adminAccount: 'アカウント',
        role: '役割',
        createAdmin: '管理者を追加',
        searchAdminPlaceholder: '管理者名またはアカウントを検索...',
        lastLogin: '最終ログイン',
        changePassword: 'パスワード変更',

        // 角色管理
        roleListTitle: '権限管理',
        roleName: '役割名',
        permissionCount: '権限数',
        createRole: '役割を作成',
        searchRolePlaceholder: '役割名を検索...',
        remark: '備考',
        accountCount: '関連アカウント数',
        menuPermission: 'メニュー権限',
        allMenus: '全てのメニュー',
        copy: 'コピー',
        view: '閲覧',

        // 角色编辑
        editRole: '役割編集',
        addNewRole: '新しい役割を追加',
        roleInfo: '役割情報',
        enterRoleName: '役割名を入力してください',
        roleDescription: '役割の説明',
        enterRoleDescription: '役割の説明を入力してください',
        permissionSettings: '権限設定',

        // 菜单管理
        menuListTitle: 'メニュー管理',
        menuName: 'メニュー名',
        menuIcon: 'アイコン',
        menuPath: 'パス',
        parentMenu: '親メニュー',
        sortOrder: '並び順',
        createMenu: 'メニューを作成',
        searchMenuPlaceholder: 'メニュー名を検索...',

        // 操作日志
        operationLogTitle: '操作ログ',
        operationType: '操作タイプ',
        operationContent: '操作内容',
        operator: '操作者',
        operationTime: '操作時間',
        ipAddress: 'IPアドレス',
        allTypes: '全てのタイプ',
        searchLogPlaceholder: '操作内容を検索...',

        // 登录页
        loginTitle: '管理画面ログイン',
        loginSubtitle: '店舗広告表示システム',
        username: 'ユーザー名',
        password: 'パスワード',
        rememberMe: 'ログイン状態を保持',
        loginButton: 'ログイン',
        enterUsername: 'ユーザー名を入力してください',
        enterPassword: 'パスワードを入力してください',

        // 语言
        language: '言語',
        japanese: '日本語',
        chinese: '中文',
        english: 'English',

        // 弹窗和提示消息
        openAddStoreModal: '店舗追加モーダルを開く',
        openAddDeviceModal: 'デバイス追加モーダルを開く',
        openAddAdminModal: '管理者追加モーダルを開く',
        openAddMenuModal: 'メニュー追加モーダルを開く',
        downloadTemplate: 'テンプレートをダウンロード',
        uploadExcel: 'Excelファイルをアップロード',
        materialAdded: '素材を選択エリアに追加しました',
        exportLog: 'ログを出力'
    },
    zh: {
        // 通用
        systemName: '信发系统',
        adminPanel: '管理后台',
        home: '首页',
        logout: '退出',
        search: '搜索',
        reset: '重置',
        add: '新增',
        edit: '编辑',
        delete: '删除',
        save: '保存',
        cancel: '取消',
        confirm: '确认',
        preview: '预览',
        enabled: '启用',
        disabled: '禁用',
        draft: '草稿',
        published: '已发布',
        allStatus: '全部状态',
        allStores: '全部门店',
        previous: '上一页',
        next: '下一页',

        // 侧边栏菜单
        storeManagement: '门店管理',
        deviceManagement: '设备管理',
        programProduction: '节目制作',
        materialManagement: '素材管理',
        publishManagement: '发布管理',
        systemManagement: '系统管理',
        accountManagement: '账号管理',
        roleManagement: '角色管理',
        menuManagement: '菜单管理',
        operationLog: '操作日志',

        // 门店管理
        storeManagementTitle: '门店管理',
        storeName: '门店名称',
        storeCode: '门店编码',
        address: '地址',
        contactPerson: '联系人',
        contactPhone: '联系电话',
        deviceCount: '设备数量',
        status: '状态',
        action: '操作',
        addStore: '+ 新增门店',
        searchStorePlaceholder: '搜索门店名称或编码...',

        // 门店编辑
        editStore: '门店编辑',
        addNewStore: '新增门店',
        basicInfo: '基本信息',
        storeAddress: '门店地址',
        contactInfo: '联系信息',
        storeStatus: '门店状态',
        storeDescription: '门店描述',
        enterStoreName: '请输入门店名称',
        enterStoreCode: '请输入门店编码',
        enterAddress: '请输入门店地址',
        enterContactPerson: '请输入联系人姓名',
        enterPhone: '请输入联系电话',
        enterDescription: '请输入门店描述',

        // 设备管理
        deviceManagementTitle: '设备管理',
        deviceName: '设备名称',
        deviceCode: '设备编码',
        belongStore: '所属门店',
        screenSpec: '屏幕规格',
        lastOnline: '最后在线',
        addDevice: '+ 新增设备',
        searchDevicePlaceholder: '搜索设备名称或编码...',

        // 设备编辑
        editDevice: '设备编辑',
        addNewDevice: '新增设备',
        deviceBasicInfo: '设备基本信息',
        selectStore: '请选择所属门店',
        screenResolution: '屏幕分辨率',
        screenOrientation: '屏幕方向',
        landscape: '横屏',
        portrait: '竖屏',
        deviceStatus: '设备状态',
        remarks: '备注信息',
        enterDeviceName: '请输入设备名称',
        enterDeviceCode: '请输入设备编码',
        enterResolution: '请输入屏幕分辨率，如：1920x1080',
        enterRemarks: '请输入备注信息',

        // 素材管理
        materialManagementTitle: '素材管理',
        materialName: '素材名称',
        materialType: '素材类型',
        fileSize: '文件大小',
        uploadTime: '上传时间',
        uploader: '上传人',
        uploadMaterial: '+ 上传素材',
        allTypes: '全部类型',
        image: '图片',
        video: '视频',
        searchMaterialPlaceholder: '搜索素材名称...',

        // 节目列表
        programListTitle: '节目列表',
        programName: '节目名称',
        layoutTemplate: '布局模板',
        materialCount: '素材数量',
        createTime: '创建时间',
        updateTime: '更新时间',
        creator: '创建人',
        createProgram: '+ 创建节目',
        searchProgramPlaceholder: '搜索节目名称...',

        // 节目编辑
        editProgram: '节目编辑',
        createNewProgram: '创建新节目',
        programInfo: '节目信息',
        enterProgramName: '请输入节目名称',
        selectLayout: '请选择布局模板',
        materialLibrary: '素材库',
        programPreview: '节目预览',
        area1: '区域1',
        area2: '区域2',
        area3: '区域3',
        area4: '区域4',
        region1: '区域1',
        region2: '区域2',
        region3: '区域3',
        remove: '移除',
        dropMaterial: '拖入素材',
        saveDraft: '保存草稿',
        saveAndPublish: '保存并发布',

        // 发布管理
        publishManagementTitle: '发布管理',
        publishName: '发布名称',
        targetDevice: '目标设备',
        publishTime: '发布时间',
        publishStatus: '发布状态',
        createPublish: '+ 创建发布',
        searchPublishPlaceholder: '搜索发布名称...',
        pending: '待发布',
        publishing: '发布中',
        completed: '已完成',
        failed: '失败',

        // 管理员列表
        adminListTitle: '管理员账号管理',
        adminName: '管理员姓名',
        adminAccount: '账号',
        role: '角色',
        createAdmin: '+ 新增管理员',
        searchAdminPlaceholder: '搜索管理员姓名或账号...',
        lastLogin: '最后登录',
        changePassword: '修改密码',

        // 角色管理
        roleListTitle: '角色管理',
        roleName: '角色名称',
        permissionCount: '权限数量',
        createRole: '+ 新增角色',
        searchRolePlaceholder: '搜索角色名称...',
        remark: '备注说明',
        accountCount: '关联账号数',
        menuPermission: '菜单权限',
        allMenus: '全部菜单',
        copy: '复制',
        view: '查看',

        // 角色编辑
        editRole: '角色编辑',
        addNewRole: '新增角色',
        roleInfo: '角色信息',
        enterRoleName: '请输入角色名称',
        roleDescription: '角色描述',
        enterRoleDescription: '请输入角色描述',
        permissionSettings: '权限设置',

        // 菜单管理
        menuListTitle: '菜单管理',
        menuName: '菜单名称',
        menuIcon: '图标',
        menuPath: '路径',
        parentMenu: '上级菜单',
        sortOrder: '排序',
        createMenu: '+ 新增菜单',
        searchMenuPlaceholder: '搜索菜单名称...',

        // 操作日志
        operationLogTitle: '操作日志',
        operationType: '操作类型',
        operationContent: '操作内容',
        operator: '操作人',
        operationTime: '操作时间',
        ipAddress: 'IP地址',
        allTypes: '全部类型',
        searchLogPlaceholder: '搜索操作内容...',

        // 登录页
        loginTitle: '管理后台登录',
        loginSubtitle: '门店广告投放展示系统',
        username: '用户名',
        password: '密码',
        rememberMe: '记住我',
        loginButton: '登录',
        enterUsername: '请输入用户名',
        enterPassword: '请输入密码',

        // 语言
        language: '语言',
        japanese: '日语',
        chinese: '中文',
        english: '英语',

        // 弹窗和提示消息
        openAddStoreModal: '打开新增门店弹窗',
        openAddDeviceModal: '打开新增设备弹窗',
        openAddAdminModal: '打开新增管理员弹窗',
        openAddMenuModal: '打开新增菜单弹窗',
        downloadTemplate: '下载Excel导入模板',
        uploadExcel: '打开Excel文件上传弹窗',
        materialAdded: '素材已添加到选中区域（原型演示）',
        exportLog: '导出操作日志'
    },
    en: {
        // Common
        systemName: 'Digital Signage',
        adminPanel: 'Admin Panel',
        home: 'Home',
        logout: 'Logout',
        search: 'Search',
        reset: 'Reset',
        add: 'Add',
        edit: 'Edit',
        delete: 'Delete',
        save: 'Save',
        cancel: 'Cancel',
        confirm: 'Confirm',
        preview: 'Preview',
        enabled: 'Enabled',
        disabled: 'Disabled',
        draft: 'Draft',
        published: 'Published',
        allStatus: 'All Status',
        allStores: 'All Stores',
        previous: 'Previous',
        next: 'Next',

        // Sidebar Menu
        storeManagement: 'Store Management',
        deviceManagement: 'Device Management',
        programProduction: 'Program Production',
        materialManagement: 'Material Management',
        publishManagement: 'Publish Management',
        systemManagement: 'System Management',
        accountManagement: 'Account Management',
        roleManagement: 'Role Management',
        menuManagement: 'Menu Management',
        operationLog: 'Operation Log',

        // Store Management
        storeManagementTitle: 'Store Management',
        storeName: 'Store Name',
        storeCode: 'Store Code',
        address: 'Address',
        contactPerson: 'Contact Person',
        contactPhone: 'Contact Phone',
        deviceCount: 'Device Count',
        status: 'Status',
        action: 'Action',
        addStore: '+ Add Store',
        searchStorePlaceholder: 'Search store name or code...',

        // Store Edit
        editStore: 'Edit Store',
        addNewStore: 'Add New Store',
        basicInfo: 'Basic Information',
        storeAddress: 'Store Address',
        contactInfo: 'Contact Information',
        storeStatus: 'Store Status',
        storeDescription: 'Store Description',
        enterStoreName: 'Enter store name',
        enterStoreCode: 'Enter store code',
        enterAddress: 'Enter store address',
        enterContactPerson: 'Enter contact person name',
        enterPhone: 'Enter contact phone number',
        enterDescription: 'Enter store description',

        // Device Management
        deviceManagementTitle: 'Device Management',
        deviceName: 'Device Name',
        deviceCode: 'Device Code',
        belongStore: 'Belong Store',
        screenSpec: 'Screen Spec',
        lastOnline: 'Last Online',
        addDevice: '+ Add Device',
        searchDevicePlaceholder: 'Search device name or code...',

        // Device Edit
        editDevice: 'Edit Device',
        addNewDevice: 'Add New Device',
        deviceBasicInfo: 'Device Basic Info',
        selectStore: 'Select store',
        screenResolution: 'Screen Resolution',
        screenOrientation: 'Screen Orientation',
        landscape: 'Landscape',
        portrait: 'Portrait',
        deviceStatus: 'Device Status',
        remarks: 'Remarks',
        enterDeviceName: 'Enter device name',
        enterDeviceCode: 'Enter device code',
        enterResolution: 'Enter screen resolution, e.g., 1920x1080',
        enterRemarks: 'Enter remarks',

        // Material Management
        materialManagementTitle: 'Material Management',
        materialName: 'Material Name',
        materialType: 'Material Type',
        fileSize: 'File Size',
        uploadTime: 'Upload Time',
        uploader: 'Uploader',
        uploadMaterial: '+ Upload Material',
        allTypes: 'All Types',
        image: 'Image',
        video: 'Video',
        searchMaterialPlaceholder: 'Search material name...',

        // Program List
        programListTitle: 'Program List',
        programName: 'Program Name',
        layoutTemplate: 'Layout Template',
        materialCount: 'Material Count',
        createTime: 'Create Time',
        updateTime: 'Update Time',
        creator: 'Creator',
        createProgram: '+ Create Program',
        searchProgramPlaceholder: 'Search program name...',

        // Program Edit
        editProgram: 'Edit Program',
        createNewProgram: 'Create New Program',
        programInfo: 'Program Information',
        enterProgramName: 'Enter program name',
        selectLayout: 'Select layout template',
        materialLibrary: 'Material Library',
        programPreview: 'Program Preview',
        area1: 'Area 1',
        area2: 'Area 2',
        area3: 'Area 3',
        area4: 'Area 4',
        region1: 'Region 1',
        region2: 'Region 2',
        region3: 'Region 3',
        remove: 'Remove',
        dropMaterial: 'Drop Material',

        // Publish Management
        publishManagementTitle: 'Publish Management',
        publishName: 'Publish Name',
        targetDevice: 'Target Device',
        publishTime: 'Publish Time',
        publishStatus: 'Publish Status',
        createPublish: '+ Create Publish',
        searchPublishPlaceholder: 'Search publish name...',
        pending: 'Pending',
        publishing: 'Publishing',
        completed: 'Completed',
        failed: 'Failed',

        // Admin List
        adminListTitle: 'Admin Account Management',
        adminName: 'Admin Name',
        adminAccount: 'Account',
        role: 'Role',
        createAdmin: '+ Add Admin',
        searchAdminPlaceholder: 'Search admin name or account...',
        lastLogin: 'Last Login',
        changePassword: 'Change Password',

        // Role Management
        roleListTitle: 'Role Management',
        roleName: 'Role Name',
        permissionCount: 'Permission Count',
        createRole: '+ Add Role',
        searchRolePlaceholder: 'Search role name...',
        remark: 'Remark',
        accountCount: 'Account Count',
        menuPermission: 'Menu Permission',
        allMenus: 'All Menus',
        copy: 'Copy',
        view: 'View',

        // Role Edit
        editRole: 'Edit Role',
        addNewRole: 'Add New Role',
        roleInfo: 'Role Information',
        enterRoleName: 'Enter role name',
        roleDescription: 'Role Description',
        enterRoleDescription: 'Enter role description',
        permissionSettings: 'Permission Settings',

        // Menu Management
        menuListTitle: 'Menu Management',
        menuName: 'Menu Name',
        menuIcon: 'Icon',
        menuPath: 'Path',
        parentMenu: 'Parent Menu',
        sortOrder: 'Sort Order',
        createMenu: '+ Add Menu',
        searchMenuPlaceholder: 'Search menu name...',

        // Operation Log
        operationLogTitle: 'Operation Log',
        operationType: 'Operation Type',
        operationContent: 'Operation Content',
        operator: 'Operator',
        operationTime: 'Operation Time',
        ipAddress: 'IP Address',
        allTypes: 'All Types',
        searchLogPlaceholder: 'Search operation content...',

        // Login Page
        loginTitle: 'Admin Login',
        loginSubtitle: 'Store Advertising Display System',
        username: 'Username',
        password: 'Password',
        rememberMe: 'Remember me',
        loginButton: 'Login',
        enterUsername: 'Enter username',
        enterPassword: 'Enter password',

        // Language
        language: 'Language',
        japanese: 'Japanese',
        chinese: 'Chinese',
        english: 'English',

        // Modal and Alert Messages
        openAddStoreModal: 'Open Add Store Modal',
        openAddDeviceModal: 'Open Add Device Modal',
        openAddAdminModal: 'Open Add Admin Modal',
        openAddMenuModal: 'Open Add Menu Modal',
        downloadTemplate: 'Download Excel Import Template',
        uploadExcel: 'Open Excel File Upload Dialog',
        materialAdded: 'Material added to selected area (Prototype Demo)',
        exportLog: 'Export Operation Log'
    }
};

// 当前语言，默认日语
let currentLang = localStorage.getItem('lang') || 'ja';

// 获取翻译文本
function t(key) {
    return translations[currentLang][key] || key;
}

// 切换语言
function setLanguage(lang) {
    if (translations[lang]) {
        currentLang = lang;
        localStorage.setItem('lang', lang);
        updatePageLanguage();
        updateLangSelector();
    }
}

// 更新页面所有文本
function updatePageLanguage() {
    // 更新所有带有 data-i18n 属性的元素
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });

    // 更新所有带有 data-i18n-placeholder 属性的元素
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });

    // 更新所有带有 data-i18n-title 属性的元素
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });

    // 更新页面标题
    const titleEl = document.querySelector('title[data-i18n]');
    if (titleEl) {
        document.title = t(titleEl.getAttribute('data-i18n'));
    }
}

// 更新语言选择器显示
function updateLangSelector() {
    const langFlags = { ja: '🇯🇵', zh: '🇨🇳', en: '🇺🇸' };
    const langNames = { ja: '日本語', zh: '中文', en: 'EN' };

    const currentFlag = document.querySelector('.lang-current-flag');
    const currentText = document.querySelector('.lang-current-text');

    if (currentFlag) {
        currentFlag.textContent = langFlags[currentLang];
    }
    if (currentText) {
        currentText.textContent = langNames[currentLang];
    }

    // 更新下拉菜单选中状态
    document.querySelectorAll('.lang-option').forEach(option => {
        const lang = option.getAttribute('data-lang');
        if (lang === currentLang) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
}

// 初始化语言切换器
function initLangSwitcher() {
    const langSelector = document.querySelector('.lang-selector');
    const langDropdown = document.querySelector('.lang-dropdown');

    if (langSelector && langDropdown) {
        langSelector.addEventListener('click', (e) => {
            e.stopPropagation();
            langDropdown.classList.toggle('show');
        });

        document.querySelectorAll('.lang-option').forEach(option => {
            option.addEventListener('click', () => {
                const lang = option.getAttribute('data-lang');
                setLanguage(lang);
                langDropdown.classList.remove('show');
            });
        });

        // 点击外部关闭下拉菜单
        document.addEventListener('click', () => {
            langDropdown.classList.remove('show');
        });
    }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    updatePageLanguage();
    initLangSwitcher();
    updateLangSelector();
});
