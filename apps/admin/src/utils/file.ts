export interface FileSizeOptions {
  decimalPlaces?: number;
  decimalSeparator?: string;
  thousandsSeparator?: string;
}

export const fileUtils = {
  getFileExtension: (filename: string): string => {
    return filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  },

  getFileType: (filename: string): string => {
    const ext = fileUtils.getFileExtension(filename);
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const videoExtensions = ['mp4', 'webm', 'ogg', 'avi', 'mkv'];

    if (imageExtensions.includes(ext)) {
      return 'image';
    } else if (videoExtensions.includes(ext)) {
      return 'video';
    }
    return 'unknown';
  },

  formatFileSize: (bytes: number, options?: FileSizeOptions): string => {
    const { decimalPlaces = 1, decimalSeparator = '.', thousandsSeparator = ',' } = options || {};

    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let unitIndex = 0;
    let size = bytes;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    const formattedSize = size.toFixed(decimalPlaces).replace('.', decimalSeparator);
    const numberWithThousands = formattedSize.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);

    return `${numberWithThousands} ${units[unitIndex]}`;
  },

  validateFileSize: (file: File, maxSize: number): boolean => {
    return file.size <= maxSize;
  },

  validateFileType: (file: File, allowedTypes: string[]): boolean => {
    const fileType = fileUtils.getFileType(file.name);
    return allowedTypes.includes(fileType);
  },

  createFileUrl: (file: File): string => {
    return URL.createObjectURL(file);
  },

  revokeFileUrl: (url: string): void => {
    URL.revokeObjectURL(url);
  },
};
