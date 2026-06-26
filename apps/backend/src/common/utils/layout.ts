import { ScreenOrientation, SplitType } from '@prisma/client';
import { LANDSCAPE_SPLIT_TYPES, PORTRAIT_SPLIT_TYPES } from '../constants/business.constants';
import { BusinessException } from '../errors/business.exception';

export interface RegionBounds {
  regionId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function validateSplitType(screenOrientation: ScreenOrientation, splitType: SplitType) {
  if (screenOrientation === ScreenOrientation.ANY || splitType === SplitType.ANY) return;

  const allowed =
    screenOrientation === ScreenOrientation.PORTRAIT ? PORTRAIT_SPLIT_TYPES : LANDSCAPE_SPLIT_TYPES;

  if (!allowed.includes(splitType)) {
    throw new BusinessException('SCREEN_SPLIT_MISMATCH');
  }
}

export function getRegionCount(splitType: SplitType) {
  switch (splitType) {
    case SplitType.SPLIT_1:
      return 1;
    case SplitType.SPLIT_2:
      return 2;
    case SplitType.SPLIT_3:
    case SplitType.SPLIT_3_1:
      return 3;
    case SplitType.SPLIT_4:
      return 4;
    case SplitType.ANY:
      return 0;
    default:
      return 0;
  }
}

export function getRegionBounds(
  screenOrientation: ScreenOrientation,
  splitType: SplitType
): RegionBounds[] {
  if (splitType === SplitType.ANY) return [];

  if (splitType === SplitType.SPLIT_1) {
    return [{ regionId: 'region1', x: 0, y: 0, width: 1, height: 1 }];
  }

  if (splitType === SplitType.SPLIT_2) {
    return screenOrientation === ScreenOrientation.PORTRAIT
      ? [
          { regionId: 'region1', x: 0, y: 0, width: 1, height: 0.5 },
          { regionId: 'region2', x: 0, y: 0.5, width: 1, height: 0.5 },
        ]
      : [
          { regionId: 'region1', x: 0, y: 0, width: 0.5, height: 1 },
          { regionId: 'region2', x: 0.5, y: 0, width: 0.5, height: 1 },
        ];
  }

  if (splitType === SplitType.SPLIT_3) {
    return screenOrientation === ScreenOrientation.PORTRAIT
      ? [
          { regionId: 'region1', x: 0, y: 0, width: 1, height: 1 / 3 },
          { regionId: 'region2', x: 0, y: 1 / 3, width: 1, height: 1 / 3 },
          { regionId: 'region3', x: 0, y: 2 / 3, width: 1, height: 1 / 3 },
        ]
      : [
          { regionId: 'region1', x: 0, y: 0, width: 1 / 3, height: 1 },
          { regionId: 'region2', x: 1 / 3, y: 0, width: 1 / 3, height: 1 },
          { regionId: 'region3', x: 2 / 3, y: 0, width: 1 / 3, height: 1 },
        ];
  }

  if (splitType === SplitType.SPLIT_3_1) {
    return [
      { regionId: 'region1', x: 0, y: 0, width: 0.5, height: 1 },
      { regionId: 'region2', x: 0.5, y: 0, width: 0.5, height: 0.5 },
      { regionId: 'region3', x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    ];
  }

  return [
    { regionId: 'region1', x: 0, y: 0, width: 0.5, height: 0.5 },
    { regionId: 'region2', x: 0.5, y: 0, width: 0.5, height: 0.5 },
    { regionId: 'region3', x: 0, y: 0.5, width: 0.5, height: 0.5 },
    { regionId: 'region4', x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
  ];
}
