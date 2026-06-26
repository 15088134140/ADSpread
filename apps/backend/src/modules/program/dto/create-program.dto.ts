import { IsString, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ScreenOrientation, SplitType } from '@prisma/client';

export class MaterialItemDto {
  @ApiProperty({ description: '素材 ID', example: 1 })
  @IsNumber()
  materialId: number;

  @ApiProperty({ description: '播放时长（秒）', example: 10, minimum: 1 })
  @IsNumber()
  duration: number;
}

export class RegionDto {
  @ApiProperty({ description: '区域 ID', example: 'region1' })
  @IsString()
  regionId: string;

  @ApiProperty({ description: '该区域播放的素材列表', type: [MaterialItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialItemDto)
  materials: MaterialItemDto[];
}

export class CreateProgramDto {
  @ApiProperty({ description: '节目名称', example: '春季新品推广' })
  @IsString()
  name: string;

  @ApiProperty({ description: '屏幕方向', example: 'LANDSCAPE', enum: ScreenOrientation })
  @IsString()
  screenOrientation: string;

  @ApiProperty({ description: '分屏类型', example: 'SPLIT_1', enum: SplitType })
  @IsString()
  splitType: string;

  @ApiProperty({ description: '区域素材配置', type: [RegionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegionDto)
  regions: RegionDto[];

  @ApiPropertyOptional({ description: '状态：0 草稿，1 已发布', example: 0, default: 0 })
  @IsOptional()
  @IsNumber()
  status?: number;
}
