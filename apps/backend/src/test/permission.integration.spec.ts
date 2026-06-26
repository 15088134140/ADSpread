import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { createTestApp } from './test-app';
import { loginAndGetToken } from './auth.helper';
import { PrismaService } from '../modules/prisma/prisma.service';
import { SUPER_ADMIN_ROLE_NAME } from '../common/constants/rbac.constants';

/**
 * 权限集成测试（specs §5.8）。
 *
 * 复用 createTestApp（导入 AppModule，全局 JwtAuthGuard+PermissionGuard 与
 * OperationLogInterceptor 自动生效）。beforeAll 幂等 upsert 超管/运营角色与账号，
 * 通过 AuthController.login（@Public）换取 token，验证：
 *  - admin（超管）可访问各业务 list/create；
 *  - operator（业务角色）可 list 但删除/系统管理接口 403；
 *  - 未带 token 受保护接口 401；
 *  - @Public 的设备拉取节目接口无 token 可访问；
 *  - /api/auth/menus 按角色过滤（operator 无系统管理菜单）。
 */

interface MenuNode {
  id: number;
  name: string;
  children?: MenuNode[];
}

function findNodeByName(nodes: MenuNode[] | undefined, name: string): MenuNode | null {
  if (!nodes) return null;
  for (const n of nodes) {
    if (n.name === name) return n;
    const found = findNodeByName(n.children, name);
    if (found) return found;
  }
  return null;
}

describe('Permission integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let operatorToken: string;
  let testStoreId: number | null = null;
  let testDeviceId: number | null = null;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    // 幂等 upsert 超管角色 + admin 账号
    const superRole = await prisma.role.upsert({
      where: { name: SUPER_ADMIN_ROLE_NAME },
      update: { status: 1 },
      create: {
        name: SUPER_ADMIN_ROLE_NAME,
        remark: 'MVP 默认管理员角色',
        status: 1,
        menuIds: [],
      },
    });
    const adminHash = await bcrypt.hash('admin123', 12);
    await prisma.admin.upsert({
      where: { username: 'admin' },
      update: { passwordHash: adminHash, roleId: superRole.id, status: 1 },
      create: {
        username: 'admin',
        passwordHash: adminHash,
        name: '系统管理员',
        roleId: superRole.id,
        status: 1,
      },
    });

    // 动态构建运营人员 menuIds（§4.4.3）：所有启用菜单，排除“系统管理”子树与
    // permission 以 :delete 结尾的按钮节点。不依赖硬编码 ID，避免与 seed 实际
    // 分配的菜单 ID 不一致（seed 菜单 ID 非连续 1..39）。
    const allMenus = await prisma.menu.findMany({ where: { status: 1 } });
    const excludeIds = new Set<number>();
    const systemRoot = allMenus.find((m) => m.name === '系统管理');
    if (systemRoot) {
      excludeIds.add(systemRoot.id);
      let frontier = [systemRoot.id];
      while (frontier.length) {
        const children = allMenus.filter(
          (m) => frontier.includes(m.parentId ?? -1) && !excludeIds.has(m.id)
        );
        children.forEach((c) => excludeIds.add(c.id));
        frontier = children.map((c) => c.id);
      }
    }
    const operatorMenuIds = allMenus
      .filter((m) => !excludeIds.has(m.id))
      .filter((m) => !(m.permission && m.permission.endsWith(':delete')))
      .map((m) => m.id);

    const operatorRole = await prisma.role.upsert({
      where: { name: '运营人员' },
      update: { status: 1, menuIds: operatorMenuIds },
      create: {
        name: '运营人员',
        remark: '集成测试用运营角色',
        status: 1,
        menuIds: operatorMenuIds,
      },
    });
    const opHash = await bcrypt.hash('Operator123', 12);
    await prisma.admin.upsert({
      where: { username: 'operator' },
      update: { passwordHash: opHash, roleId: operatorRole.id, status: 1 },
      create: {
        username: 'operator',
        passwordHash: opHash,
        name: '运营示例',
        roleId: operatorRole.id,
        status: 1,
      },
    });

    adminToken = await loginAndGetToken(app);

    const opRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'operator', password: 'Operator123' })
      .expect(201);
    operatorToken = opRes.body.data.token;

    // admin 创建一个测试门店，供 operator 删除 403 验证
    const createStore = await request(app.getHttpServer())
      .post('/api/stores')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '权限测试门店', code: 'PERM_TEST_STORE', industryCategory: 'CATERING' })
      .expect(201);
    testStoreId = createStore.body.data.id;

    // admin 创建一个绑定 testStore 的测试设备，供 @Public 设备拉取节目接口验证
    // （设备需有 storeId，否则 device-api.service 的 store.findFirst 触发既有 null 校验）
    const createDevice = await request(app.getHttpServer())
      .post('/api/devices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '权限测试设备',
        code: 'PERM_TEST_DEVICE',
        screenOrientation: 'LANDSCAPE',
        screenResolution: '1920x1080',
        splitType: 'SPLIT_1',
        storeId: testStoreId,
      })
      .expect(201);
    testDeviceId = createDevice.body.data.id;
  });

  afterAll(async () => {
    if (testDeviceId) {
      await request(app.getHttpServer())
        .delete(`/api/devices/${testDeviceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .catch(() => undefined);
    }
    if (testStoreId) {
      await request(app.getHttpServer())
        .delete(`/api/stores/${testStoreId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .catch(() => undefined);
    }
    await app.close();
  });

  describe('admin token (super admin) — business list/create access', () => {
    it('GET /api/stores → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stores')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('list');
    });

    it('GET /api/devices → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.code).toBe(0);
    });

    it('GET /api/materials → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/materials')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.code).toBe(0);
    });

    it('GET /api/programs → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/programs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.code).toBe(0);
    });

    it('GET /api/publish → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/publish')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.code).toBe(0);
    });
  });

  describe('operator token — 403 isolation on delete & system admin', () => {
    it('DELETE /api/stores/:id → 403 (no store:delete)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/stores/${testStoreId}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(403);
      expect(res.body.code).not.toBe(0);
    });

    it('GET /api/admin/admins → 403 (no admin:list)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/admins')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(403);
      expect(res.body.code).not.toBe(0);
    });

    it('403 message 本地化随 Accept-Language 变化（BusinessException）', async () => {
      const en = await request(app.getHttpServer())
        .get('/api/admin/admins')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('Accept-Language', 'en')
        .expect(403);
      expect(en.body.message).toBe('No permission to access');
      const ja = await request(app.getHttpServer())
        .get('/api/admin/admins')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('Accept-Language', 'ja')
        .expect(403);
      expect(ja.body.message).toBe('アクセス権限がありません');
    });
  });

  describe('operator token — allowed list access', () => {
    it('GET /api/stores → 200 (has store:list)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stores')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);
      expect(res.body.code).toBe(0);
    });
  });

  describe('unauthenticated access', () => {
    it('GET /api/stores without token → 401', async () => {
      await request(app.getHttpServer()).get('/api/stores').expect(401);
    });

    it('401 message 本地化随 Accept-Language 变化（通用兜底）', async () => {
      const en = await request(app.getHttpServer())
        .get('/api/stores')
        .set('Accept-Language', 'en')
        .expect(401);
      expect(en.body.message).toBe('Not logged in');
      const ja = await request(app.getHttpServer())
        .get('/api/stores')
        .set('Accept-Language', 'ja')
        .expect(401);
      expect(ja.body.message).toBe('未ログインです');
      const zh = await request(app.getHttpServer())
        .get('/api/stores')
        .set('Accept-Language', 'zh-CN')
        .expect(401);
      expect(zh.body.message).toBe('未登录');
    });

    it('GET /api/device/program without token → 200 (@Public)', async () => {
      // 使用 beforeAll 创建的真实设备 code：设备存在但无门店 → service 返回 null（200），
      // 证明 @Public 放行（请求穿过守卫到达 controller，未被判 401）。
      const res = await request(app.getHttpServer())
        .get('/api/device/program')
        .query({ deviceCode: 'PERM_TEST_DEVICE' })
        .expect(200);
      expect(res.body.code).toBe(0);
    });
  });

  describe('/api/auth/menus — role-based filtering', () => {
    it('admin token returns full tree including 系统管理', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/menus')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(findNodeByName(res.body.data, '系统管理')).not.toBeNull();
    });

    it('operator token returns filtered tree without 系统管理', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/menus')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);
      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(findNodeByName(res.body.data, '系统管理')).toBeNull();
      // 运营人员仍可见门店管理
      expect(findNodeByName(res.body.data, '门店管理')).not.toBeNull();
    });
  });
});
