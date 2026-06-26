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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { OperationLog } from '../../../common/decorators/operation-log.decorator';
import { MenuService } from './menu.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { QueryMenuDto } from './dto/query-menu.dto';

@ApiTags('系统管理-菜单')
@ApiBearerAuth()
@Controller('admin/menus')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  @RequirePermission('menu:list')
  @ApiOperation({
    summary: '获取菜单列表',
    description: '分页查询菜单，支持按名称、状态、类型筛选',
  })
  @ApiOkResponse({ description: '成功返回菜单列表' })
  findAll(@Query() query: QueryMenuDto) {
    return this.menuService.findAll(query);
  }

  @Get('tree')
  @RequirePermission('menu:list')
  @ApiOperation({
    summary: '获取菜单树',
    description: '返回按 parentId 自关联、按 sort 排序的菜单树（默认仅启用）',
  })
  @ApiOkResponse({ description: '成功返回菜单树' })
  findTree() {
    return this.menuService.findTree(true);
  }

  @Get('options')
  @RequirePermission('menu:list')
  @ApiOperation({ summary: '获取菜单下拉选项', description: '返回启用的菜单 {id,name} 列表' })
  @ApiOkResponse({ description: '成功返回菜单选项' })
  options() {
    return this.menuService.options();
  }

  @Post()
  @RequirePermission('menu:create')
  @OperationLog('create', 'menu')
  @ApiOperation({ summary: '创建菜单', description: '新建菜单节点' })
  @ApiOkResponse({ description: '成功创建菜单' })
  create(@Body() dto: CreateMenuDto) {
    return this.menuService.create(dto);
  }

  @Put(':id')
  @RequirePermission('menu:update')
  @OperationLog('update', 'menu')
  @ApiOperation({ summary: '更新菜单', description: '更新指定菜单信息' })
  @ApiOkResponse({ description: '成功更新菜单' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMenuDto) {
    return this.menuService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('menu:delete')
  @OperationLog('delete', 'menu')
  @ApiOperation({ summary: '删除菜单', description: '删除指定菜单；有子菜单不可删除' })
  @ApiOkResponse({ description: '成功删除菜单' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.menuService.remove(id);
  }
}
