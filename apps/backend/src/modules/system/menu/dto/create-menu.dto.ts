import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateMenuDto {
  @ApiPropertyOptional({ description: '父菜单 ID（顶级为空）', example: 25 })
  @IsOptional()
  @IsInt()
  parentId?: number;

  @ApiProperty({ description: '菜单名称', example: '管理员' })
  @IsString()
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ description: '前端路由路径（按钮节点留空）', example: '/system/admin' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  path?: string;

  @ApiPropertyOptional({ description: '前端组件路径', example: 'system/admin/index' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  component?: string;

  @ApiPropertyOptional({ description: '图标组件名', example: 'User' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({ description: '同级排序（越小越靠前）', example: 1, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort?: number;

  @ApiPropertyOptional({
    description: '类型：1 目录, 2 菜单, 3 按钮',
    example: 2,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  type?: number;

  @ApiPropertyOptional({ description: '权限码（目录留空）', example: 'admin:list' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  permission?: string;

  @ApiPropertyOptional({ description: '状态：1 启用，0 禁用', example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  status?: number;
}
