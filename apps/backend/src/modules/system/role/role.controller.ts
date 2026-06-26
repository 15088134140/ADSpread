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
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { QueryRoleDto } from './dto/query-role.dto';
import { AssignRoleMenusDto } from './dto/assign-role-menus.dto';

@ApiTags('系统管理-角色')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @RequirePermission('role:list')
  @ApiOperation({ summary: '获取角色列表', description: '分页查询角色，支持按名称、状态筛选' })
  @ApiOkResponse({ description: '成功返回角色列表' })
  findAll(@Query() query: QueryRoleDto) {
    return this.roleService.findAll(query);
  }

  @Get('options')
  @RequirePermission('role:list')
  @ApiOperation({
    summary: '获取角色下拉选项',
    description: '返回启用的角色 {id,name} 列表，用于表单下拉',
  })
  @ApiOkResponse({ description: '成功返回角色选项' })
  options() {
    return this.roleService.options();
  }

  @Post()
  @RequirePermission('role:create')
  @ApiOperation({ summary: '创建角色', description: '新建角色，名称唯一' })
  @ApiOkResponse({ description: '成功创建角色' })
  create(@Body() dto: CreateRoleDto) {
    return this.roleService.create(dto);
  }

  @Put(':id')
  @RequirePermission('role:update')
  @ApiOperation({ summary: '更新角色', description: '更新指定角色信息' })
  @ApiOkResponse({ description: '成功更新角色' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto) {
    return this.roleService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('role:delete')
  @ApiOperation({
    summary: '删除角色',
    description: '删除指定角色；有关联管理员或超管角色不可删除',
  })
  @ApiOkResponse({ description: '成功删除角色' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.roleService.remove(id);
  }

  @Put(':id/menus')
  @RequirePermission('role:assign')
  @OperationLog('assign', 'role')
  @ApiOperation({
    summary: '分配角色菜单权限',
    description: '整体覆盖角色的 menuIds；超管角色不可改',
  })
  @ApiOkResponse({ description: '成功分配权限' })
  assignMenus(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignRoleMenusDto) {
    return this.roleService.assignMenus(id, dto.menuIds);
  }
}
