import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 发布计划投影（spec §1.2 sync / §5.2 LocalScheduleEngine 所需字段）。
 *
 * 补齐 spec B5 缺口：客户端 LocalScheduleEngine 本地复算当前节目需要
 * startTime/endTime/playDays/targetStoreIds，故全量下发，由端侧按日级过滤。
 * status=1 表示启用。
 */
export class PublishPlanDto {
  @ApiProperty({ description: '发布计划 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '关联节目 ID', example: 10 })
  programId: number;

  @ApiProperty({
    description: '目标门店 ID 列表（JSON 数组）',
    example: [1, 7],
    type: [Number],
  })
  targetStoreIds: number[];

  @ApiProperty({
    description: '计划开始时间（ISO 8601）',
    example: '2026-01-01T00:00:00.000Z',
  })
  startTime: Date;

  @ApiPropertyOptional({
    description: '计划结束时间（ISO 8601），null 表示无结束',
    example: '2026-12-31T23:59:59.000Z',
    nullable: true,
  })
  endTime: Date | null;

  @ApiProperty({
    description: '播放星期列表（1=周一…7=周日）',
    example: [1, 2, 3, 4, 5],
    type: [Number],
  })
  playDays: number[];

  @ApiProperty({ description: '状态（1=启用, 0=停用）', example: 1 })
  status: number;

  @ApiProperty({
    description: '创建时间（ISO 8601）',
    example: '2026-01-01T00:00:00.000Z',
  })
  createdAt: Date;
}

/**
 * 节目投影（spec §1.2 sync / §4.3 layoutConfig）。
 *
 * 裁掉管理域字段（createdBy/publishedAt 等），仅保留设备播放所需。
 * layoutConfig 为原始 JSON（regions[].materials[].materialId + duration），
 * 不展开 material 对象——素材元数据见顶层 materials[]，端侧按 materialId 关联。
 * bounds 由端侧本地计算（ADR-D），后端不下发。
 * screenOrientation/splitType 运行时为 Prisma 枚举字符串值，故声明为 string。
 */
export class ProgramDto {
  @ApiProperty({ description: '节目 ID', example: 10 })
  id: number;

  @ApiProperty({ description: '节目名称', example: '主推节目' })
  name: string;

  @ApiProperty({
    description: '屏幕方向（LANDSCAPE/PORTRAIT/ANY）',
    example: 'LANDSCAPE',
  })
  screenOrientation: string;

  @ApiProperty({
    description: '分屏类型（SPLIT_1/SPLIT_2/SPLIT_3/SPLIT_3_1/SPLIT_4/ANY）',
    example: 'SPLIT_2',
  })
  splitType: string;

  @ApiProperty({
    description:
      '布局配置 JSON（regions[].materials[].materialId + duration，不含展开的 material 对象与 bounds）',
    example: {
      regions: [{ regionId: 'region1', materials: [{ materialId: 1, duration: 10 }] }],
    },
  })
  layoutConfig: unknown;

  @ApiProperty({ description: '状态（1=已发布, 0=草稿）', example: 1 })
  status: number;
}

/**
 * 素材元数据投影（spec §1.2 sync / §4.3）。
 *
 * fileSize 为 BigInt，全局 prototype patch 已转字符串下发（plan §K3），
 * DTO 显式声明 string，客户端按 Long/String 解析。
 * 仅下发 auditStatus=APPROVED 的素材。
 */
export class MaterialDto {
  @ApiProperty({ description: '素材 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '素材名称', example: '主图.jpg' })
  name: string;

  @ApiProperty({ description: '素材类型（IMAGE/VIDEO）', example: 'IMAGE' })
  type: string;

  @ApiProperty({
    description: '文件 URL（静态资源路径，支持 Range 断点续传）',
    example: '/uploads/materials/xxx.jpg',
  })
  fileUrl: string;

  @ApiProperty({
    description: '文件大小（字节，字符串，BigInt 序列化）',
    example: '1048576',
  })
  fileSize: string;

  @ApiProperty({ description: '文件扩展名', example: 'jpg' })
  fileExtension: string;

  @ApiPropertyOptional({ description: '宽度（px）', example: 1920, nullable: true })
  width: number | null;

  @ApiPropertyOptional({ description: '高度（px）', example: 1080, nullable: true })
  height: number | null;

  @ApiPropertyOptional({
    description: '视频时长（秒），图片为 null',
    example: 30,
    nullable: true,
  })
  duration: number | null;

  @ApiPropertyOptional({
    description: '缩略图 URL',
    example: '/uploads/materials/thumb_xxx.jpg',
    nullable: true,
  })
  thumbnailUrl: string | null;
}

/**
 * GET /device/sync 响应数据（spec §1.2 sync / §5.1 版本化）。
 *
 * version 为设备门店相关记录 updatedAt 最大值毫秒戳（plan §K4 简化方案），
 * 单调递增，作 ETag 值。客户端下次带 ?etag=version，命中则 304。
 * 未绑定门店的设备 version='0' 且三个数组为空。
 */
export class SyncDto {
  @ApiProperty({
    description: '版本号（毫秒戳字符串），作 ETag',
    example: '1719360000000',
  })
  version: string;

  @ApiProperty({ description: '生效发布计划列表', type: [PublishPlanDto] })
  plans: PublishPlanDto[];

  @ApiProperty({ description: '节目列表（含 layoutConfig）', type: [ProgramDto] })
  programs: ProgramDto[];

  @ApiProperty({ description: '素材元数据列表（仅 APPROVED）', type: [MaterialDto] })
  materials: MaterialDto[];
}
