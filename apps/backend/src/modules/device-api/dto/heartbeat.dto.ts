import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * 设备运行指标（spec §1.2 heartbeat metrics / §3.6 Q12）。
 *
 * 各字段 optional：客户端按可采集项上报。V1 后端仅更新 lastActiveAt/ipAddress，
 * 不持久化 metrics（plan Task 4 简化决策）；预留字段供后续超阈值告警写 DeviceLog。
 */
export class HeartbeatMetricsDto {
  @ApiPropertyOptional({ description: 'CPU 使用率（百分比）', example: 35 })
  @IsOptional()
  @IsNumber()
  cpu?: number;

  @ApiPropertyOptional({ description: '内存使用率（百分比）', example: 60 })
  @IsOptional()
  @IsNumber()
  mem?: number;

  @ApiPropertyOptional({ description: '磁盘使用率（百分比）', example: 70 })
  @IsOptional()
  @IsNumber()
  disk?: number;

  @ApiPropertyOptional({ description: '网络状态', example: 'online' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  net?: string;
}

/**
 * POST /device/heartbeat 请求（spec §1.2 / plan Task 4）。
 *
 * status 为设备自报运行状态（如 playing/idle/error）；currentProgramId/regionStates
 * 为播放进度快照；metrics 为运行指标。V1 后端仅消费 status 之外的 lastActiveAt/ipAddress
 * 更新，其余字段仅做 DTO 校验不落库（见 service.heartbeat）。
 */
export class HeartbeatReq {
  @ApiProperty({ description: '设备运行状态', example: 'playing' })
  @IsString()
  @MaxLength(50)
  status!: string;

  @ApiPropertyOptional({ description: '当前播放节目 ID', example: 10 })
  @IsOptional()
  @IsNumber()
  currentProgramId?: number;

  @ApiPropertyOptional({
    description: '各区域播放状态（结构由客户端定义，V1 仅校验不落库）',
    type: 'array',
  })
  @IsOptional()
  @IsArray()
  regionStates?: unknown[];

  @ApiPropertyOptional({ description: '运行指标', type: HeartbeatMetricsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => HeartbeatMetricsDto)
  metrics?: HeartbeatMetricsDto;
}
