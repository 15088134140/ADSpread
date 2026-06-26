import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { PASSWORD_STRENGTH_REGEX, PASSWORD_STRENGTH_MESSAGE } from './create-admin.dto';

export class ResetPasswordDto {
  @ApiProperty({
    description: '新密码（至少 8 位，含大小写字母与数字）',
    example: 'NewPass123',
  })
  @IsString()
  @Matches(PASSWORD_STRENGTH_REGEX, { message: PASSWORD_STRENGTH_MESSAGE })
  newPassword!: string;
}
