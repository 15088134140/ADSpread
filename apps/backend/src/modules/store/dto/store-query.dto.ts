import { IndustryCategory } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class StoreQueryDto {
  @ApiPropertyOptional({ description: '页码', example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  page?: number;

  @ApiPropertyOptional({ description: '每页条数', example: 20, default: 20 })
  @IsOptional()
  @IsInt()
  pageSize?: number;

  @ApiPropertyOptional({ description: '关键词（门店名称/编码模糊匹配）', example: '涩谷' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '行业分类', example: 'CATERING', enum: IndustryCategory })
  @IsOptional()
  @IsEnum(IndustryCategory)
  industryCategory?: IndustryCategory;

  @ApiPropertyOptional({ description: '状态：1 启用，0 禁用', example: 1 })
  @IsOptional()
  @IsInt()
  status?: number;
}
