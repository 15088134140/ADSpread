import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { DeviceApiService } from './device-api.service';
import { DeviceGuard } from './guards/device.guard';
import { CurrentDevice, type DeviceIdentity } from './decorators/current-device.decorator';
import { BindReq, BindRes } from './dto/bind.dto';
import { SyncDto } from './dto/sync.dto';
import { HeartbeatReq } from './dto/heartbeat.dto';
import { LogBatchReq, LogBatchRes } from './dto/log.dto';
import { ScreenshotRes } from './dto/screenshot.dto';
import { AckReq } from './dto/command-ack.dto';

@ApiTags('设备端接口')
@Controller('device')
export class DeviceApiController {
  constructor(private readonly deviceApiService: DeviceApiService) {}

  @Get('program')
  @Public()
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

  @Post('bind')
  @Public()
  @ApiOperation({
    summary: '设备绑定',
    description:
      '公开接口（无需鉴权）。设备凭编码完成绑定：后端校验编码存在且启用后刷新硬件信息并签发设备令牌。允许重复绑定（重新签发令牌 + 刷新硬件信息）。',
  })
  @ApiOkResponse({ description: '返回设备令牌、所属门店 ID 与设备配置' })
  bind(@Body() dto: BindReq, @Ip() clientIp: string): Promise<BindRes> {
    return this.deviceApiService.bind(dto.code, dto.hardwareInfo, clientIp);
  }

  @Get('sync')
  @Public()
  @UseGuards(DeviceGuard)
  @ApiOperation({
    summary: '设备全量同步（ETag/304）',
    description:
      '设备端鉴权接口（需设备令牌）。返回该设备门店相关的全部生效发布计划、节目（含 layoutConfig）与已审核素材元数据。' +
      '客户端可带 ?etag=<version>，命中返回 304（无 body + ETag header），否则返回全量 + ETag header。' +
      '未绑定门店的设备返回空集（version=0）。该路由用 @Res() 直接控制响应以保证 304 无 body，' +
      '200 响应手动封装统一信封 {code,message,data,timestamp}（绕过 TransformInterceptor）。',
  })
  @ApiQuery({
    name: 'etag',
    description: '上次同步返回的 version，命中则返回 304',
    required: false,
  })
  @ApiOkResponse({
    description: '304 无 body；200 返回统一信封包裹的 SyncDto',
    type: SyncDto,
  })
  async sync(
    @CurrentDevice() device: DeviceIdentity,
    @Query('etag') etag: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    const result = await this.deviceApiService.sync(device, etag);
    res.set('ETag', result.version);
    if (result.notModified) {
      // 304 必须无 body：@Res() 非 passthrough 下 NestJS 跳过自动发送，
      // TransformInterceptor 的 map 输出被丢弃，确保 304 无 body。
      res.status(304).end();
      return;
    }
    // 200：手动封装统一响应信封（@Res() 非 passthrough 绕过 TransformInterceptor）
    res.status(200).json({
      code: 0,
      message: 'success',
      data: {
        version: result.version,
        plans: result.plans,
        programs: result.programs,
        materials: result.materials,
      },
      timestamp: Date.now(),
    });
  }

  @Post('heartbeat')
  @Public()
  @UseGuards(DeviceGuard)
  @ApiOperation({
    summary: '设备心跳上报',
    description:
      '设备端鉴权接口（需设备令牌）。更新设备最后活跃时间与 IP。V1 仅持久化 lastActiveAt/ipAddress，' +
      'metrics/currentProgramId/regionStates 仅做 DTO 校验不落库（超阈值告警列后续）。',
  })
  @ApiOkResponse({ description: '返回空对象（统一信封 data 为 {}）' })
  heartbeat(
    @CurrentDevice() device: DeviceIdentity,
    @Body() dto: HeartbeatReq,
    @Ip() clientIp: string
  ): Promise<Record<string, never>> {
    return this.deviceApiService.heartbeat(device, dto, clientIp);
  }

  @Post('logs')
  @Public()
  @UseGuards(DeviceGuard)
  @ApiOperation({
    summary: '设备日志批量上报',
    description:
      '设备端鉴权接口（需设备令牌）。批量写入设备日志/事件，返回 acceptedIds 供端侧删除本地缓冲。' +
      'acceptedIds 与请求 entries 顺序对应：有 clientLogId 回传 clientLogId，无则回传自增 id。',
  })
  @ApiOkResponse({ description: '返回 acceptedIds', type: LogBatchRes })
  logs(@CurrentDevice() device: DeviceIdentity, @Body() dto: LogBatchReq): Promise<LogBatchRes> {
    return this.deviceApiService.logs(device, dto.entries);
  }

  @Post('screenshot')
  @Public()
  @UseGuards(DeviceGuard)
  @ApiOperation({
    summary: '设备截图上传',
    description:
      '设备端鉴权接口（需设备令牌）。multipart 上传截图，存储到 uploads/screenshots，返回静态资源 URL。',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: '截图文件' },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({ description: '返回截图 URL', type: ScreenshotRes })
  @UseInterceptors(FileInterceptor('file'))
  uploadScreenshot(
    @CurrentDevice() device: DeviceIdentity,
    @UploadedFile() file: Express.Multer.File
  ): Promise<ScreenshotRes> {
    return this.deviceApiService.uploadScreenshot(device, file);
  }

  @Post('commands/:id/ack')
  @Public()
  @UseGuards(DeviceGuard)
  @ApiOperation({
    summary: '设备远程指令回执',
    description:
      '设备端鉴权接口（需设备令牌）。result=success 置指令状态为已 ack 成功（status=2），' +
      '其他值置为失败（status=3）；ack 结果合并写入指令 payload。指令不存在或非本设备指令返回 COMMAND_NOT_FOUND。',
  })
  @ApiOkResponse({ description: '返回空对象（统一信封 data 为 {}）' })
  ackCommand(
    @CurrentDevice() device: DeviceIdentity,
    @Param('id') commandId: string,
    @Body() dto: AckReq
  ): Promise<Record<string, never>> {
    return this.deviceApiService.ackCommand(device, commandId, dto);
  }
}
