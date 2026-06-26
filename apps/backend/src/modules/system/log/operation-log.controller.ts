import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { OperationLogService } from './operation-log.service';
import { QueryOperationLogDto } from './dto/query-operation-log.dto';

@ApiTags('系统管理-操作日志')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/logs')
export class OperationLogController {
  constructor(private readonly operationLogService: OperationLogService) {}

  @Get()
  @RequirePermission('log:list')
  @ApiOperation({
    summary: '获取操作日志列表',
    description: '分页查询操作日志，支持按用户名、操作类型、时间范围、状态筛选',
  })
  @ApiOkResponse({ description: '成功返回操作日志列表' })
  findAll(@Query() query: QueryOperationLogDto) {
    return this.operationLogService.findAll(query);
  }
}
