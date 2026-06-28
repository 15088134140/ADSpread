import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * 单条设备日志/事件（spec §1.2 logs / §13）。
 *
 * type 标识来源类别（play/event/error 等），payload 承载原始 JSON，
 * severity 默认 INFO（由 service 兜底），clientLogId 供端侧去重——
 * 上报成功后端按 clientLogId 或自增 id 回传 acceptedIds，端侧据此删除本地缓冲。
 */
export class LogEntryDto {
  @ApiProperty({ description: '日志类型（play/event/error 等）', example: 'play' })
  @IsString()
  @MaxLength(50)
  type!: string;

  @ApiProperty({ description: '日志载荷（JSON 对象）' })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional({
    description: '严重级别（ERROR/WARN/INFO），默认 INFO',
    example: 'WARN',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  severity?: string;

  @ApiPropertyOptional({
    description: '客户端日志 ID（去重用，缺失则后端用自增 id 回传）',
    example: 'log-1719360000000-1',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientLogId?: string;
}

/**
 * POST /device/logs 请求（spec §1.2 logs / §5.5 网络恢复追平）。
 *
 * 离线缓冲的日志/事件在网络恢复后批量上报；至少 1 条。
 */
export class LogBatchReq {
  @ApiProperty({ description: '日志条目数组', type: [LogEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LogEntryDto)
  entries!: LogEntryDto[];
}

/**
 * POST /device/logs 响应（spec §1.2 logs）。
 *
 * acceptedIds 与请求 entries 顺序对应：有 clientLogId 回传 clientLogId，
 * 无则回传后端自增 id（BigInt 转字符串）。端侧按此删除本地缓冲。
 */
export class LogBatchRes {
  @ApiProperty({
    description: '已接收日志 ID 列表（clientLogId 或自增 id 字符串）',
    type: [String],
    example: ['log-1719360000000-1', '42'],
  })
  acceptedIds: string[];
}
