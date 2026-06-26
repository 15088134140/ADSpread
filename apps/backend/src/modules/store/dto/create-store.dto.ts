import { IndustryCategory } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateStoreDto {
  @ApiProperty({ description: '门店名称', example: '涩谷店' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: '门店编码（唯一）', example: 'SH001' })
  @IsString()
  @MaxLength(50)
  code!: string;

  @ApiProperty({
    description: '行业分类',
    example: 'CATERING',
    enum: IndustryCategory,
  })
  @IsEnum(IndustryCategory)
  industryCategory!: IndustryCategory;

  @ApiPropertyOptional({ description: '门店地址', example: '东京都涩谷区涩谷1-1-1' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ description: '联系人', example: '山田太郎' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPerson?: string;

  @ApiPropertyOptional({ description: '联系电话', example: '090-1234-5678' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @ApiPropertyOptional({ description: '状态：1 启用，0 禁用', example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  status?: number;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}
