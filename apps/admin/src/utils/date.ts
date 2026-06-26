import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import isBetween from 'dayjs/plugin/isBetween';
import weekday from 'dayjs/plugin/weekday';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(isBetween);
dayjs.extend(weekday);
dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

export const dateUtils = {
  formatDate: (date: Date | string | number | null | undefined, format = 'YYYY-MM-DD'): string => {
    if (date === null || date === undefined || date === '') return '-';
    const d = dayjs(date);
    return d.isValid() ? d.format(format) : '-';
  },

  formatDateTime: (
    date: Date | string | number | null | undefined,
    format = 'YYYY-MM-DD HH:mm:ss'
  ): string => {
    if (date === null || date === undefined || date === '') return '-';
    const d = dayjs(date);
    return d.isValid() ? d.format(format) : '-';
  },

  formatTime: (date: Date | string | number | null | undefined, format = 'HH:mm:ss'): string => {
    if (date === null || date === undefined || date === '') return '-';
    const d = dayjs(date);
    return d.isValid() ? d.format(format) : '-';
  },

  formatRelativeTime: (date: Date | string | number): string => {
    return dayjs(date).fromNow();
  },

  isExpired: (date: Date | string | number): boolean => {
    return dayjs(date).isBefore(dayjs());
  },

  isActive: (startTime: Date | string | number, endTime?: Date | string | number): boolean => {
    const now = dayjs();
    let isActive = dayjs(startTime).isBefore(now);
    if (endTime) {
      isActive = isActive && dayjs(endTime).isAfter(now);
    }
    return isActive;
  },

  getTodayPlayDay: (date?: Date | string | number): number => {
    const d = date ? dayjs(date) : dayjs();
    const day = d.day();
    return day === 0 ? 7 : day;
  },

  getWeekdays: (): Array<{ value: number; label: string }> => {
    return [
      { value: 1, label: '周一' },
      { value: 2, label: '周二' },
      { value: 3, label: '周三' },
      { value: 4, label: '周四' },
      { value: 5, label: '周五' },
      { value: 6, label: '周六' },
      { value: 7, label: '周日' },
    ];
  },

  isValidDate: (date: any): boolean => {
    return dayjs(date).isValid();
  },
};
