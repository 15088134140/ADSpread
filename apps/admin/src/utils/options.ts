import { ScreenOrientation, SplitType } from '@adspread/types';

export const statusOptions = [
  { value: 1, label: '启用' },
  { value: 0, label: '禁用' },
];

export const screenOrientationOptions = [
  { value: ScreenOrientation.LANDSCAPE, label: '横屏' },
  { value: ScreenOrientation.PORTRAIT, label: '竖屏' },
  { value: ScreenOrientation.ANY, label: '任意' },
];

export const programScreenOrientationOptions = [...screenOrientationOptions];

export const splitTypeOptions = [
  { value: SplitType.SPLIT_1, label: '1分屏' },
  { value: SplitType.SPLIT_2, label: '2分屏' },
  { value: SplitType.SPLIT_3, label: '3分屏' },
  { value: SplitType.SPLIT_3_1, label: '3-1分屏' },
  { value: SplitType.SPLIT_4, label: '4分屏' },
  { value: SplitType.ANY, label: '任意' },
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
  { value: 'CATERING', label: '餐饮' },
  { value: 'RETAIL', label: '零售' },
  { value: 'BEAUTY', label: '美妆' },
  { value: 'HOSPITALITY', label: '酒旅' },
  { value: 'EDUCATION', label: '教育' },
  { value: 'AUTOMOTIVE', label: '汽车' },
  { value: 'LOCAL_LIFE', label: '本地生活' },
  { value: 'OTHER', label: '其他' },
];

export const materialTypeOptions = [
  { value: 'IMAGE', label: '图片' },
  { value: 'VIDEO', label: '视频' },
];

export const auditStatusOptions = [
  { value: 'PENDING', label: '待审核' },
  { value: 'APPROVED', label: '审核通过' },
  { value: 'REJECTED', label: '审核驳回' },
];

export const playDaysOptions = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
];
