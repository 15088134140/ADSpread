import { SetMetadata } from '@nestjs/common';
import { OPERATION_LOG_META_KEY } from '../constants/rbac.constants';

export interface OperationLogMetadata {
  operation: string;
  targetType?: string;
}

export const OperationLog = (operation: string, targetType?: string) =>
  SetMetadata(OPERATION_LOG_META_KEY, { operation, targetType } satisfies OperationLogMetadata);
