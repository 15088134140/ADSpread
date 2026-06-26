import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationInput } from '../../../../common/utils/pagination';
import { OperationLogQueryDto as OperationLogQueryInterface } from '../operation-log.service';

/**
 * 操作日志查询 DTO。
 * 结构与 OperationLogService.OperationLogQueryDto 接口一致，
 * 增加 class-validator 装饰器用于入参校验。
 */
export class QueryOperationLogDto implements PaginationInput, OperationLogQueryInterface {
  @ApiPropertyOptional({ description: '页码', example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  page?: number;

  @ApiPropertyOptional({ description: '每页条数', example: 20, default: 20 })
  @IsOptional()
  @IsInt()
  pageSize?: number;

  @ApiPropertyOptional({ description: '用户名（模糊匹配）', example: 'admin' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: '操作类型（模糊匹配）', example: 'create' })
  @IsOptional()
  @IsString()
  operation?: string;

  @ApiPropertyOptional({
    description: '开始时间（ISO 字符串）',
    example: '2026-06-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional({
    description: '结束时间（ISO 字符串）',
    example: '2026-06-30T23:59:59.000Z',
  })
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiPropertyOptional({ description: '状态：1 成功，0 失败', example: 1 })
  @IsOptional()
  @IsInt()
  status?: number;
}
