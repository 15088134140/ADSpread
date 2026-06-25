import { Body, Controller, Ip, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: '管理员登录', description: '用户名密码登录，返回 JWT token 和用户信息' })
  @ApiOkResponse({ description: '登录成功，返回 token 和 userInfo' })
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto.username, dto.password, ip);
  }
}
