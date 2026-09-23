import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiClientError,
  isTerminalSessionError,
  shouldRefreshOnUnauthorized,
} from '../src/services/auth-errors.ts';

test('only session 401s trigger a refresh', () => {
  assert.equal(shouldRefreshOnUnauthorized(), true);
  assert.equal(shouldRefreshOnUnauthorized('UNAUTHORIZED'), true);
  assert.equal(shouldRefreshOnUnauthorized('SESSION_INVALID'), true);
  assert.equal(shouldRefreshOnUnauthorized('UPLOAD_AUTHORIZATION_EXPIRED'), false);
  assert.equal(shouldRefreshOnUnauthorized('UPLOAD_AUTHORIZATION_REUSED'), false);
});

test('network errors do not terminate the session', () => {
  assert.equal(isTerminalSessionError(new Error('network')), false);
  assert.equal(isTerminalSessionError(new ApiClientError('تعذر الاتصال')), false);
  assert.equal(
    isTerminalSessionError(new ApiClientError('انتهت الجلسة.', 'REFRESH_TOKEN_REUSED')),
    true,
  );
  assert.equal(
    isTerminalSessionError(new ApiClientError('انتهت الجلسة.', 'REFRESH_TOKEN_REQUIRED')),
    true,
  );
});
