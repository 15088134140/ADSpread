import { HttpException, HttpStatus } from '@nestjs/common';
import { BusinessErrorCode, type BusinessErrorCodeValue } from './business-error-codes';

export class BusinessException extends HttpException {
  constructor(
    message: string,
    public readonly businessCode: BusinessErrorCodeValue = BusinessErrorCode.BUSINESS_RULE_VIOLATION,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details: unknown = null
  ) {
    super({ code: businessCode, message, data: details }, status);
  }
}
