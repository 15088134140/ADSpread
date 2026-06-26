import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt } from 'class-validator';

export class AssignRoleMenusDto {
  @ApiProperty({
    description: '菜单 ID 列表（按钮级权限，整体覆盖）',
    type: [Number],
    example: [1, 2, 3, 6, 7],
  })
  @IsArray()
  @IsInt({ each: true })
  menuIds!: number[];
}
