import { SetMetadata } from '@nestjs/common';
import { PUBLIC_META_KEY } from '../constants/rbac.constants';

export const Public = () => SetMetadata(PUBLIC_META_KEY, true);
