import { Injectable, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../../common/errors/business.exception';
import { BusinessErrorCode } from '../../common/errors/business-error-codes';
import { STATUS_ENABLED } from '../../common/constants/business.constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async login(username: string, password: string, ip?: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { username },
      include: { role: true },
    });

    if (!admin) {
      throw new BusinessException(
        '用户名或密码错误',
        BusinessErrorCode.UNAUTHORIZED,
        HttpStatus.UNAUTHORIZED
      );
    }

    if (admin.status !== STATUS_ENABLED) {
      throw new BusinessException('账号已禁用', BusinessErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }

    const passwordOk = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordOk) {
      throw new BusinessException(
        '用户名或密码错误',
        BusinessErrorCode.UNAUTHORIZED,
        HttpStatus.UNAUTHORIZED
      );
    }

    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    });

    const token = await this.jwtService.signAsync({
      sub: admin.id,
      username: admin.username,
      name: admin.name,
      roleId: admin.roleId,
    });

    const { passwordHash, ...userInfo } = admin;

    return {
      token,
      userInfo,
    };
  }
}
