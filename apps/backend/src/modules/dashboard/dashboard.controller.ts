import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('仪表盘')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @RequirePermission('dashboard:view')
  @ApiOperation({
    summary: '获取仪表盘概览',
    description: '聚合设备/素材/节目/发布/门店/待办/最近操作日志',
  })
  @ApiOkResponse({ description: '成功返回仪表盘概览数据' })
  getOverview(@CurrentUser() user: JwtUser) {
    return this.dashboardService.getOverview(user.roleId);
  }
}
