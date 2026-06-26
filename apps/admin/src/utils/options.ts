import { ScreenOrientation, SplitType } from '@adspread/types';

/**
 * 选项数组的 label 字段存储 i18n key（而非显示文案），
 * 使用时需通过 t(item.label) 渲染为对应语言文案。
 */
export const statusOptions = [
  { value: 1, label: 'common.enabled' },
  { value: 0, label: 'common.disabled' },
];

export const screenOrientationOptions = [
  { value: ScreenOrientation.LANDSCAPE, label: 'device.screenOrientation.LANDSCAPE' },
  { value: ScreenOrientation.PORTRAIT, label: 'device.screenOrientation.PORTRAIT' },
  { value: ScreenOrientation.ANY, label: 'device.screenOrientation.ANY' },
];

export const programScreenOrientationOptions = [...screenOrientationOptions];

export const splitTypeOptions = [
  { value: SplitType.SPLIT_1, label: 'device.splitType.SPLIT_1' },
  { value: SplitType.SPLIT_2, label: 'device.splitType.SPLIT_2' },
  { value: SplitType.SPLIT_3, label: 'device.splitType.SPLIT_3' },
  { value: SplitType.SPLIT_3_1, label: 'device.splitType.SPLIT_3_1' },
  { value: SplitType.SPLIT_4, label: 'device.splitType.SPLIT_4' },
  { value: SplitType.ANY, label: 'device.splitType.ANY' },
];

export const programSplitTypeOptions = [...splitTypeOptions];

export function getDeviceSplitTypeOptions(
  orientation: ScreenOrientation
): Array<{ value: string; label: string }> {
  if (orientation === ScreenOrientation.PORTRAIT) {
    return splitTypeOptions.filter((item) =>
      [SplitType.SPLIT_1, SplitType.SPLIT_2, SplitType.SPLIT_3].includes(item.value)
    );
  }
  return splitTypeOptions;
}

export const industryCategoryOptions = [
  { value: 'CATERING', label: 'store.industryCategory.CATERING' },
  { value: 'RETAIL', label: 'store.industryCategory.RETAIL' },
  { value: 'BEAUTY', label: 'store.industryCategory.BEAUTY' },
  { value: 'HOSPITALITY', label: 'store.industryCategory.HOSPITALITY' },
  { value: 'EDUCATION', label: 'store.industryCategory.EDUCATION' },
  { value: 'AUTOMOTIVE', label: 'store.industryCategory.AUTOMOTIVE' },
  { value: 'LOCAL_LIFE', label: 'store.industryCategory.LOCAL_LIFE' },
  { value: 'OTHER', label: 'store.industryCategory.OTHER' },
];

export const materialTypeOptions = [
  { value: 'IMAGE', label: 'material.materialType.IMAGE' },
  { value: 'VIDEO', label: 'material.materialType.VIDEO' },
];

export const auditStatusOptions = [
  { value: 'PENDING', label: 'material.auditStatus.PENDING' },
  { value: 'APPROVED', label: 'material.auditStatus.APPROVED' },
  { value: 'REJECTED', label: 'material.auditStatus.REJECTED' },
];

export const playDaysOptions = [
  { value: 1, label: 'publish.playDays.monday' },
  { value: 2, label: 'publish.playDays.tuesday' },
  { value: 3, label: 'publish.playDays.wednesday' },
  { value: 4, label: 'publish.playDays.thursday' },
  { value: 5, label: 'publish.playDays.friday' },
  { value: 6, label: 'publish.playDays.saturday' },
  { value: 7, label: 'publish.playDays.sunday' },
];
