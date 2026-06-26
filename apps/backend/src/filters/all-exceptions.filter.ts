import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { BusinessException } from '../common/errors/business.exception';
import {
  resolveLocale,
  resolveErrorMessage,
  type AppLocale,
  type ErrorMessageKey,
} from '../common/i18n/error-messages';

interface ErrorResponse {
  code: number;
  message: string;
  data: unknown;
  timestamp: number;
  path: string;
  method: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    const httpStatus =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

    const responseObject =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as Record<string, unknown>)
        : {};

    const code =
      typeof responseObject.code === 'number'
        ? responseObject.code
        : httpStatus >= 500
          ? 50001
          : httpStatus === 401
            ? 40101
            : httpStatus === 403
              ? 40301
              : httpStatus === 404
                ? 40401
                : 40001;

    // 按请求 Accept-Language 解析语言（specs §5.4），无 header 回退 zh-CN。
    const acceptLanguage =
      request?.headers?.['accept-language'] !== undefined &&
      typeof request.headers['accept-language'] === 'string'
        ? request.headers['accept-language']
        : undefined;
    const locale = resolveLocale(acceptLanguage);

    const message = this.resolveMessage(exception, responseObject, httpStatus, locale);

    const responseBody: ErrorResponse = {
      code,
      message,
      data: responseObject.data ?? null,
      timestamp: Date.now(),
      path: httpAdapter.getRequestUrl(request),
      method: httpAdapter.getRequestMethod(request),
    };

    // Log error
    this.logger.error(
      `[${httpStatus}] ${request.method} ${request.url} - ${message}`,
      exception instanceof Error ? exception.stack : ''
    );

    httpAdapter.reply(response, responseBody, httpStatus);
  }

  /**
   * 解析响应 message（specs §5.4）：
   * - BusinessException：按 messageKey/messageParams + locale 解析。
   * - ValidationPipe 产生的数组 message：保持现状不本地化（§1.2）。
   * - 通用 HTTP 兜底（401/403/404/500）：按 locale 解析对应 key。
   * - 其他情况：沿用 responseObject.message / exception.message。
   */
  private resolveMessage(
    exception: unknown,
    responseObject: Record<string, unknown>,
    httpStatus: number,
    locale: AppLocale
  ): string {
    if (exception instanceof BusinessException) {
      return resolveErrorMessage(exception.messageKey, exception.messageParams, locale);
    }

    if (Array.isArray(responseObject.message)) {
      return exception instanceof HttpException ? exception.message : 'Validation error';
    }

    const generic = this.resolveGenericMessage(httpStatus, locale);
    if (generic !== null) {
      return generic;
    }

    if (typeof responseObject.message === 'string' && responseObject.message.length > 0) {
      return responseObject.message;
    }

    return exception instanceof HttpException
      ? exception.message
      : resolveErrorMessage('INTERNAL_ERROR', [], locale);
  }

  /**
   * 通用 HTTP 兜底消息：仅 401/403/404/500 按 locale 解析；其余状态码返回 null 表示沿用原 message。
   * 用 map 而非 switch(枚举 case)，避免 number 与 HttpStatus 枚举的不安全枚举比较。
   */
  private resolveGenericMessage(httpStatus: number, locale: AppLocale): string | null {
    const key = GENERIC_MESSAGE_BY_STATUS[httpStatus];
    return key ? resolveErrorMessage(key, [], locale) : null;
  }
}

const GENERIC_MESSAGE_BY_STATUS: Record<number, ErrorMessageKey> = {
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
};
