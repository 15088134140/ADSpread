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
import { CreateDeviceDto } from './dto/create-device.dto';
import { DeviceQueryDto } from './dto/device-query.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DeviceService } from './device.service';

@ApiTags('设备管理')
@ApiBearerAuth()
@Controller('devices')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Get()
  @RequirePermission('device:list')
  @ApiOperation({
    summary: '获取设备列表',
    description: '分页查询设备列表，支持按关键词、门店、屏幕方向、分屏类型和状态筛选',
  })
  @ApiOkResponse({ description: '成功返回设备列表' })
  findAll(@Query() query: DeviceQueryDto) {
    return this.deviceService.findAll(query);
  }

  @Get('resolutions')
  @RequirePermission('device:list')
  @ApiOperation({ summary: '获取分辨率列表', description: '获取所有可用的屏幕分辨率选项' })
  @ApiOkResponse({ description: '成功返回分辨率列表' })
  resolutions() {
    return this.deviceService.resolutions();
  }

  @Get('split-types')
  @RequirePermission('device:list')
  @ApiOperation({ summary: '获取分屏类型列表', description: '获取所有可用的分屏类型选项' })
  @ApiOkResponse({ description: '成功返回分屏类型列表' })
  splitTypes() {
    return this.deviceService.splitTypes();
  }

  @Get('options')
  @RequirePermission('device:list')
  @ApiOperation({ summary: '获取设备选项', description: '获取设备下拉选项列表，用于表单选择' })
  @ApiOkResponse({ description: '成功返回设备选项列表' })
  options() {
    return this.deviceService.options();
  }

  @Post()
  @RequirePermission('device:create')
  @OperationLog('create', 'device')
  @ApiOperation({ summary: '创建设备', description: '创建一个新的设备' })
  @ApiOkResponse({ description: '成功创建设备，返回设备信息' })
  create(@Body() dto: CreateDeviceDto) {
    return this.deviceService.create(dto);
  }

  @Put(':id')
  @RequirePermission('device:update')
  @OperationLog('update', 'device')
  @ApiOperation({ summary: '更新设备', description: '更新指定设备的信息' })
  @ApiOkResponse({ description: '成功更新设备，返回更新后的设备信息' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDeviceDto) {
    return this.deviceService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('device:delete')
  @OperationLog('delete', 'device')
  @ApiOperation({ summary: '删除设备', description: '删除指定的设备' })
  @ApiOkResponse({ description: '成功删除设备' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.deviceService.remove(id);
  }
}
