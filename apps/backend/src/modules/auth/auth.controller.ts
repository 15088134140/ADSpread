import { Body, Controller, Get, Headers, Ip, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedOnly } from '../../common/decorators/authenticated-only.decorator';
import { OperationLog } from '../../common/decorators/operation-log.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtUser } from '../../common/decorators/current-user.decorator';

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @ApiOperation({ summary: '管理员登录', description: '用户名密码登录，返回 JWT token 和用户信息' })
  @ApiOkResponse({ description: '登录成功，返回 token 和 userInfo' })
  login(@Body() dto: LoginDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    return this.authService.login(dto.username, dto.password, ip, userAgent);
  }

  @Post('logout')
  @AuthenticatedOnly()
  @ApiOperation({ summary: '登出', description: '记录登出日志；前端清除 token' })
  @ApiOkResponse({ description: '登出成功' })
  @ApiBearerAuth()
  logout(
    @CurrentUser() user: JwtUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string
  ) {
    return this.authService.logout(user, ip, userAgent);
  }

  @Get('me')
  @AuthenticatedOnly()
  @ApiOperation({
    summary: '获取当前用户信息',
    description: '返回当前管理员及角色信息（不含密码）',
  })
  @ApiOkResponse({ description: '返回当前用户信息' })
  @ApiBearerAuth()
  me(@CurrentUser('id') userId: number) {
    return this.authService.me(userId);
  }

  @Get('menus')
  @AuthenticatedOnly()
  @ApiOperation({
    summary: '获取当前用户可见菜单树',
    description: '超级管理员返回全部启用菜单；普通用户按角色 menuIds 过滤（含按钮节点）',
  })
  @ApiOkResponse({ description: '返回菜单树' })
  @ApiBearerAuth()
  menus(@CurrentUser() user: JwtUser) {
    return this.authService.menus(user);
  }

  @Post('change-password')
  @AuthenticatedOnly()
  @OperationLog('change-password', 'admin')
  @ApiOperation({ summary: '修改自己的密码', description: '校验旧密码，新密码需符合强度规则' })
  @ApiOkResponse({ description: '修改成功' })
  @ApiBearerAuth()
  changePassword(@CurrentUser('id') userId: number, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(userId, dto.oldPassword, dto.newPassword);
  }
}
