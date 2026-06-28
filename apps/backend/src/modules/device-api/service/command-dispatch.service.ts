import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DeviceGateway } from '../gateway/device.gateway';
import { BusinessException } from '../../../common/errors/business.exception';
import { BusinessErrorCode } from '../../../common/errors/business-error-codes';

/**
 * spec §6.2 D1 不可行指令（普通盒子无系统签名）：后端拒绝下发。
 * 客户端无需处理这两类指令；管理后台应改用 command:restart_app 等替代能力。
 */
const REJECTED_COMMAND_TYPES = new Set<string>([
  'command:restart_device',
  'command:power_schedule',
]);

/**
 * 远程指令下发服务（spec §6.2 / §6.3 / plan Task 5）。
 *
 * 供管理后台/其他模块调用下发指令：
 * - dispatch：写 DeviceCommand(status=0) → 设备在线则立即 emit 并置 status=1，
 *   离线则留队列等网关 handleConnection 补发。
 * - broadcastProgramUpdate：节目变更通知，直接 emit ad:update（不入队，
 *   离线设备重连后由 SyncWorker 兜底全量同步，spec §6.1）。
 *
 * 拒绝 command:restart_device / command:power_schedule（spec D1 不可行）。
 */
@Injectable()
export class CommandDispatchService {
  private readonly logger = new Logger(CommandDispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: DeviceGateway
  ) {}

  /**
   * 下发指令到指定设备。
   * @param deviceCode 设备编码
   * @param type 事件类型（spec §6.2 S→D 指令事件，如 command:screenshot）
   * @param payload 事件载荷（不含 id，id 由 emit 时拼接），如 { level: 50 }
   * @param expireAt 过期时间，超时由后端作废为 status=4（V1 仅写入字段，作废扫描列后续）
   * @returns 指令 UUID，供管理后台追溯与设备 ack 闭环
   */
  async dispatch(
    deviceCode: string,
    type: string,
    payload: Record<string, unknown>,
    expireAt?: Date
  ): Promise<{ commandId: string }> {
    if (REJECTED_COMMAND_TYPES.has(type)) {
      throw new BusinessException(
        'COMMAND_UNSUPPORTED',
        [type],
        BusinessErrorCode.BUSINESS_RULE_VIOLATION
      );
    }

    const device = await this.prisma.device.findFirst({
      where: { code: deviceCode, status: 1 },
      select: { id: true, code: true },
    });
    if (!device) {
      throw new BusinessException('DEVICE_DISABLED_OR_NOT_FOUND');
    }

    const command = await this.prisma.deviceCommand.create({
      data: {
        deviceId: device.id,
        type,
        payload: payload as Prisma.InputJsonValue,
        status: 0,
        expireAt: expireAt ?? null,
      },
    });

    if (this.isDeviceOnline(device.code)) {
      const server = this.gateway.server;
      if (server) {
        server.to(device.code).emit(type, { id: command.id, ...payload });
      }
      await this.prisma.deviceCommand.update({
        where: { id: command.id },
        data: { status: 1 },
      });
      this.logger.log(`指令已即时下发：device=${device.code} type=${type} id=${command.id}`);
    } else {
      this.logger.log(
        `设备离线，指令入队待补发：device=${device.code} type=${type} id=${command.id}`
      );
    }

    return { commandId: command.id };
  }

  /**
   * 节目变更通知（spec §6.2 ad:update）。
   *
   * 直接 emit，不入 DeviceCommand 队列：ad:update 为通知事件无需 ack，
   * 离线设备重连后由 SyncWorker 兜底全量同步（spec §6.1 重连成功立即强制一次 SyncWorker）。
   */
  broadcastProgramUpdate(deviceCode: string, version: string): void {
    const server = this.gateway.server;
    if (!server) {
      this.logger.warn(`server 未就绪，ad:update 未发出：device=${deviceCode} version=${version}`);
      return;
    }
    server.to(deviceCode).emit('ad:update', { version });
    this.logger.log(`ad:update 已发出：device=${deviceCode} version=${version}`);
  }

  /**
   * 判断设备是否在线：设备码 room 是否有 socket。
   *
   * socket.io v4 内存 adapter 的 rooms 为 Map<Room, Set<SocketId>>，
   * 含该 room 即代表至少一个 socket 已 join（handleConnection 成功后 join）。
   */
  private isDeviceOnline(deviceCode: string): boolean {
    const rooms = this.gateway.server?.sockets?.adapter?.rooms;
    return !!rooms?.has(deviceCode);
  }
}
