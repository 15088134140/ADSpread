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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { ImportResult } from '@adspread/types';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { OperationLog } from '../../common/decorators/operation-log.decorator';
import { BusinessException } from '../../common/errors/business.exception';
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

  @Get('import-template')
  @RequirePermission('device:import')
  @ApiOperation({
    summary: '下载设备导入模板',
    description: '生成并下载 xlsx 模板（含表头、示例行与填写说明）',
  })
  @ApiOkResponse({ description: '返回 xlsx 模板文件' })
  importTemplate(@Res() res: Response) {
    const buffer = this.deviceService.getImportTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="device-import-template.xlsx"',
    });
    res.send(buffer);
  }

  @Post('import')
  @RequirePermission('device:import')
  @OperationLog('batch-import', 'device')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({
    summary: '批量导入设备',
    description: '上传 xlsx 文件，逐行校验并批量创建设备，返回成功/失败明细',
  })
  @ApiOkResponse({ description: '返回导入结果' })
  async import(@UploadedFile() file: Express.Multer.File): Promise<ImportResult> {
    if (!file) {
      throw new BusinessException('未上传文件');
    }
    return this.deviceService.batchImport(file);
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
