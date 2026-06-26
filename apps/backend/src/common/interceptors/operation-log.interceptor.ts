import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { OPERATION_LOG_META_KEY } from '../constants/rbac.constants';
import { OperationLogMetadata } from '../decorators/operation-log.decorator';
import { JwtUser } from '../decorators/current-user.decorator';
import { OperationLogService } from '../../modules/system/log/operation-log.service';

const SENSITIVE_KEYS = new Set(['password', 'oldPassword', 'newPassword']);

function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(params)) {
    result[key] = SENSITIVE_KEYS.has(key) ? '***' : params[key];
  }
  return result;
}

interface LoggableRequest {
  method: string;
  ip: string;
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
  params: Record<string, unknown>;
  user?: JwtUser;
}

@Injectable()
export class OperationLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly logService: OperationLogService
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.get<OperationLogMetadata>(
      OPERATION_LOG_META_KEY,
      context.getHandler()
    );
    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<LoggableRequest>();
    const startTime = Date.now();

    const writeLog = (status: 0 | 1, errorMsg?: string) => {
      const elapsed = Date.now() - startTime;
      const params = sanitizeParams({ ...request.body, ...request.params });
      // 异步触发日志写入，不阻塞响应；不 await，错误吞掉避免影响主流程
      Promise.resolve()
        .then(() =>
          this.logService.create({
            adminId: request.user?.id,
            username: request.user?.username,
            operation: metadata.operation,
            method: request.method,
            params,
            time: elapsed,
            ip: request.ip,
            userAgent: request.headers['user-agent'] as string | undefined,
            status,
            errorMsg,
            roleId: request.user?.roleId ?? undefined,
          })
        )
        .catch(() => {
          // 日志写入失败不影响业务，吞掉
        });
    };

    return next.handle().pipe(
      tap(() => writeLog(1)),
      catchError((err: unknown) => {
        writeLog(0, err instanceof Error ? err.message : String(err));
        return throwError(() => err);
      })
    );
  }
}
