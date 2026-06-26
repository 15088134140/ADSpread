import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PublishQueryDto {
  @ApiPropertyOptional({ description: '页码', example: 1, default: 1 })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: '每页条数', example: 20, default: 20 })
  @IsOptional()
  @IsNumber()
  pageSize?: number;

  @ApiPropertyOptional({ description: '关键词（计划名称模糊匹配）', example: '春季' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '关联节目 ID', example: 1 })
  @IsOptional()
  @IsNumber()
  programId?: number;

  @ApiPropertyOptional({ description: '状态：1 启用，0 停用', example: 1 })
  @IsOptional()
  @IsNumber()
  status?: number;
}
