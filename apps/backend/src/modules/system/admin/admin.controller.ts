import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { OperationLog } from '../../../common/decorators/operation-log.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { QueryAdminDto } from './dto/query-admin.dto';

@ApiTags('系统管理-管理员')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/admins')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @RequirePermission('admin:list')
  @ApiOperation({
    summary: '获取管理员列表',
    description: '分页查询管理员，支持按用户名、姓名、状态、角色筛选',
  })
  @ApiOkResponse({ description: '成功返回管理员列表' })
  findAll(@Query() query: QueryAdminDto) {
    return this.adminService.findAll(query);
  }

  @Post()
  @RequirePermission('admin:create')
  @OperationLog('create', 'admin')
  @ApiOperation({ summary: '创建管理员', description: '新建管理员账号，密码 bcrypt 哈希存储' })
  @ApiOkResponse({ description: '成功创建管理员' })
  create(@Body() dto: CreateAdminDto) {
    return this.adminService.create(dto);
  }

  @Put(':id')
  @RequirePermission('admin:update')
  @OperationLog('update', 'admin')
  @ApiOperation({
    summary: '更新管理员',
    description: '更新指定管理员信息；不可将自身状态置为禁用',
  })
  @ApiOkResponse({ description: '成功更新管理员' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdminDto,
    @CurrentUser('id') currentUserId: number
  ) {
    return this.adminService.update(id, dto, currentUserId);
  }

  @Delete(':id')
  @RequirePermission('admin:update')
  @OperationLog('delete', 'admin')
  @ApiOperation({ summary: '删除管理员', description: '删除指定管理员；不可删除当前登录账号' })
  @ApiOkResponse({ description: '成功删除管理员' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') currentUserId: number) {
    return this.adminService.remove(id, currentUserId);
  }

  @Post(':id/reset-password')
  @RequirePermission('admin:reset-password')
  @OperationLog('reset-password', 'admin')
  @ApiOperation({ summary: '重置管理员密码', description: '由管理员设定新密码，需符合强度规则' })
  @ApiOkResponse({ description: '成功重置密码' })
  resetPassword(@Param('id', ParseIntPipe) id: number, @Body() dto: ResetPasswordDto) {
    return this.adminService.resetPassword(id, dto.newPassword);
  }
}
