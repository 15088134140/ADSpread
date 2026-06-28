import { CommandDispatchService } from './command-dispatch.service';
import { DeviceGateway } from '../gateway/device.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessException } from '../../../common/errors/business.exception';
import { BusinessErrorCode } from '../../../common/errors/business-error-codes';

/**
 * 构造 mock socket.io Server：to(code).emit(...) 链式，
 * sockets.adapter.rooms.has(code) 控制在线判断。
 */
function createMockServer(online: boolean) {
  const emit = jest.fn();
  const to = jest.fn().mockReturnValue({ emit });
  return {
    to,
    _emit: emit,
    sockets: { adapter: { rooms: { has: jest.fn().mockReturnValue(online) } } },
  };
}

function createMockGateway(server: any): DeviceGateway {
  return { server } as unknown as DeviceGateway;
}

describe('CommandDispatchService', () => {
  const deviceCode = 'DEVICE007';
  const deviceRecord = { id: 7, code: deviceCode };

  const prisma = {
    device: { findFirst: jest.fn() },
    deviceCommand: { create: jest.fn(), update: jest.fn() },
  } as unknown as PrismaService;

  let mockServer: ReturnType<typeof createMockServer>;
  let gateway: DeviceGateway;
  let service: CommandDispatchService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockServer = createMockServer(true);
    gateway = createMockGateway(mockServer);
    service = new CommandDispatchService(prisma, gateway);
  });

  describe('dispatch', () => {
    it('设备在线：写 status=0 → emit → 置 status=1，返回 commandId', async () => {
      (prisma.device.findFirst as jest.Mock).mockResolvedValue(deviceRecord);
      (prisma.deviceCommand.create as jest.Mock).mockResolvedValue({
        id: 'cmd-uuid-1',
      });

      const result = await service.dispatch(deviceCode, 'command:screenshot', {});

      expect(result).toEqual({ commandId: 'cmd-uuid-1' });

      // 写入 status=0
      expect(prisma.deviceCommand.create).toHaveBeenCalledWith({
        data: {
          deviceId: 7,
          type: 'command:screenshot',
          payload: {},
          status: 0,
          expireAt: null,
        },
      });

      // 在线：emit 到设备码 room
      expect(mockServer.to).toHaveBeenCalledWith(deviceCode);
      expect(mockServer._emit).toHaveBeenCalledWith('command:screenshot', {
        id: 'cmd-uuid-1',
      });

      // 置 status=1
      expect(prisma.deviceCommand.update).toHaveBeenCalledWith({
        where: { id: 'cmd-uuid-1' },
        data: { status: 1 },
      });
    });

    it('payload 字段展开到 { id } 同级（command:volume level）', async () => {
      (prisma.device.findFirst as jest.Mock).mockResolvedValue(deviceRecord);
      (prisma.deviceCommand.create as jest.Mock).mockResolvedValue({
        id: 'cmd-uuid-2',
      });

      await service.dispatch(deviceCode, 'command:volume', { level: 50 });

      expect(mockServer._emit).toHaveBeenCalledWith('command:volume', {
        id: 'cmd-uuid-2',
        level: 50,
      });
    });

    it('expireAt 透传到 DeviceCommand 记录', async () => {
      (prisma.device.findFirst as jest.Mock).mockResolvedValue(deviceRecord);
      (prisma.deviceCommand.create as jest.Mock).mockResolvedValue({
        id: 'cmd-uuid-3',
      });
      const expireAt = new Date('2026-12-31T23:59:59Z');

      await service.dispatch(deviceCode, 'command:reload', {}, expireAt);

      expect(prisma.deviceCommand.create).toHaveBeenCalledWith({
        data: {
          deviceId: 7,
          type: 'command:reload',
          payload: {},
          status: 0,
          expireAt,
        },
      });
    });

    it('设备离线：写 status=0 后不 emit 不置 1，留队列待补发', async () => {
      mockServer = createMockServer(false);
      gateway = createMockGateway(mockServer);
      service = new CommandDispatchService(prisma, gateway);

      (prisma.device.findFirst as jest.Mock).mockResolvedValue(deviceRecord);
      (prisma.deviceCommand.create as jest.Mock).mockResolvedValue({
        id: 'cmd-uuid-offline',
      });

      const result = await service.dispatch(deviceCode, 'command:stop', {});

      expect(result).toEqual({ commandId: 'cmd-uuid-offline' });
      expect(prisma.deviceCommand.create).toHaveBeenCalledWith({
        data: {
          deviceId: 7,
          type: 'command:stop',
          payload: {},
          status: 0,
          expireAt: null,
        },
      });
      expect(mockServer.to).not.toHaveBeenCalled();
      expect(prisma.deviceCommand.update).not.toHaveBeenCalled();
    });

    it('拒绝 command:restart_device：抛 COMMAND_UNSUPPORTED，不查设备不写指令', async () => {
      await expect(
        service.dispatch(deviceCode, 'command:restart_device', {})
      ).rejects.toMatchObject({
        messageKey: 'COMMAND_UNSUPPORTED',
        businessCode: BusinessErrorCode.BUSINESS_RULE_VIOLATION,
      });
      expect(prisma.device.findFirst).not.toHaveBeenCalled();
      expect(prisma.deviceCommand.create).not.toHaveBeenCalled();
    });

    it('拒绝 command:power_schedule：抛 COMMAND_UNSUPPORTED', async () => {
      await expect(
        service.dispatch(deviceCode, 'command:power_schedule', {})
      ).rejects.toMatchObject({ messageKey: 'COMMAND_UNSUPPORTED' });
    });

    it('设备不存在或禁用：抛 DEVICE_DISABLED_OR_NOT_FOUND', async () => {
      (prisma.device.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.dispatch('MISSING', 'command:screenshot', {})).rejects.toMatchObject({
        messageKey: 'DEVICE_DISABLED_OR_NOT_FOUND',
      });

      expect(prisma.device.findFirst).toHaveBeenCalledWith({
        where: { code: 'MISSING', status: 1 },
        select: { id: true, code: true },
      });
      expect(prisma.deviceCommand.create).not.toHaveBeenCalled();
    });

    it('command:restart_app 等标准档能力不被拒绝', async () => {
      (prisma.device.findFirst as jest.Mock).mockResolvedValue(deviceRecord);
      (prisma.deviceCommand.create as jest.Mock).mockResolvedValue({
        id: 'cmd-restart-app',
      });

      await expect(service.dispatch(deviceCode, 'command:restart_app', {})).resolves.toEqual({
        commandId: 'cmd-restart-app',
      });
    });

    it('COMMAND_UNSUPPORTED 异常携带 type 作为消息参数', async () => {
      try {
        await service.dispatch(deviceCode, 'command:restart_device', {});
        fail('应抛异常');
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).messageParams).toEqual(['command:restart_device']);
      }
    });
  });

  describe('broadcastProgramUpdate', () => {
    it('向设备码 room emit ad:update { version }', () => {
      service.broadcastProgramUpdate(deviceCode, '1719360000000');

      expect(mockServer.to).toHaveBeenCalledWith(deviceCode);
      expect(mockServer._emit).toHaveBeenCalledWith('ad:update', {
        version: '1719360000000',
      });
    });

    it('server 未就绪时不 emit（仅记录日志，不抛错）', () => {
      const offlineGateway = createMockGateway(undefined);
      const offlineService = new CommandDispatchService(prisma, offlineGateway);

      expect(() => offlineService.broadcastProgramUpdate(deviceCode, 'v1')).not.toThrow();
      expect(mockServer.to).not.toHaveBeenCalled();
      expect(prisma.deviceCommand.create).not.toHaveBeenCalled();
    });
  });

  describe('在线判断', () => {
    it('isDeviceOnline 通过 sockets.adapter.rooms.has 判断', async () => {
      (prisma.device.findFirst as jest.Mock).mockResolvedValue(deviceRecord);
      (prisma.deviceCommand.create as jest.Mock).mockResolvedValue({
        id: 'cmd-x',
      });

      await service.dispatch(deviceCode, 'command:screenshot', {});

      expect(mockServer.sockets.adapter.rooms.has).toHaveBeenCalledWith(deviceCode);
    });
  });
});
