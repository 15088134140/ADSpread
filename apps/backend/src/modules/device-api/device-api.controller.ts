import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DeviceApiService } from './device-api.service';

@ApiTags('设备端接口')
@Controller('device')
export class DeviceApiController {
  constructor(private readonly deviceApiService: DeviceApiService) {}

  @Get('program')
  @ApiOperation({
    summary: '获取设备当前播放节目',
    description:
      '公开接口（无需鉴权）。设备根据自身编码获取当前时间应播放的节目配置；设备禁用/未绑定门店/无匹配计划时返回 null。',
  })
  @ApiQuery({ name: 'deviceCode', description: '设备编码', example: 'DEVICE001', required: true })
  @ApiOkResponse({ description: '返回节目配置（含区域素材），无匹配时返回 null' })
  currentProgram(@Query('deviceCode') deviceCode: string) {
    return this.deviceApiService.getCurrentProgram(deviceCode);
  }
}
