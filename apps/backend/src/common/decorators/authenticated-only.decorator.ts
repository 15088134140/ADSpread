import { SetMetadata } from '@nestjs/common';
import { AUTHENTICATED_ONLY_META_KEY } from '../constants/rbac.constants';

export const AuthenticatedOnly = () => SetMetadata(AUTHENTICATED_ONLY_META_KEY, true);
