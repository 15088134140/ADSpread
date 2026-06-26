import { SetMetadata } from '@nestjs/common';
import { PERMISSION_META_KEY } from '../constants/rbac.constants';

export const RequirePermission = (code: string) => SetMetadata(PERMISSION_META_KEY, code);
