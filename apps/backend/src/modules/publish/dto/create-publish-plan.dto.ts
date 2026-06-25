import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePublishPlanDto {
  @ApiProperty({ description: '计划名称', example: '春季促销发布计划' })
  @IsString()
  name: string;

  @ApiProperty({ description: '关联节目 ID（需为已发布节目）', example: 1 })
  @IsNumber()
  programId: number;

  @ApiProperty({ description: '目标门店 ID 列表', example: [1, 2, 3], type: [Number] })
  @IsArray()
  @IsNumber({}, { each: true })
  targetStoreIds: number[];

  @ApiProperty({ description: '开始时间（ISO 8601）', example: '2026-06-25T00:00:00.000Z' })
  @IsString()
  startTime: string;

  @ApiPropertyOptional({
    description: '结束时间（ISO 8601），不填表示永久',
    example: '2026-07-25T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiProperty({
    description: '播放周期（星期几，1=周一 ... 7=周日）',
    example: [1, 2, 3, 4, 5],
    type: [Number],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  playDays: number[];

  @ApiPropertyOptional({ description: '状态：1 启用，0 停用', example: 1, default: 1 })
  @IsOptional()
  @IsNumber()
  status?: number;
}
