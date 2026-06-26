import { Controller, Get, Post, Put, Delete, Param, Query, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { OperationLog } from '../../common/decorators/operation-log.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProgramService } from './program.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { ProgramQueryDto } from './dto/program-query.dto';

@ApiTags('节目管理')
@ApiBearerAuth()
@Controller('programs')
export class ProgramController {
  constructor(private readonly programService: ProgramService) {}

  @Get()
  @RequirePermission('program:list')
  @ApiOperation({
    summary: '分页查询节目列表',
    description: '支持按关键词、屏幕方向、分屏类型、状态筛选',
  })
  @ApiOkResponse({ description: '返回分页节目列表' })
  findAll(@Query() query: ProgramQueryDto) {
    return this.programService.findAll(query);
  }

  @Get(':id')
  @RequirePermission('program:list')
  @ApiOperation({ summary: '获取节目详情' })
  @ApiOkResponse({ description: '返回节目详情（含区域布局配置）' })
  findOne(@Param('id') id: number) {
    return this.programService.findOne(id);
  }

  @Post()
  @RequirePermission('program:create')
  @OperationLog('create', 'program')
  @ApiOperation({
    summary: '创建节目',
    description: '创建草稿或直接发布节目；发布前校验所有素材已审核通过',
  })
  @ApiOkResponse({ description: '创建成功，返回节目信息' })
  create(@Body() dto: CreateProgramDto, @CurrentUser('id') adminId: number) {
    return this.programService.create(dto, adminId);
  }

  @Put(':id')
  @RequirePermission('program:update')
  @OperationLog('update', 'program')
  @ApiOperation({
    summary: '编辑节目',
    description: '更新节目名称、屏幕方向、分屏类型及区域素材配置',
  })
  @ApiOkResponse({ description: '更新成功，返回更新后的节目信息' })
  update(@Param('id') id: number, @Body() dto: UpdateProgramDto) {
    return this.programService.update(id, dto);
  }

  @Put(':id/publish')
  @RequirePermission('program:publish')
  @OperationLog('publish', 'program')
  @ApiOperation({
    summary: '发布节目',
    description: '将节目置为已发布状态，刷新发布时间；可同时更新区域配置',
  })
  @ApiOkResponse({ description: '发布成功，返回节目信息' })
  publish(@Param('id') id: number, @Body() dto: Partial<CreateProgramDto>) {
    return this.programService.publish(id, dto);
  }

  @Delete(':id')
  @RequirePermission('program:delete')
  @OperationLog('delete', 'program')
  @ApiOperation({ summary: '删除节目' })
  @ApiOkResponse({ description: '删除成功' })
  remove(@Param('id') id: number) {
    return this.programService.remove(id);
  }
}
