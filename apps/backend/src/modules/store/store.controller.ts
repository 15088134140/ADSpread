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
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { OperationLog } from '../../common/decorators/operation-log.decorator';
import { CreateStoreDto } from './dto/create-store.dto';
import { StoreQueryDto } from './dto/store-query.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { StoreService } from './store.service';

@ApiTags('门店管理')
@ApiBearerAuth()
@Controller('stores')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get()
  @RequirePermission('store:list')
  @ApiOperation({
    summary: '获取门店列表',
    description: '分页查询门店列表，支持按关键词、行业分类和状态筛选',
  })
  @ApiOkResponse({ description: '成功返回门店列表' })
  findAll(@Query() query: StoreQueryDto) {
    return this.storeService.findAll(query);
  }

  @Get('industry-categories')
  @RequirePermission('store:list')
  @ApiOperation({ summary: '获取行业分类列表', description: '获取所有可用的门店行业分类选项' })
  @ApiOkResponse({ description: '成功返回行业分类列表' })
  industryCategories() {
    return this.storeService.industryCategories();
  }

  @Get('options')
  @RequirePermission('store:list')
  @ApiOperation({ summary: '获取门店选项', description: '获取门店下拉选项列表，用于表单选择' })
  @ApiOkResponse({ description: '成功返回门店选项列表' })
  options() {
    return this.storeService.options();
  }

  @Post()
  @RequirePermission('store:create')
  @OperationLog('create', 'store')
  @ApiOperation({ summary: '创建门店', description: '创建一个新的门店' })
  @ApiOkResponse({ description: '成功创建门店，返回门店信息' })
  create(@Body() dto: CreateStoreDto) {
    return this.storeService.create(dto);
  }

  @Put(':id')
  @RequirePermission('store:update')
  @OperationLog('update', 'store')
  @ApiOperation({ summary: '更新门店', description: '更新指定门店的信息' })
  @ApiOkResponse({ description: '成功更新门店，返回更新后的门店信息' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStoreDto) {
    return this.storeService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('store:delete')
  @OperationLog('delete', 'store')
  @ApiOperation({ summary: '删除门店', description: '删除指定的门店' })
  @ApiOkResponse({ description: '成功删除门店' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.storeService.remove(id);
  }
}
