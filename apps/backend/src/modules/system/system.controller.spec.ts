import * as request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { HttpAdapterHost } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import * as bcrypt from 'bcryptjs';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SystemModule } from './system.module';
import { AllExceptionsFilter } from '../../filters/all-exceptions.filter';
import { TransformInterceptor } from '../../interceptors/transform.interceptor';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { JwtStrategy } from '../auth/jwt.strategy';
import { SUPER_ADMIN_ROLE_NAME } from '../../common/constants/rbac.constants';

/**
 * 系统管理模块集成测试。
 *
 * 两个跨任务依赖（Task 7 收口前需绕过）：
 *
 * 1. SystemModule 尚未在 AppModule 全局注册——本测试显式导入 SystemModule。
 *
 * 2. PermissionGuard 作为全局 APP_GUARD，按 NestJS 执行顺序
 *    `[globalGuards, controllerGuards, methodGuards]`，会在控制器级
 *    JwtAuthGuard 之前执行，导致 request.user 未被填充即被判 401。
 *    Task 3 的 PermissionGuard 注释假设 JwtAuthGuard 先执行，与实际相反，
 *    需 Task 7 调整。在此期间，本测试不导入 AppModule（避免其 APP_GUARD
 *    注册顺序问题），而是自行组装模块，并按 [JwtAuthGuard, PermissionGuard]
 *    顺序注册两个 APP_GUARD，模拟 Task 7 修复后的协作顺序。
 *
 * Token 签发：auth.controller 在 Task 7 才会补 @Public()，在此之前 login
 * 接口会被 PermissionGuard 拦截。本测试聚焦 system 模块本身，故直接用
 * JwtService 签发 token 绕过 login 流程。
 */
describe('SystemController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let operatorToken: string;
  let operatorRoleId: number;

  beforeAll(async () => {
    // 不导入 AppModule，避免其 APP_GUARD(PermissionGuard) 单独注册导致顺序问题。
    // 自行组装：ConfigModule + PrismaModule + AuthModule（提供 JwtStrategy/JwtService）
    // + SystemModule。APP_GUARD 按数组顺序注册：JwtAuthGuard 先认证，PermissionGuard 后授权。
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env', '.env.local'],
        }),
        PrismaModule,
        PassportModule,
        JwtModule.register({
          secret: process.env.JWT_SECRET || 'adspread-dev-secret',
          signOptions: { expiresIn: '24h' },
        }),
        SystemModule,
      ],
      providers: [
        JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      })
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    // 确保 seed 超管角色 + admin 账号存在（幂等）
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

    // 幂等 upsert 测试数据：运营角色 + operator 账号
    const operatorRole = await prisma.role.upsert({
      where: { name: '运营人员' },
      update: { status: 1, menuIds: [1, 2, 3, 4] }, // 仅业务权限，不含系统管理
      create: {
        name: '运营人员',
        remark: '集成测试用运营角色',
        status: 1,
        menuIds: [1, 2, 3, 4],
      },
    });
    operatorRoleId = operatorRole.id;

    const passwordHash = await bcrypt.hash('Operator123', 12);
    const operator = await prisma.admin.upsert({
      where: { username: 'operator' },
      update: { passwordHash, roleId: operatorRoleId, status: 1 },
      create: {
        username: 'operator',
        passwordHash,
        name: '运营示例',
        roleId: operatorRoleId,
        status: 1,
      },
    });

    const adminAccount = await prisma.admin.findUnique({
      where: { username: 'admin' },
    });
    adminToken = await jwtService.signAsync({
      sub: adminAccount!.id,
      username: 'admin',
      name: '系统管理员',
      roleId: superRole.id,
    });
    operatorToken = await jwtService.signAsync({
      sub: operator.id,
      username: 'operator',
      name: '运营示例',
      roleId: operatorRoleId,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('admin token (super admin) — full CRUD access', () => {
    it('GET /api/admin/admins returns paginated list', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/admins')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data).toHaveProperty('list');
      expect(response.body.data).toHaveProperty('total');
      // passwordHash 不可出现在任何返回项中
      for (const item of response.body.data.list) {
        expect(item).not.toHaveProperty('passwordHash');
      }
    });

    it('GET /api/admin/roles returns paginated list with adminCount', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data.list[0]).toHaveProperty('adminCount');
    });

    it('GET /api/admin/roles/options returns {id,name} list', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/roles/options')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(response.body.code).toBe(0);
      const first = response.body.data[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(Object.keys(first).sort()).toEqual(['id', 'name']);
    });

    it('GET /api/admin/menus returns paginated list', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/menus')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data).toHaveProperty('list');
    });

    it('GET /api/admin/menus/tree returns nested tree', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/menus/tree')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(response.body.code).toBe(0);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('GET /api/admin/menus/options returns {id,name} list', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/menus/options')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(response.body.code).toBe(0);
    });

    it('GET /api/admin/logs returns paginated logs', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data).toHaveProperty('list');
      expect(response.body.data).toHaveProperty('total');
    });

    it('creates and deletes a test role', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'E2E临时角色', remark: '集成测试', menuIds: [] })
        .expect(201);
      expect(createRes.body.code).toBe(0);
      const roleId = createRes.body.data.id;

      await request(app.getHttpServer())
        .delete(`/api/admin/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('rejects deleting super admin role', async () => {
      const superRole = await prisma.role.findUnique({
        where: { name: SUPER_ADMIN_ROLE_NAME },
      });
      expect(superRole).not.toBeNull();

      const response = await request(app.getHttpServer())
        .delete(`/api/admin/roles/${superRole!.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
      expect(response.body.code).not.toBe(0);
      expect(response.body.message).toContain('超级管理员角色不可删除');
    });

    it('rejects assigning menus to super admin role', async () => {
      const superRole = await prisma.role.findUnique({
        where: { name: SUPER_ADMIN_ROLE_NAME },
      });
      const response = await request(app.getHttpServer())
        .put(`/api/admin/roles/${superRole!.id}/menus`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ menuIds: [1, 2] })
        .expect(400);
      expect(response.body.code).not.toBe(0);
      expect(response.body.message).toContain('超级管理员角色权限不可修改');
    });

    it('admin create/reset-password flows enforce strength rule', async () => {
      // 弱密码应被拒绝
      const weakRes = await request(app.getHttpServer())
        .post('/api/admin/admins')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'e2e_weak',
          password: 'weak',
          name: '弱密码',
          roleId: operatorRoleId,
        })
        .expect(400);
      expect(weakRes.body.code).not.toBe(0);
    });
  });

  describe('operator token (no system perms) — 403 isolation', () => {
    it('GET /api/admin/admins → 403', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/admins')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(403);
      expect(response.body.code).not.toBe(0);
    });

    it('GET /api/admin/roles → 403', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(403);
      expect(response.body.code).not.toBe(0);
    });

    it('GET /api/admin/menus → 403', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/menus')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(403);
      expect(response.body.code).not.toBe(0);
    });

    it('GET /api/admin/logs → 403', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/logs')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(403);
      expect(response.body.code).not.toBe(0);
    });
  });

  describe('unauthenticated access — 401', () => {
    it('GET /api/admin/admins without token → 401', async () => {
      await request(app.getHttpServer()).get('/api/admin/admins').expect(401);
    });
  });
});
