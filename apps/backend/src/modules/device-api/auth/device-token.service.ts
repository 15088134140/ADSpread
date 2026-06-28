import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BusinessErrorCode } from '../../../common/errors/business-error-codes';
import { BusinessException } from '../../../common/errors/business.exception';

/**
 * 设备 token 的 JWT payload 结构（plan §K1）。
 *
 * type 字段在运行时由 DeviceGuard 校验为 'device'，故此处声明为 string，
 * 使守卫的 type 守卫不沦为 TS 永真比较。sub 为设备 id，code 为设备编码。
 */
export interface DeviceTokenPayload {
  type: string;
  sub: number;
  code: string;
  iat?: number;
  exp?: number;
}

/**
 * 签发设备 token 所需的最小设备信息。Device 实体天然满足该结构。
 */
export interface DeviceTokenInput {
  id: number;
  code: string;
}

/**
 * 设备端无状态鉴权 token 服务（specs §1.2 / plan §K1）。
 *
 * deviceToken 不落库，复用 JwtModule 与 admin 相同的 secret
 * （process.env.JWT_SECRET || 'adspread-dev-secret'），签发携带
 * { type:'device', sub:deviceId, code:deviceCode } 的 JWT，有效期 90d。
 *
 * 与 admin JWT 的隔离：admin payload 无 type 字段，DeviceGuard 通过
 * payload.type === 'device' 显式收窄，避免 admin token 误用于设备接口。
 */
@Injectable()
export class DeviceTokenService {
  constructor(private readonly jwtService: JwtService) {}

  /**
   * 签发设备 token。expiresIn 由模块级 JwtModule.register 的 signOptions 配置为 90d。
   */
  async issue(device: DeviceTokenInput): Promise<string> {
    return this.jwtService.signAsync({
      type: 'device',
      sub: device.id,
      code: device.code,
    });
  }

  /**
   * 校验设备 token。JWT 签名/过期异常统一转为 DEVICE_TOKEN_INVALID；
   * payload.type 的语义校验由 DeviceGuard 负责。
   */
  async verify(token: string): Promise<DeviceTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<DeviceTokenPayload>(token);
    } catch {
      throw new BusinessException(
        'DEVICE_TOKEN_INVALID',
        [],
        BusinessErrorCode.TOKEN_INVALID,
        HttpStatus.UNAUTHORIZED
      );
    }
  }
}
