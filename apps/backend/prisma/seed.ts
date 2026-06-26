import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ============================================================
// 菜单定义（specs §4.4.1，共 39 条）
// type: 1=目录, 2=菜单（有 path）, 3=按钮（无 path，仅 permission）
// 创建顺序：顶级（type=2 菜单 + type=1 目录）→ 二级菜单 → 按钮节点
// parentNo 在运行时通过 menuIdByNo 解析为实际 id
// ============================================================
interface MenuDef {
  no: number;
  name: string;
  parentNo: number | null;
  type: number;
  path: string | null;
  icon: string | null;
  sort: number;
  permission: string | null;
}

const MENU_DEFS: MenuDef[] = [
  // --- 顶级菜单（type=2，有 path）---
  {
    no: 1,
    name: '仪表盘',
    parentNo: null,
    type: 2,
    path: '/dashboard',
    icon: 'Odometer',
    sort: 1,
    permission: 'dashboard:view',
  },
  {
    no: 2,
    name: '门店管理',
    parentNo: null,
    type: 2,
    path: '/store',
    icon: 'Shop',
    sort: 2,
    permission: 'store:list',
  },
  {
    no: 6,
    name: '设备管理',
    parentNo: null,
    type: 2,
    path: '/device',
    icon: 'Monitor',
    sort: 3,
    permission: 'device:list',
  },
  {
    no: 11,
    name: '素材管理',
    parentNo: null,
    type: 2,
    path: '/material',
    icon: 'Picture',
    sort: 4,
    permission: 'material:list',
  },
  {
    no: 15,
    name: '节目制作',
    parentNo: null,
    type: 2,
    path: '/program',
    icon: 'Film',
    sort: 5,
    permission: 'program:list',
  },
  {
    no: 20,
    name: '发布管理',
    parentNo: null,
    type: 2,
    path: '/publish',
    icon: 'Promotion',
    sort: 6,
    permission: 'publish:list',
  },
  // --- 顶级目录（type=1，无 path/permission）---
  {
    no: 25,
    name: '系统管理',
    parentNo: null,
    type: 1,
    path: null,
    icon: 'Setting',
    sort: 7,
    permission: null,
  },
  // --- 二级菜单（type=2，系统管理下）---
  {
    no: 26,
    name: '管理员',
    parentNo: 25,
    type: 2,
    path: '/system/admin',
    icon: 'User',
    sort: 1,
    permission: 'admin:list',
  },
  {
    no: 30,
    name: '角色',
    parentNo: 25,
    type: 2,
    path: '/system/role',
    icon: 'Avatar',
    sort: 2,
    permission: 'role:list',
  },
  {
    no: 35,
    name: '菜单',
    parentNo: 25,
    type: 2,
    path: '/system/menu',
    icon: 'Menu',
    sort: 3,
    permission: 'menu:list',
  },
  {
    no: 39,
    name: '操作日志',
    parentNo: 25,
    type: 2,
    path: '/system/log',
    icon: 'Document',
    sort: 4,
    permission: 'log:list',
  },
  // --- 按钮节点（type=3，无 path/icon）---
  // 门店管理
  {
    no: 3,
    name: '新增门店',
    parentNo: 2,
    type: 3,
    path: null,
    icon: null,
    sort: 1,
    permission: 'store:create',
  },
  {
    no: 4,
    name: '编辑门店',
    parentNo: 2,
    type: 3,
    path: null,
    icon: null,
    sort: 2,
    permission: 'store:update',
  },
  {
    no: 5,
    name: '删除门店',
    parentNo: 2,
    type: 3,
    path: null,
    icon: null,
    sort: 3,
    permission: 'store:delete',
  },
  // 设备管理
  {
    no: 7,
    name: '新增设备',
    parentNo: 6,
    type: 3,
    path: null,
    icon: null,
    sort: 1,
    permission: 'device:create',
  },
  {
    no: 8,
    name: '编辑设备',
    parentNo: 6,
    type: 3,
    path: null,
    icon: null,
    sort: 2,
    permission: 'device:update',
  },
  {
    no: 9,
    name: '删除设备',
    parentNo: 6,
    type: 3,
    path: null,
    icon: null,
    sort: 3,
    permission: 'device:delete',
  },
  {
    no: 10,
    name: '批量导入',
    parentNo: 6,
    type: 3,
    path: null,
    icon: null,
    sort: 4,
    permission: 'device:import',
  },
  // 素材管理
  {
    no: 12,
    name: '上传素材',
    parentNo: 11,
    type: 3,
    path: null,
    icon: null,
    sort: 1,
    permission: 'material:upload',
  },
  {
    no: 13,
    name: '审核素材',
    parentNo: 11,
    type: 3,
    path: null,
    icon: null,
    sort: 2,
    permission: 'material:audit',
  },
  {
    no: 14,
    name: '删除素材',
    parentNo: 11,
    type: 3,
    path: null,
    icon: null,
    sort: 3,
    permission: 'material:delete',
  },
  // 节目制作
  {
    no: 16,
    name: '新建节目',
    parentNo: 15,
    type: 3,
    path: null,
    icon: null,
    sort: 1,
    permission: 'program:create',
  },
  {
    no: 17,
    name: '编辑节目',
    parentNo: 15,
    type: 3,
    path: null,
    icon: null,
    sort: 2,
    permission: 'program:update',
  },
  {
    no: 18,
    name: '发布节目',
    parentNo: 15,
    type: 3,
    path: null,
    icon: null,
    sort: 3,
    permission: 'program:publish',
  },
  {
    no: 19,
    name: '删除节目',
    parentNo: 15,
    type: 3,
    path: null,
    icon: null,
    sort: 4,
    permission: 'program:delete',
  },
  // 发布管理
  {
    no: 21,
    name: '新建计划',
    parentNo: 20,
    type: 3,
    path: null,
    icon: null,
    sort: 1,
    permission: 'publish:create',
  },
  {
    no: 22,
    name: '编辑计划',
    parentNo: 20,
    type: 3,
    path: null,
    icon: null,
    sort: 2,
    permission: 'publish:update',
  },
  {
    no: 23,
    name: '删除计划',
    parentNo: 20,
    type: 3,
    path: null,
    icon: null,
    sort: 3,
    permission: 'publish:delete',
  },
  {
    no: 24,
    name: '立即推送',
    parentNo: 20,
    type: 3,
    path: null,
    icon: null,
    sort: 4,
    permission: 'publish:push',
  },
  // 管理员
  {
    no: 27,
    name: '新增管理员',
    parentNo: 26,
    type: 3,
    path: null,
    icon: null,
    sort: 1,
    permission: 'admin:create',
  },
  {
    no: 28,
    name: '编辑管理员',
    parentNo: 26,
    type: 3,
    path: null,
    icon: null,
    sort: 2,
    permission: 'admin:update',
  },
  {
    no: 29,
    name: '重置密码',
    parentNo: 26,
    type: 3,
    path: null,
    icon: null,
    sort: 3,
    permission: 'admin:reset-password',
  },
  // 角色
  {
    no: 31,
    name: '新增角色',
    parentNo: 30,
    type: 3,
    path: null,
    icon: null,
    sort: 1,
    permission: 'role:create',
  },
  {
    no: 32,
    name: '编辑角色',
    parentNo: 30,
    type: 3,
    path: null,
    icon: null,
    sort: 2,
    permission: 'role:update',
  },
  {
    no: 33,
    name: '删除角色',
    parentNo: 30,
    type: 3,
    path: null,
    icon: null,
    sort: 3,
    permission: 'role:delete',
  },
  {
    no: 34,
    name: '分配权限',
    parentNo: 30,
    type: 3,
    path: null,
    icon: null,
    sort: 4,
    permission: 'role:assign',
  },
  // 菜单
  {
    no: 36,
    name: '新增菜单',
    parentNo: 35,
    type: 3,
    path: null,
    icon: null,
    sort: 1,
    permission: 'menu:create',
  },
  {
    no: 37,
    name: '编辑菜单',
    parentNo: 35,
    type: 3,
    path: null,
    icon: null,
    sort: 2,
    permission: 'menu:update',
  },
  {
    no: 38,
    name: '删除菜单',
    parentNo: 35,
    type: 3,
    path: null,
    icon: null,
    sort: 3,
    permission: 'menu:delete',
  },
];

// ============================================================
// upsertMenu：按 specs §4.4.1 注释策略幂等 upsert 菜单
// - 菜单节点（type=2，有 path）：按 path 查找
// - 目录节点（type=1，无 path 且 parentId=null）：按 name + parentId=null 组合查找
// - 按钮节点（type=3，无 path）：按 name + parentId 组合查找
// 注：menus 表无非主键唯一索引，故采用 findFirst + update/create 模拟 upsert
// ============================================================
async function upsertMenu(def: MenuDef, parentId: number | null) {
  let existing;
  if (def.path) {
    existing = await prisma.menu.findFirst({ where: { path: def.path } });
  } else if (parentId === null) {
    existing = await prisma.menu.findFirst({ where: { name: def.name, parentId: null } });
  } else {
    existing = await prisma.menu.findFirst({ where: { name: def.name, parentId } });
  }

  const data = {
    name: def.name,
    parentId,
    type: def.type,
    path: def.path,
    icon: def.icon,
    sort: def.sort,
    permission: def.permission,
    component: null,
    status: 1,
  };

  if (existing) {
    return prisma.menu.update({ where: { id: existing.id }, data });
  }
  return prisma.menu.create({ data });
}

async function main() {
  // ============================================================
  // Step 1: 创建 39 条菜单（specs §4.4.1）
  // 按 MENU_DEFS 顺序创建，menuIdByNo 收集每条记录的实际 id
  // 二级/按钮节点的 parentId 引用已创建记录的 id
  // ============================================================
  const menuIdByNo = new Map<number, number>();
  for (const def of MENU_DEFS) {
    const parentId = def.parentNo !== null ? (menuIdByNo.get(def.parentNo) ?? null) : null;
    const menu = await upsertMenu(def, parentId);
    menuIdByNo.set(def.no, menu.id);
  }

  // ============================================================
  // 既有 admin/admin123 超管账号 seed（保留原逻辑不动）
  // ============================================================
  const passwordHash = await bcrypt.hash('admin123', 12);

  const superRole = await prisma.role.upsert({
    where: { name: '超级管理员' },
    update: { status: 1 },
    create: {
      name: '超级管理员',
      remark: 'MVP 默认管理员角色',
      status: 1,
      menuIds: [],
    },
  });

  await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {
      passwordHash,
      name: '系统管理员',
      roleId: superRole.id,
      status: 1,
    },
    create: {
      username: 'admin',
      passwordHash,
      name: '系统管理员',
      roleId: superRole.id,
      status: 1,
    },
  });

  // ============================================================
  // Step 2: 运营人员角色（specs §4.4.3）
  // menuIds 授权范围：业务全流程查看/写入，不含删除按钮与系统管理
  // ============================================================
  const operatorMenuNos: number[] = [
    1, // 仪表盘
    2,
    3,
    4, // 门店管理 + 新增 + 编辑（不含删除 #5）
    6,
    7,
    8,
    10, // 设备管理 + 新增 + 编辑 + 批量导入（不含删除 #9）
    11,
    12,
    13, // 素材管理 + 上传 + 审核（不含删除 #14）
    15,
    16,
    17,
    18, // 节目制作 + 新建 + 编辑 + 发布（不含删除 #19）
    20,
    21,
    22,
    24, // 发布管理 + 新建 + 编辑 + 立即推送（不含删除 #23）
  ];
  const operatorMenuIds: number[] = operatorMenuNos
    .map((no) => menuIdByNo.get(no))
    .filter((id): id is number => typeof id === 'number');

  const operatorRole = await prisma.role.upsert({
    where: { name: '运营人员' },
    update: {
      remark: '业务运营示例角色',
      status: 1,
      menuIds: operatorMenuIds,
    },
    create: {
      name: '运营人员',
      remark: '业务运营示例角色',
      status: 1,
      menuIds: operatorMenuIds,
    },
  });

  // ============================================================
  // Step 3: operator 账号（specs §4.4.3）
  // upsert 按 username='operator' 幂等：
  //   存在 → 更新 roleId/name/status（不重置密码）
  //   不存在 → 创建并设置 passwordHash=bcrypt('operator123', 12)
  // ============================================================
  const existingOperator = await prisma.admin.findUnique({ where: { username: 'operator' } });
  if (existingOperator) {
    await prisma.admin.update({
      where: { username: 'operator' },
      data: {
        name: '运营示例',
        roleId: operatorRole.id,
        status: 1,
      },
    });
  } else {
    const operatorPasswordHash = await bcrypt.hash('operator123', 12);
    await prisma.admin.create({
      data: {
        username: 'operator',
        passwordHash: operatorPasswordHash,
        name: '运营示例',
        roleId: operatorRole.id,
        status: 1,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
