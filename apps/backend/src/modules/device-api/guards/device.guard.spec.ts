import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { DeviceGuard } from './device.guard';
import { DeviceTokenService } from '../auth/device-token.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BusinessErrorCode,
  type BusinessErrorCodeValue,
} from '../../../common/errors/business-error-codes';
import { BusinessException } from '../../../common/errors/business.exception';
import type { DeviceIdentity } from '../decorators/current-device.decorator';

interface RequestWithDevice {
  headers: { authorization?: string };
  device?: DeviceIdentity;
}

/**
 * 构造一个 mock ExecutionContext，持有给定 request。
 */
function createContext(request: RequestWithDevice): ExecutionContext {
  return {
    getHandler: () => 'mockHandler',
    getClass: () => 'MockClass',
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

/**
 * 构造一个 mock DeviceTokenService，控制 verify 的返回值。
 */
function createDeviceTokenService(verifyResult: unknown): DeviceTokenService {
  return {
    verify: jest.fn().mockResolvedValue(verifyResult),
  } as unknown as DeviceTokenService;
}

/**
 * 构造一个 mock DeviceTokenService，使 verify 抛指定异常（模拟真实 verify 的契约）。
 */
function createDeviceTokenServiceThrowing(error: Error): DeviceTokenService {
  return {
    verify: jest.fn().mockRejectedValue(error),
  } as unknown as DeviceTokenService;
}

interface PrismaMockOptions {
  deviceResult: { id: number; code: string; storeId: number | null } | null;
}

/**
 * 构造一个 mock PrismaService，控制 device.findFirst 的返回值。
 */
function createPrismaService(options: PrismaMockOptions): PrismaService {
  return {
    device: { findFirst: jest.fn().mockResolvedValue(options.deviceResult) },
  } as unknown as PrismaService;
}

/**
 * 断言 guard 抛出指定状态码、业务码与消息 key 的 BusinessException。
 */
function expectBusinessException(
  guardCall: Promise<boolean>,
  expectedStatus: number,
  expectedCode: BusinessErrorCodeValue,
  expectedMessageKey: string
): Promise<void> {
  return expect(guardCall).rejects.toMatchObject({
    status: expectedStatus,
    businessCode: expectedCode,
    messageKey: expectedMessageKey,
  });
}

describe('DeviceGuard', () => {
  const validPayload = { type: 'device', sub: 7, code: 'DEVICE007' };

  // ===== 1. Authorization 头缺失 → DEVICE_TOKEN_INVALID =====
  it('Authorization 头缺失时抛 401（DEVICE_TOKEN_INVALID），不调用 verify 与查库', async () => {
    const tokenService = createDeviceTokenService(validPayload);
    const prisma = createPrismaService({ deviceResult: null });
    const guard = new DeviceGuard(tokenService, prisma);

    const ctx = createContext({ headers: {} });
    await expectBusinessException(
      guard.canActivate(ctx),
      HttpStatus.UNAUTHORIZED,
      BusinessErrorCode.TOKEN_INVALID,
      'DEVICE_TOKEN_INVALID'
    );
    expect(tokenService.verify).not.toHaveBeenCalled();
    expect(prisma.device.findFirst).not.toHaveBeenCalled();
  });

  // ===== 2. Authorization 头非 Bearer 前缀 → DEVICE_TOKEN_INVALID =====
  it('Authorization 头非 Bearer 前缀时抛 401（DEVICE_TOKEN_INVALID）', async () => {
    const tokenService = createDeviceTokenService(validPayload);
    const prisma = createPrismaService({ deviceResult: null });
    const guard = new DeviceGuard(tokenService, prisma);

    const ctx = createContext({ headers: { authorization: 'Basic abc' } });
    await expectBusinessException(
      guard.canActivate(ctx),
      HttpStatus.UNAUTHORIZED,
      BusinessErrorCode.TOKEN_INVALID,
      'DEVICE_TOKEN_INVALID'
    );
    expect(tokenService.verify).not.toHaveBeenCalled();
  });

  // ===== 3. token 无效（verify 抛 DEVICE_TOKEN_INVALID）→ 透传 401 =====
  it('token 无效（verify 抛异常）时透传 401（DEVICE_TOKEN_INVALID），不查库', async () => {
    const tokenService = createDeviceTokenServiceThrowing(
      new BusinessException(
        'DEVICE_TOKEN_INVALID',
        [],
        BusinessErrorCode.TOKEN_INVALID,
        HttpStatus.UNAUTHORIZED
      )
    );
    const prisma = createPrismaService({ deviceResult: null });
    const guard = new DeviceGuard(tokenService, prisma);

    const ctx = createContext({ headers: { authorization: 'Bearer invalid.token' } });
    await expectBusinessException(
      guard.canActivate(ctx),
      HttpStatus.UNAUTHORIZED,
      BusinessErrorCode.TOKEN_INVALID,
      'DEVICE_TOKEN_INVALID'
    );
    expect(tokenService.verify).toHaveBeenCalledWith('invalid.token');
    expect(prisma.device.findFirst).not.toHaveBeenCalled();
  });

  // ===== 4. payload.type !== 'device' → DEVICE_TOKEN_INVALID（隔离 admin token）=====
  it('payload.type 不为 device 时抛 401（DEVICE_TOKEN_INVALID），不查库', async () => {
    const tokenService = createDeviceTokenService({ type: 'admin', sub: 1, code: 'x' });
    const prisma = createPrismaService({ deviceResult: null });
    const guard = new DeviceGuard(tokenService, prisma);

    const ctx = createContext({ headers: { authorization: 'Bearer admin.token' } });
    await expectBusinessException(
      guard.canActivate(ctx),
      HttpStatus.UNAUTHORIZED,
      BusinessErrorCode.TOKEN_INVALID,
      'DEVICE_TOKEN_INVALID'
    );
    expect(prisma.device.findFirst).not.toHaveBeenCalled();
  });

  // ===== 5. 设备禁用/不存在（findFirst 返回 null）→ DEVICE_DISABLED_OR_NOT_FOUND =====
  it('设备禁用或不存在时抛 401（DEVICE_DISABLED_OR_NOT_FOUND）', async () => {
    const tokenService = createDeviceTokenService(validPayload);
    const prisma = createPrismaService({ deviceResult: null });
    const guard = new DeviceGuard(tokenService, prisma);

    const ctx = createContext({ headers: { authorization: 'Bearer valid.token' } });
    await expectBusinessException(
      guard.canActivate(ctx),
      HttpStatus.UNAUTHORIZED,
      BusinessErrorCode.UNAUTHORIZED,
      'DEVICE_DISABLED_OR_NOT_FOUND'
    );
    expect(prisma.device.findFirst).toHaveBeenCalledWith({
      where: { id: validPayload.sub, status: 1 },
      select: { id: true, code: true, storeId: true },
    });
  });

  // ===== 6. 正常：设备启用且已绑定门店 → 填充 request.device 并放行 =====
  it('设备启用时填充 request.device 并放行', async () => {
    const tokenService = createDeviceTokenService(validPayload);
    const deviceRecord = { id: 7, code: 'DEVICE007', storeId: 12 };
    const prisma = createPrismaService({ deviceResult: deviceRecord });
    const guard = new DeviceGuard(tokenService, prisma);

    const request: RequestWithDevice = {
      headers: { authorization: 'Bearer valid.token' },
    };
    const ctx = createContext(request);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.device).toEqual({ id: 7, code: 'DEVICE007', storeId: 12 });
  });

  // ===== 7. 正常：storeId 为 null（未绑定门店）也放行 =====
  it('设备未绑定门店（storeId=null）时仍放行，request.device.storeId 为 null', async () => {
    const tokenService = createDeviceTokenService(validPayload);
    const deviceRecord = { id: 7, code: 'DEVICE007', storeId: null };
    const prisma = createPrismaService({ deviceResult: deviceRecord });
    const guard = new DeviceGuard(tokenService, prisma);

    const request: RequestWithDevice = {
      headers: { authorization: 'Bearer valid.token' },
    };
    const ctx = createContext(request);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.device).toEqual({ id: 7, code: 'DEVICE007', storeId: null });
  });
});
