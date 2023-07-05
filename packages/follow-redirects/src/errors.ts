const createErrorType = <
  ErrorCode extends string,
  BaseErrorType extends ErrorConstructor = ErrorConstructor,
>(
  code: ErrorCode,
  message: string,
  BaseErrorType?: BaseErrorType,
) => {
  const BaseClass = BaseErrorType ?? Error;
  return class extends BaseClass {
    get code() {
      return code;
    }

    constructor() {
      super();
      Error.captureStackTrace(this, this.constructor);
      this.message = this.cause
        ? `${message}: ${(this.cause as Error).message}`
        : message;
    }
  };
};

export const Errors = {
  InvalidUrl: createErrorType('ERR_INVALID_URL', 'Invalid URL', TypeError),
  RedirectionFailed: createErrorType(
    'ERR_REDIRECTION_FAILURE',
    'Redirected request failed',
  ),
  TooManyRedirects: createErrorType(
    'ERR_TOO_MANY_REDIRECTS',
    'Maximum number of redirects exceeded',
  ),
  OversizedRequestBody: createErrorType(
    'ERR_MAX_BODY_LENGTH_EXCEEDED',
    'Request body larger than maxBodyLength limit',
  ),
  WriteAfterEnd: createErrorType(
    'ERR_STREAM_WRITE_AFTER_END',
    'Write after end',
  ),
};
