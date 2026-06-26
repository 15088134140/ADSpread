import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { OperationLogService } from '../system/log/operation-log.service';
import { MenuService } from '../system/menu/menu.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  const prisma = {
    admin: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  const jwtService = {
    signAsync: jest.fn(),
  } as unknown as JwtService;

  const operationLogService = {
    create: jest.fn().mockResolvedValue({}),
  } as unknown as OperationLogService;

  const menuService = {} as unknown as MenuService;

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    (operationLogService.create as jest.Mock).mockResolvedValue({});
    service = new AuthService(prisma, jwtService, operationLogService, menuService);
  });

  it('rejects missing admin', async () => {
    (prisma.admin.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.login('missing', 'admin123', '127.0.0.1')).rejects.toThrow(
      '用户名或密码错误'
    );
  });

  it('rejects disabled admin', async () => {
    (prisma.admin.findUnique as jest.Mock).mockResolvedValue({ status: 0 });

    await expect(service.login('admin', 'admin123', '127.0.0.1')).rejects.toThrow('账号已禁用');
  });

  it('rejects bad password', async () => {
    (prisma.admin.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      username: 'admin',
      passwordHash: 'hash',
      name: '系统管理员',
      roleId: 1,
      status: 1,
    });
    (bcrypt.compare as unknown as jest.Mock).mockResolvedValue(false);

    await expect(service.login('admin', 'bad', '127.0.0.1')).rejects.toThrow('用户名或密码错误');
  });

  it('returns token and user info on success', async () => {
    (prisma.admin.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      username: 'admin',
      passwordHash: 'hash',
      name: '系统管理员',
      roleId: 1,
      status: 1,
      avatar: null,
      phone: null,
      email: null,
      lastLoginAt: null,
      lastLoginIp: null,
      createdAt: new Date('2026-06-25T00:00:00.000Z'),
      updatedAt: new Date('2026-06-25T00:00:00.000Z'),
      role: {
        id: 1,
        name: '超级管理员',
        status: 1,
        remark: null,
        menuIds: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    (bcrypt.compare as unknown as jest.Mock).mockResolvedValue(true);
    (jwtService.signAsync as jest.Mock).mockResolvedValue('jwt-token');
    (prisma.admin.update as jest.Mock).mockResolvedValue({});

    const result = await service.login('admin', 'admin123', '127.0.0.1');

    expect(result.token).toBe('jwt-token');
    expect(result.userInfo.username).toBe('admin');
    // Verify passwordHash is not in userInfo
    expect(result.userInfo).not.toHaveProperty('passwordHash');
    // login 成功后显式写 login 操作日志
    expect(operationLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'login', status: 1 })
    );
  });
});
