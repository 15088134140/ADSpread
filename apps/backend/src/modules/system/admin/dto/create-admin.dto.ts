import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * 密码强度规则：至少 8 位，含大写字母、小写字母与数字。
 * 遵循设计规格 §5.4 业务规则与 §9 风险取舍。
 */
export const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
export const PASSWORD_STRENGTH_MESSAGE = '密码至少 8 位，需包含大写字母、小写字母与数字';

export class CreateAdminDto {
  @ApiProperty({ description: '用户名（唯一）', example: 'operator' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username!: string;

  @ApiProperty({ description: '密码（至少 8 位，含大小写字母与数字）', example: 'Operator123' })
  @IsString()
  @Matches(PASSWORD_STRENGTH_REGEX, { message: PASSWORD_STRENGTH_MESSAGE })
  password!: string;

  @ApiProperty({ description: '姓名', example: '运营示例' })
  @IsString()
  @MaxLength(50)
  name!: string;

  @ApiProperty({ description: '角色 ID（必填）', example: 2 })
  @IsInt()
  roleId!: number;

  @ApiPropertyOptional({ description: '状态：1 启用，0 禁用', example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  status?: number;

  @ApiPropertyOptional({ description: '头像 URL', example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  avatar?: string;

  @ApiPropertyOptional({ description: '手机号', example: '13800000000' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ description: '邮箱', example: 'operator@example.com' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  email?: string;
}
