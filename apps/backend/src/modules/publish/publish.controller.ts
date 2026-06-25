import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PublishService } from './publish.service';
import { CreatePublishPlanDto } from './dto/create-publish-plan.dto';
import { UpdatePublishPlanDto } from './dto/update-publish-plan.dto';
import { PublishQueryDto } from './dto/publish-query.dto';
import { UpdatePublishStatusDto } from './dto/update-publish-status.dto';

@ApiTags('发布管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('publish')
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  @Get()
  @ApiOperation({
    summary: '分页查询发布计划',
    description: '返回列表含目标门店详情（门店名及启用设备数）',
  })
  @ApiOkResponse({ description: '返回分页发布计划列表' })
  findAll(@Query() query: PublishQueryDto) {
    return this.publishService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取发布计划详情' })
  @ApiOkResponse({ description: '返回发布计划详情（含关联节目）' })
  findOne(@Param('id') id: number) {
    return this.publishService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: '创建发布计划',
    description: '仅可选择已发布节目；目标门店需存在且启用',
  })
  @ApiOkResponse({ description: '创建成功，返回发布计划' })
  create(@Body() dto: CreatePublishPlanDto, @CurrentUser('id') adminId: number) {
    return this.publishService.create(dto, adminId);
  }

  @Put(':id')
  @ApiOperation({ summary: '编辑发布计划' })
  @ApiOkResponse({ description: '更新成功，返回更新后的发布计划' })
  update(@Param('id') id: number, @Body() dto: UpdatePublishPlanDto) {
    return this.publishService.update(id, dto);
  }

  @Put(':id/status')
  @ApiOperation({ summary: '更新发布计划状态', description: '启用/停用发布计划' })
  @ApiOkResponse({ description: '状态更新成功' })
  updateStatus(@Param('id') id: number, @Body() dto: UpdatePublishStatusDto) {
    return this.publishService.updateStatus(id, dto);
  }

  @Post(':id/push')
  @ApiOperation({
    summary: '推送发布计划',
    description: '向目标门店的启用设备推送节目，生成推送日志',
  })
  @ApiOkResponse({ description: '推送成功，返回目标设备数和推送日志 ID' })
  push(@Param('id') id: number, @CurrentUser('id') adminId: number) {
    return this.publishService.push(id, adminId);
  }

  @Post('batch-push')
  @ApiOperation({ summary: '批量推送发布计划' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { ids: { type: 'array', items: { type: 'number' }, example: [1, 2] } },
      required: ['ids'],
    },
  })
  @ApiOkResponse({ description: '批量推送结果列表' })
  batchPush(@Body('ids') ids: number[], @CurrentUser('id') adminId: number) {
    return this.publishService.batchPush(ids, adminId);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除发布计划' })
  @ApiOkResponse({ description: '删除成功' })
  remove(@Param('id') id: number) {
    return this.publishService.remove(id);
  }
}
