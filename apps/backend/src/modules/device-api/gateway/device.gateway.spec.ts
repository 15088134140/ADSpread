import { DeviceGateway } from './device.gateway';
import { DeviceTokenService } from '../auth/device-token.service';
import { DeviceApiService } from '../device-api.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../../common/errors/business.exception';
import { BusinessErrorCode } from '../../../common/errors/business-error-codes';
import type { DeviceIdentity } from '../decorators/current-device.decorator';

/**
 * 构造 mock socket.io Socket，覆盖 handleConnection/handleAck 用到的成员：
 * handshake.auth.token / handshake.headers.authorization / join / disconnect / emit / data。
 */
function createMockSocket(opts: { authToken?: string; authHeader?: string }): any {
  return {
    id: 'sock-1',
    handshake: {
      auth: opts.authToken !== undefined ? { token: opts.authToken } : {},
      headers: opts.authHeader ? { authorization: opts.authHeader } : {},
    },
    data: {},
    join: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    emit: jest.fn(),
  };
}

describe('DeviceGateway', () => {
  const validPayload = { type: 'device', sub: 7, code: 'DEVICE007' };
  const deviceRecord = { id: 7, code: 'DEVICE007', storeId: 12 };

  const prisma = {
    device: { findFirst: jest.fn() },
    deviceCommand: { findMany: jest.fn(), update: jest.fn() },
  } as unknown as PrismaService;

  const deviceTokenService = {
    verify: jest.fn(),
  } as unknown as DeviceTokenService;

  const deviceApiService = {
    ackCommand: jest.fn(),
  } as unknown as DeviceApiService;

  let gateway: DeviceGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new DeviceGateway(deviceTokenService, prisma, deviceApiService);
  });

  describe('handleConnection 鉴权', () => {
    it('缺少 token（无 auth.token 也无 Authorization 头）时断开连接，不校验不查库', async () => {
      const socket = createMockSocket({});
      await gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalled();
      expect(deviceTokenService.verify).not.toHaveBeenCalled();
      expect(prisma.device.findFirst).not.toHaveBeenCalled();
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('auth.token 为空字符串时视为缺少 token 断开', async () => {
      const socket = createMockSocket({ authToken: '' });
      await gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalled();
      expect(deviceTokenService.verify).not.toHaveBeenCalled();
    });

    it('verify 抛异常（token 无效）时断开连接，不查库', async () => {
      (deviceTokenService.verify as jest.Mock).mockRejectedValue(
        new BusinessException('DEVICE_TOKEN_INVALID', [], BusinessErrorCode.TOKEN_INVALID)
      );
      const socket = createMockSocket({ authToken: 'invalid.token' });

      await gateway.handleConnection(socket);

      expect(deviceTokenService.verify).toHaveBeenCalledWith('invalid.token');
      expect(socket.disconnect).toHaveBeenCalled();
      expect(prisma.device.findFirst).not.toHaveBeenCalled();
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('payload.type 非 device 时断开连接，不查库', async () => {
      (deviceTokenService.verify as jest.Mock).mockResolvedValue({
        type: 'admin',
        sub: 1,
        code: 'x',
      });
      const socket = createMockSocket({ authToken: 'admin.token' });

      await gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalled();
      expect(prisma.device.findFirst).not.toHaveBeenCalled();
    });

    it('设备禁用/不存在（findFirst 返回 null）时断开连接，不 join', async () => {
      (deviceTokenService.verify as jest.Mock).mockResolvedValue(validPayload);
      (prisma.device.findFirst as jest.Mock).mockResolvedValue(null);
      const socket = createMockSocket({ authToken: 'valid.token' });

      await gateway.handleConnection(socket);

      expect(prisma.device.findFirst).toHaveBeenCalledWith({
        where: { id: validPayload.sub, status: 1 },
        select: { id: true, code: true, storeId: true },
      });
      expect(socket.disconnect).toHaveBeenCalled();
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('Authorization: Bearer 头亦可提取 token（兼容 header 方式）', async () => {
      (deviceTokenService.verify as jest.Mock).mockResolvedValue(validPayload);
      (prisma.device.findFirst as jest.Mock).mockResolvedValue(deviceRecord);
      (prisma.deviceCommand.findMany as jest.Mock).mockResolvedValue([]);
      const socket = createMockSocket({ authHeader: 'Bearer header.token' });

      await gateway.handleConnection(socket);

      expect(deviceTokenService.verify).toHaveBeenCalledWith('header.token');
      expect(socket.join).toHaveBeenCalledWith('DEVICE007');
    });

    it('auth.token 优先于 Authorization 头', async () => {
      (deviceTokenService.verify as jest.Mock).mockResolvedValue(validPayload);
      (prisma.device.findFirst as jest.Mock).mockResolvedValue(deviceRecord);
      (prisma.deviceCommand.findMany as jest.Mock).mockResolvedValue([]);
      const socket = createMockSocket({
        authToken: 'auth.token',
        authHeader: 'Bearer header.token',
      });

      await gateway.handleConnection(socket);

      expect(deviceTokenService.verify).toHaveBeenCalledWith('auth.token');
    });
  });

  describe('handleConnection 成功', () => {
    beforeEach(() => {
      (deviceTokenService.verify as jest.Mock).mockResolvedValue(validPayload);
      (prisma.device.findFirst as jest.Mock).mockResolvedValue(deviceRecord);
    });

    it('join 设备码 room 并挂载 device 身份到 socket.data', async () => {
      (prisma.deviceCommand.findMany as jest.Mock).mockResolvedValue([]);
      const socket = createMockSocket({ authToken: 'valid.token' });

      await gateway.handleConnection(socket);

      expect(socket.join).toHaveBeenCalledWith('DEVICE007');
      expect(socket.data.device).toEqual({
        id: 7,
        code: 'DEVICE007',
        storeId: 12,
      } satisfies DeviceIdentity);
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('无离线指令时不 emit 不 update', async () => {
      (prisma.deviceCommand.findMany as jest.Mock).mockResolvedValue([]);
      const socket = createMockSocket({ authToken: 'valid.token' });

      await gateway.handleConnection(socket);

      expect(prisma.deviceCommand.findMany).toHaveBeenCalledWith({
        where: {
          deviceId: 7,
          status: 0,
          OR: [{ expireAt: null }, { expireAt: { gte: expect.any(Date) } }],
        },
        orderBy: { createdAt: 'asc' },
      });
      expect(socket.emit).not.toHaveBeenCalled();
      expect(prisma.deviceCommand.update).not.toHaveBeenCalled();
    });

    it('补发离线指令：逐条 emit 并置 status=1，payload 展开到 { id } 同级', async () => {
      const now = new Date();
      (prisma.deviceCommand.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'cmd-1',
          type: 'command:screenshot',
          payload: {},
          createdAt: now,
        },
        {
          id: 'cmd-2',
          type: 'command:volume',
          payload: { level: 50 },
          createdAt: now,
        },
      ]);
      const socket = createMockSocket({ authToken: 'valid.token' });

      await gateway.handleConnection(socket);

      // 逐条 emit：id 由指令提供，payload 字段展开
      expect(socket.emit).toHaveBeenCalledTimes(2);
      expect(socket.emit).toHaveBeenNthCalledWith(1, 'command:screenshot', {
        id: 'cmd-1',
      });
      expect(socket.emit).toHaveBeenNthCalledWith(2, 'command:volume', {
        id: 'cmd-2',
        level: 50,
      });

      // 逐条置 status=1
      expect(prisma.deviceCommand.update).toHaveBeenCalledTimes(2);
      expect(prisma.deviceCommand.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'cmd-1' },
        data: { status: 1 },
      });
      expect(prisma.deviceCommand.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'cmd-2' },
        data: { status: 1 },
      });
    });

    it('补发时 payload 为 null 安全退化为 {}（仅 emit id）', async () => {
      (prisma.deviceCommand.findMany as jest.Mock).mockResolvedValue([
        { id: 'cmd-x', type: 'command:stop', payload: null, createdAt: new Date() },
      ]);
      const socket = createMockSocket({ authToken: 'valid.token' });

      await gateway.handleConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('command:stop', { id: 'cmd-x' });
    });
  });

  describe('handleDisconnect', () => {
    it('已鉴权设备断开时记录日志（room 自动清理，无需手动 leave）', () => {
      const socket = createMockSocket({ authToken: 'valid.token' });
      socket.data.device = { id: 7, code: 'DEVICE007', storeId: 12 };

      expect(gateway.handleDisconnect(socket)).toBeUndefined();
      // 无异常即通过；room 由 socket.io 自动清理
    });

    it('未鉴权 socket 断开时不抛错', () => {
      const socket = createMockSocket({});
      expect(gateway.handleDisconnect(socket)).toBeUndefined();
    });
  });

  describe('handleAck (device:ack)', () => {
    const device: DeviceIdentity = { id: 7, code: 'DEVICE007', storeId: 12 };

    it('成功：调用 ackCommand 并返回 { ok: true }', async () => {
      (deviceApiService.ackCommand as jest.Mock).mockResolvedValue({});
      const socket = createMockSocket({ authToken: 'valid.token' });
      socket.data.device = device;

      const result = await gateway.handleAck(
        { id: 'cmd-1', result: 'success', screenshotUrl: '/uploads/x.jpg' },
        socket
      );

      expect(deviceApiService.ackCommand).toHaveBeenCalledWith(device, 'cmd-1', {
        result: 'success',
        error: undefined,
        screenshotUrl: '/uploads/x.jpg',
      });
      expect(result).toEqual({ ok: true });
    });

    it('失败结果（result 非 success）透传给 ackCommand', async () => {
      (deviceApiService.ackCommand as jest.Mock).mockResolvedValue({});
      const socket = createMockSocket({ authToken: 'valid.token' });
      socket.data.device = device;

      await gateway.handleAck({ id: 'cmd-2', result: 'failed', error: 'timeout' }, socket);

      expect(deviceApiService.ackCommand).toHaveBeenCalledWith(device, 'cmd-2', {
        result: 'failed',
        error: 'timeout',
        screenshotUrl: undefined,
      });
    });

    it('socket.data 无 device（未鉴权）时返回 { ok: false, reason: unauthorized }', async () => {
      const socket = createMockSocket({});
      // socket.data 无 device

      const result = await gateway.handleAck({ id: 'cmd-1', result: 'success' }, socket);

      expect(result).toEqual({ ok: false, reason: 'unauthorized' });
      expect(deviceApiService.ackCommand).not.toHaveBeenCalled();
    });

    it('ackCommand 抛异常（指令不存在）时返回 { ok: false, reason: failed }', async () => {
      (deviceApiService.ackCommand as jest.Mock).mockRejectedValue(
        new BusinessException('COMMAND_NOT_FOUND')
      );
      const socket = createMockSocket({ authToken: 'valid.token' });
      socket.data.device = device;

      const result = await gateway.handleAck({ id: 'missing', result: 'success' }, socket);

      expect(result).toEqual({ ok: false, reason: 'failed' });
    });
  });
});
