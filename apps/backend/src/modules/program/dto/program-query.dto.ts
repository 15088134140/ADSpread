import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ScreenOrientation, SplitType } from '@prisma/client';

export class ProgramQueryDto {
  @ApiPropertyOptional({ description: '页码', example: 1, default: 1 })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: '每页条数', example: 20, default: 20 })
  @IsOptional()
  @IsNumber()
  pageSize?: number;

  @ApiPropertyOptional({ description: '关键词（节目名称模糊匹配）', example: '春季' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '屏幕方向', example: 'LANDSCAPE', enum: ScreenOrientation })
  @IsOptional()
  @IsString()
  screenOrientation?: string;

  @ApiPropertyOptional({ description: '分屏类型', example: 'SPLIT_1', enum: SplitType })
  @IsOptional()
  @IsString()
  splitType?: string;

  @ApiPropertyOptional({ description: '状态：0 草稿，1 已发布', example: 0 })
  @IsOptional()
  @IsNumber()
  status?: number;
}
