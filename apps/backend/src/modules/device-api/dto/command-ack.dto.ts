import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * POST /device/commands/:id/ack 请求（spec §1.2 commands ack / §6.2 device:ack）。
 *
 * result='success' 视为执行成功（DeviceCommand.status=2），其他值视为失败（status=3）。
 * error 为失败原因；screenshotUrl 供 command:screenshot 成功时回传截图地址，
 * 后端合并写入指令 payload.ack 供管理后台追溯。
 */
export class AckReq {
  @ApiProperty({
    description: '执行结果（success 表示成功，其他值视为失败）',
    example: 'success',
  })
  @IsString()
  @MaxLength(50)
  result!: string;

  @ApiPropertyOptional({ description: '失败原因', example: 'screenshot capture failed' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  error?: string;

  @ApiPropertyOptional({
    description: '截图 URL（command:screenshot 成功时回传）',
    example: '/uploads/screenshots/1_1719360000000.jpg',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  screenshotUrl?: string;
}
