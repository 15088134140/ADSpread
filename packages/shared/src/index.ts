import dayjs from 'dayjs';

// ==================== 日期工具 ====================

export const formatDate = (date: string | Date | number, format = 'YYYY-MM-DD'): string => {
  return dayjs(date).format(format);
};

export const formatDateTime = (date: string | Date | number): string => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
};

export const formatRelativeTime = (date: string | Date | number): string => {
  const now = dayjs();
  const target = dayjs(date);
  const diffDays = now.diff(target, 'day');

  if (diffDays === 0) {
    const diffHours = now.diff(target, 'hour');
    if (diffHours === 0) {
      const diffMinutes = now.diff(target, 'minute');
      return diffMinutes <= 0 ? '刚刚' : `${diffMinutes}分钟前`;
    }
    return `${diffHours}小时前`;
  } else if (diffDays === 1) {
    return '昨天';
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else {
    return formatDate(date);
  }
};

// ==================== 文件工具 ====================

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getFileExtension = (filename: string): string => {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
};

// ==================== 字符串工具 ====================

export const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
};

export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// ==================== 验证工具 ====================

export const isPhone = (phone: string): boolean => {
  return /^1[3-9]\d{9}$/.test(phone);
};

export const isEmail = (email: string): boolean => {
  return /^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/.test(email);
};

// ==================== 数组工具 ====================

export const arrayToTree = <T extends { id: number; parentId?: number }>(
  items: T[],
  parentId?: number
): T[] => {
  return items
    .filter((item) => item.parentId === parentId)
    .map((item) => ({
      ...item,
      children: arrayToTree(items, item.id) as T[],
    }));
};

// ==================== 数字工具 ====================

export const padZero = (num: number, len = 2): string => {
  return String(num).padStart(len, '0');
};

export const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${padZero(h)}:${padZero(m)}:${padZero(s)}`;
  }
  return `${padZero(m)}:${padZero(s)}`;
};

// ==================== 对象工具 ====================

export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

export const omit = <T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
  const result = { ...obj };
  keys.forEach((key) => delete result[key]);
  return result;
};

export const pick = <T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    result[key] = obj[key];
  });
  return result;
};

// ==================== 防抖节流 ====================

export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

export const throttle = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let last = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - last >= delay) {
      last = now;
      fn(...args);
    }
  };
};

export * from './constants';
