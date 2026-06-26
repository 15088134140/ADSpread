import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ description: '角色名称（唯一）', example: '运营人员' })
  @IsString()
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ description: '备注', example: '业务运营示例角色' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;

  @ApiPropertyOptional({ description: '状态：1 启用，0 禁用', example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  status?: number;

  @ApiPropertyOptional({
    description: '菜单 ID 列表（按钮级权限）',
    type: [Number],
    example: [1, 2, 3],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  menuIds?: number[];
}
