import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

/**
 * 设备硬件信息（绑定/心跳上报）。
 *
 * 各字段均 optional：spec §1.2/§9 约定 hardwareInfo 由客户端采集上报，
 * 首次绑定时可能不全。其中 mac/resolution/appVersion 对应 Device 表字段
 * （macAddress/screenResolution/appVersion），androidId/model/androidVersion
 * Device 表无对应列，仅做 DTO 校验，不落库。
 */
export class HardwareInfoDto {
  @ApiPropertyOptional({ description: 'MAC 地址', example: 'AA:BB:CC:DD:EE:FF' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  mac?: string;

  @ApiPropertyOptional({ description: 'Android ID', example: 'a1b2c3d4e5f6g7h8' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  androidId?: string;

  @ApiPropertyOptional({ description: '设备型号', example: 'RK3568' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @ApiPropertyOptional({ description: '屏幕分辨率', example: '1920x1080' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  resolution?: string;

  @ApiPropertyOptional({ description: 'Android 版本', example: '12' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  androidVersion?: string;

  @ApiPropertyOptional({ description: 'App 版本', example: '1.0.0' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  appVersion?: string;
}

/**
 * 设备自身配置，供客户端初始化（绑定响应的一部分）。
 * 字段来源于 Device 表，运行时为 Prisma 枚举字符串值，故声明为 string。
 */
export class DeviceConfigDto {
  @ApiProperty({ description: '屏幕方向', example: 'LANDSCAPE' })
  screenOrientation: string;

  @ApiProperty({ description: '分屏类型', example: 'SPLIT_1' })
  splitType: string;

  @ApiProperty({ description: '屏幕分辨率', example: '1920x1080' })
  screenResolution: string;
}

/**
 * POST /device/bind 请求（spec §1.2 / §9）。
 * code 为后台预建设备编码；hardwareInfo 必传（可空对象），内部字段 optional。
 */
export class BindReq {
  @ApiProperty({ description: '设备编码（后台预建）', example: 'DEVICE001' })
  @IsString()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ description: '硬件信息', type: HardwareInfoDto })
  @IsObject()
  @ValidateNested()
  @Type(() => HardwareInfoDto)
  hardwareInfo!: HardwareInfoDto;
}

/**
 * POST /device/bind 响应（spec §1.2 / §9）。
 * deviceToken 为 90d 有效期的设备 JWT；storeId 为 null 表示未绑定门店。
 */
export class BindRes {
  @ApiProperty({ description: '设备令牌（JWT，有效期 90d）', example: 'eyJhbGciOiJIUzI1NiIs...' })
  deviceToken: string;

  @ApiProperty({
    description: '所属门店 ID（未绑定门店为 null）',
    example: 1,
    nullable: true,
  })
  storeId: number | null;

  @ApiProperty({ description: '设备配置', type: DeviceConfigDto })
  deviceConfig: DeviceConfigDto;
}
