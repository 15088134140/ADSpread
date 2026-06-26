import { ScreenOrientation, SplitType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDeviceDto {
  @ApiPropertyOptional({ description: '所属门店 ID（不填表示未绑定门店）', example: 1 })
  @IsOptional()
  @IsInt()
  storeId?: number;

  @ApiProperty({ description: '设备名称', example: '前台展示屏' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: '设备编码（唯一）', example: 'DEVICE001' })
  @IsString()
  @MaxLength(50)
  code!: string;

  @ApiProperty({
    description: '屏幕方向',
    example: 'LANDSCAPE',
    enum: ScreenOrientation,
  })
  @IsEnum(ScreenOrientation)
  screenOrientation!: ScreenOrientation;

  @ApiProperty({ description: '屏幕分辨率', example: '1920x1080' })
  @IsString()
  @MaxLength(20)
  screenResolution!: string;

  @ApiProperty({
    description: '分屏类型',
    example: 'SPLIT_1',
    enum: SplitType,
  })
  @IsEnum(SplitType)
  splitType!: SplitType;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: '状态：1 启用，0 禁用', example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  status?: number;
}
