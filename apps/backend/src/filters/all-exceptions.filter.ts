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
  timestamp: string;
  path: string;
  method: string;
  details?: unknown;
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
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorMessage =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const errorDetails =
      exception instanceof HttpException ? exception.getResponse() : null;

    const responseBody: ErrorResponse = {
      code: httpStatus,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      path: httpAdapter.getRequestUrl(request),
      method: httpAdapter.getRequestMethod(request),
      details: typeof errorDetails === 'object' ? errorDetails : undefined,
    };

    // Log error
    this.logger.error(
      `[${httpStatus}] ${request.method} ${request.url} - ${errorMessage}`,
      exception instanceof Error ? exception.stack : '',
    );

    httpAdapter.reply(response, responseBody, httpStatus);
  }
}
