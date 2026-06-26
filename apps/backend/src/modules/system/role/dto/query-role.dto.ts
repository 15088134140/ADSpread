import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationInput } from '../../../../common/utils/pagination';

export class QueryRoleDto implements PaginationInput {
  @ApiPropertyOptional({ description: '页码', example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  page?: number;

  @ApiPropertyOptional({ description: '每页条数', example: 20, default: 20 })
  @IsOptional()
  @IsInt()
  pageSize?: number;

  @ApiPropertyOptional({ description: '角色名称（模糊匹配）', example: '运营' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '状态：1 启用，0 禁用', example: 1 })
  @IsOptional()
  @IsInt()
  status?: number;
}
