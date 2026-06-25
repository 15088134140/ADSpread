export const BusinessErrorCode = {
  PARAM_ERROR: 40001,
  VALIDATION_ERROR: 40002,
  DUPLICATE_RESOURCE: 40003,
  BUSINESS_RULE_VIOLATION: 40004,
  UNAUTHORIZED: 40101,
  TOKEN_INVALID: 40102,
  FORBIDDEN: 40301,
  NOT_FOUND: 40401,
  INTERNAL_ERROR: 50001,
} as const;

export type BusinessErrorCodeValue = (typeof BusinessErrorCode)[keyof typeof BusinessErrorCode];
