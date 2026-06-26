import { AuditStatus, MaterialType } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class MaterialQueryDto {
  @ApiPropertyOptional({ description: '页码', example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  page?: number;

  @ApiPropertyOptional({ description: '每页条数', example: 20, default: 20 })
  @IsOptional()
  @IsInt()
  pageSize?: number;

  @ApiPropertyOptional({ description: '关键词（素材名称模糊匹配）', example: '促销' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '素材类型', example: 'IMAGE', enum: MaterialType })
  @IsOptional()
  @IsEnum(MaterialType)
  type?: MaterialType;

  @ApiPropertyOptional({ description: '审核状态', example: 'PENDING', enum: AuditStatus })
  @IsOptional()
  @IsEnum(AuditStatus)
  auditStatus?: AuditStatus;
}
