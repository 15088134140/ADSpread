import { extname } from 'path';
import {
  IMAGE_EXTENSIONS,
  IMAGE_MIME_TYPES,
  MATERIAL_MAX_FILE_SIZE,
  VIDEO_EXTENSIONS,
  VIDEO_MIME_TYPES,
} from '../constants/business.constants';
import { BusinessException } from '../errors/business.exception';

export function getLowerExtension(filename: string) {
  return extname(filename).replace('.', '').toLowerCase();
}

export function getMaterialType(filename: string, mimetype: string): 'IMAGE' | 'VIDEO' {
  const ext = getLowerExtension(filename);
  if (IMAGE_EXTENSIONS.includes(ext) && IMAGE_MIME_TYPES.includes(mimetype)) return 'IMAGE';
  if (VIDEO_EXTENSIONS.includes(ext) && VIDEO_MIME_TYPES.includes(mimetype)) return 'VIDEO';
  throw new BusinessException('FILE_TYPE_UNSUPPORTED');
}

export function assertMaterialFile(file: Express.Multer.File) {
  if (!file) throw new BusinessException('FILE_REQUIRED');
  if (file.size > MATERIAL_MAX_FILE_SIZE) throw new BusinessException('FILE_TOO_LARGE');
  return getMaterialType(file.originalname, file.mimetype);
}
