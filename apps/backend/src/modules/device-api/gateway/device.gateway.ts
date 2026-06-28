import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Prisma } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { DeviceTokenService } from '../auth/device-token.service';
import { DeviceApiService } from '../device-api.service';
import type { DeviceIdentity } from '../decorators/current-device.decorator';

/**
 * 设备实时通道网关（spec §6 / plan §K5 / Task 5）。
 *
 * - path '/socket.io/'，独立于全局 /api 前缀（main.ts setGlobalPrefix 不影响网关 path）。
 * - handleConnection 从 handshake.auth.token（兼容 Authorization: Bearer 头）取设备 token，
 *   DeviceTokenService.verify 校验 → type==='device' → 查设备 status=1 → socket.join(device.code)。
 *   任一环节失败 socket.disconnect(true)。
 * - 设备上线后补发离线指令（DeviceCommand status=0 且未过期），逐条 emit 并置 status=1。
 * - @SubscribeMessage('device:ack') 复用 DeviceApiService.ackCommand 闭环指令状态。
 * - 设备码 room：管理后台/CommandDispatchService 经 server.to(deviceCode).emit 下发。
 */
@WebSocketGateway({ path: '/socket.io/', cors: true })
export class DeviceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(DeviceGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly deviceTokenService: DeviceTokenService,
    private readonly prisma: PrismaService,
    private readonly deviceApiService: DeviceApiService
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    const token = this.extractToken(socket);
    if (!token) {
      this.logger.warn(`连接拒绝：缺少设备令牌 (socket ${socket.id})`);
      socket.disconnect(true);
      return;
    }

    let payload: { type: string; sub: number; code: string };
    try {
      payload = await this.deviceTokenService.verify(token);
    } catch {
      this.logger.warn(`连接拒绝：设备令牌无效或已过期 (socket ${socket.id})`);
      socket.disconnect(true);
      return;
    }

    if (payload.type !== 'device') {
      this.logger.warn(`连接拒绝：令牌类型非 device (socket ${socket.id})`);
      socket.disconnect(true);
      return;
    }

    const device = await this.prisma.device.findFirst({
      where: { id: payload.sub, status: 1 },
      select: { id: true, code: true, storeId: true },
    });
    if (!device) {
      this.logger.warn(`连接拒绝：设备已禁用或不存在 (socket ${socket.id})`);
      socket.disconnect(true);
      return;
    }

    // 挂载设备身份供 @SubscribeMessage('device:ack') 取用
    const identity: DeviceIdentity = {
      id: device.id,
      code: device.code,
      storeId: device.storeId,
    };
    socket.data.device = identity;

    await socket.join(device.code);
    this.logger.log(`设备已连接：code=${device.code} (socket ${socket.id})`);

    // 补发离线指令（status=0 且未过期）
    await this.replayPendingCommands(socket, device.id);
  }

  handleDisconnect(socket: Socket): void {
    const device = socket.data?.device as DeviceIdentity | undefined;
    if (device) {
      this.logger.log(`设备已断开：code=${device.code} (socket ${socket.id})`);
    }
    // 设备码 room 由 socket.io 自动清理（socket 离开所有 room），无需手动 leave
  }

  /**
   * 处理设备指令回执（spec §6.2 device:ack）。
   *
   * 复用 DeviceApiService.ackCommand 闭环状态：result='success'→status=2，其他→status=3，
   * ack 结果合并写入指令 payload。返回值作为 socket.io ack 回执回传设备。
   */
  @SubscribeMessage('device:ack')
  async handleAck(
    @MessageBody()
    data: { id: string; result: string; error?: string; screenshotUrl?: string },
    @ConnectedSocket() socket: Socket
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const device = socket.data?.device as DeviceIdentity | undefined;
    if (!device) {
      // 未鉴权连接不应到达此处（handleConnection 失败已 disconnect）
      return { ok: false, reason: 'unauthorized' };
    }
    try {
      await this.deviceApiService.ackCommand(device, data.id, {
        result: data.result,
        error: data.error,
        screenshotUrl: data.screenshotUrl,
      });
      return { ok: true };
    } catch (err) {
      this.logger.warn(`ack 处理失败：commandId=${data.id} reason=${(err as Error).message}`);
      return { ok: false, reason: 'failed' };
    }
  }

  /**
   * 补发离线指令：查 status=0 且未过期（expireAt 为 null 或 >= now）的指令，
   * 按 createdAt 升序逐条 emit，并置 status=1（已下发）。
   *
   * emit 载荷为 { id, ...payload }：id 由指令记录提供，payload 存具体字段（如 { level }）。
   */
  private async replayPendingCommands(socket: Socket, deviceId: number): Promise<void> {
    const now = new Date();
    const pending = await this.prisma.deviceCommand.findMany({
      where: {
        deviceId,
        status: 0,
        OR: [{ expireAt: null }, { expireAt: { gte: now } }],
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!pending.length) return;
    this.logger.log(`补发离线指令：deviceId=${deviceId} count=${pending.length}`);

    for (const cmd of pending) {
      const payload = (cmd.payload as Prisma.JsonObject | null) ?? {};
      socket.emit(cmd.type, { id: cmd.id, ...payload });
      await this.prisma.deviceCommand.update({
        where: { id: cmd.id },
        data: { status: 1 },
      });
    }
  }

  /**
   * 从握手提取设备 token：优先 handshake.auth.token（spec §6.1 io({auth:{token}})），
   * 回退 Authorization: Bearer 头（兼容客户端走 header 的场景）。
   */
  private extractToken(socket: Socket): string | null {
    const auth = socket.handshake.auth as { token?: unknown } | undefined;
    if (typeof auth?.token === 'string' && auth.token.length > 0) {
      return auth.token;
    }
    const header = socket.handshake.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      const token = header.slice('Bearer '.length).trim();
      if (token) return token;
    }
    // 回退：Android 端 Socket 创建时 auth 可能为空（Singleton 注入早于绑定），token 通过 query 传递
    const query = socket.handshake.query as { token?: string } | undefined;
    if (typeof query?.token === 'string' && query.token.length > 0) {
      return query.token;
    }
    return null;
  }
}
