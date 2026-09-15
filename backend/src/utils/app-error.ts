export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  public constructor(
    message: string,
    options?: { statusCode?: number; code?: string; details?: unknown },
  );
  public constructor(statusCode: number, message: string, code?: string, details?: unknown);
  public constructor(
    messageOrStatus: string | number,
    optionsOrMessage: { statusCode?: number; code?: string; details?: unknown } | string = {},
    code?: string,
    details?: unknown,
  ) {
    const legacy = typeof messageOrStatus === 'number';
    const message = legacy ? (optionsOrMessage as string) : messageOrStatus;
    const options = legacy
      ? { statusCode: messageOrStatus, code, details }
      : typeof optionsOrMessage === 'string'
        ? {}
        : optionsOrMessage;
    super(message);
    this.name = 'AppError';
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? 'INTERNAL_SERVER_ERROR';
    this.details = options.details;
  }
}
