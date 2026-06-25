import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

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

    const message =
      typeof responseObject.message === 'string'
        ? responseObject.message
        : exception instanceof HttpException
          ? exception.message
          : 'Internal server error';

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
}
