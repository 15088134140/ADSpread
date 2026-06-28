import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessErrorCode } from '../../../common/errors/business-error-codes';
import { BusinessException } from '../../../common/errors/business.exception';
import { DeviceTokenService } from '../auth/device-token.service';
import type { DeviceIdentity } from '../decorators/current-device.decorator';

interface RequestWithDevice extends Request {
  device?: DeviceIdentity;
}

/**
 * 设备端鉴权守卫（specs §1.2 / plan §K2）。
 *
 * 设备接口以 @Public() 跳过全局 JwtAuthGuard（其 JwtStrategy 假设 admin payload），
 * 再以 @UseGuards(DeviceGuard) 显式鉴权：
 *  1. 从 Authorization: Bearer <token> 解析设备 token
 *  2. DeviceTokenService.verify 校验签名与过期
 *  3. 校验 payload.type === 'device'，隔离 admin token
 *  4. 查询 prisma.device，要求 status=1（启用），否则视为设备禁用/不存在
 *  5. 填充 request.device = { id, code, storeId } 供后续处理使用
 */
@Injectable()
export class DeviceGuard implements CanActivate {
  constructor(
    private readonly deviceTokenService: DeviceTokenService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithDevice>();
    const token = this.extractToken(request);

    const payload = await this.deviceTokenService.verify(token);
    if (payload.type !== 'device') {
      throw new BusinessException(
        'DEVICE_TOKEN_INVALID',
        [],
        BusinessErrorCode.TOKEN_INVALID,
        HttpStatus.UNAUTHORIZED
      );
    }

    const device = await this.prisma.device.findFirst({
      where: { id: payload.sub, status: 1 },
      select: { id: true, code: true, storeId: true },
    });

    if (!device) {
      throw new BusinessException(
        'DEVICE_DISABLED_OR_NOT_FOUND',
        [],
        BusinessErrorCode.UNAUTHORIZED,
        HttpStatus.UNAUTHORIZED
      );
    }

    request.device = { id: device.id, code: device.code, storeId: device.storeId };
    return true;
  }

  /**
   * 从 Authorization 头解析 Bearer token。缺失或格式不符抛 DEVICE_TOKEN_INVALID。
   */
  private extractToken(request: RequestWithDevice): string {
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new BusinessException(
        'DEVICE_TOKEN_INVALID',
        [],
        BusinessErrorCode.TOKEN_INVALID,
        HttpStatus.UNAUTHORIZED
      );
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new BusinessException(
        'DEVICE_TOKEN_INVALID',
        [],
        BusinessErrorCode.TOKEN_INVALID,
        HttpStatus.UNAUTHORIZED
      );
    }
    return token;
  }
}
