export class ApiClientError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
  }
}

const sessionRefreshCodes = new Set(['UNAUTHORIZED', 'SESSION_INVALID']);

const terminalSessionCodes = new Set([
  'REFRESH_TOKEN_REQUIRED',
  'INVALID_REFRESH_TOKEN',
  'REFRESH_TOKEN_EXPIRED',
  'REFRESH_TOKEN_REUSED',
  'INVALID_DEVICE_SESSION',
  'SESSION_INVALID',
]);

export function shouldRefreshOnUnauthorized(code?: string): boolean {
  if (!code) return true;
  return sessionRefreshCodes.has(code);
}

export function isTerminalSessionError(error: unknown): boolean {
  return error instanceof ApiClientError && Boolean(error.code && terminalSessionCodes.has(error.code));
}
