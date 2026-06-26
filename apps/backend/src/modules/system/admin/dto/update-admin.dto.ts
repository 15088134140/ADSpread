import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateAdminDto } from './create-admin.dto';

/**
 * 更新管理员 DTO。
 * 密码不在更新接口中直接修改——统一走 reset-password 接口。
 */
export class UpdateAdminDto extends PartialType(OmitType(CreateAdminDto, ['password'] as const)) {
  @ApiPropertyOptional({ description: '角色 ID', example: 2 })
  // roleId 在 PartialType(OmitType(...)) 后已自动变为可选，此处显式声明以保留 Swagger 文档
  roleId?: number;
}
