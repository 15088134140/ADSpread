import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class RejectMaterialDto {
  @ApiProperty({
    description: '驳回原因（至少10个字符）',
    example: '素材画面模糊不清，请重新上传高清版本',
  })
  @IsString()
  @MinLength(10)
  reason!: string;
}

export class ApproveMaterialDto {
  @ApiPropertyOptional({ description: '审核备注' })
  @IsOptional()
  @IsString()
  note?: string;
}
