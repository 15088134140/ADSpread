import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePublishStatusDto {
  @ApiProperty({ description: '状态：1 启用，0 停用', example: 1 })
  @IsNumber()
  status: number;
}
