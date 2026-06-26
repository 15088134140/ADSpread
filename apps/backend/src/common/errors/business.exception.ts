import { HttpException, HttpStatus } from '@nestjs/common';
import { BusinessErrorCode, type BusinessErrorCodeValue } from './business-error-codes';
import { resolveErrorMessage, type ErrorMessageKey } from '../i18n/error-messages';

/**
 * 业务异常。
 *
 * 构造以消息 key + 参数为主：super 始终以 zh-CN 解析结果传入，
 * 保证 BusinessException.message 默认值与现有测试断言（直接断言 .message 的中文文案）一致。
 * AllExceptionsFilter 在响应时按请求 Accept-Language 重新解析 messageKey/messageParams，
 * 从而返回对应语言的 message，而无需改动各 throw 站点的业务码与 HTTP 状态码语义。
 */
export class BusinessException extends HttpException {
  public readonly messageKey: ErrorMessageKey;
  public readonly messageParams: unknown[];

  constructor(
    key: ErrorMessageKey,
    params: unknown[] = [],
    public readonly businessCode: BusinessErrorCodeValue = BusinessErrorCode.BUSINESS_RULE_VIOLATION,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details: unknown = null
  ) {
    super(
      { code: businessCode, message: resolveErrorMessage(key, params, 'zh-CN'), data: details },
      status
    );
    this.messageKey = key;
    this.messageParams = params;
  }
}
