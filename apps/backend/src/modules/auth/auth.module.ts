import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';
import { SystemModule } from '../system/system.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    // SystemModule re-export 了 LogModule(OperationLogService) 与 MenuModule(MenuService)，
    // 供 AuthService 写登录/登出日志与构建用户菜单树。无循环依赖。
    SystemModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'adspread-dev-secret',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
