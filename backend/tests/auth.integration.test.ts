import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { LightMyRequestResponse } from 'fastify';
import { buildApp } from '../src/create-app.js';
import type { SystemRole } from '../src/generated/prisma/client.js';

const app = await buildApp();
await app.ready();

const email = `auth-${crypto.randomUUID()}@example.test`;
const password = 'Englishine-Test-2026!';
const sessionHeaders = {
  'user-agent': 'Englishine authentication integration test',
  'x-device-id': `test-${crypto.randomUUID()}`,
};
const jsonHeaders = { ...sessionHeaders, 'content-type': 'application/json' };

interface AuthPayload {
  accessToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    roles: SystemRole[];
  };
}

interface ErrorPayload {
  error: { code: string; message: string };
}

interface CurrentUserPayload {
  user: AuthPayload['user'];
}

function cookieHeaders(response: LightMyRequestResponse): string[] {
  const value = response.headers['set-cookie'];
  return Array.isArray(value) ? value : value ? [value] : [];
}

function namedCookie(response: LightMyRequestResponse, name: string): string {
  const header = cookieHeaders(response).find((item) => item.startsWith(`${name}=`));
  assert.ok(header, `Expected ${name} cookie`);
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=/i);
  const [cookie] = header.split(';', 1);
  assert.ok(cookie, `Expected the ${name} cookie value`);
  return cookie;
}

function refreshCookie(response: LightMyRequestResponse): string {
  const header = cookieHeaders(response).find((item) => item.startsWith('englishine_refresh='));
  assert.ok(header, 'Expected a refresh cookie');
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=/i);
  assert.match(header, /Path=\/api\/v1\/auth/i);
  const [cookie] = header.split(';', 1);
  assert.ok(cookie, 'Expected the refresh cookie value');
  return cookie;
}

async function login(): Promise<{ payload: AuthPayload; cookie: string }> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: jsonHeaders,
    payload: { email, password },
  });
  assert.equal(response.statusCode, 200);
  return { payload: response.json<AuthPayload>(), cookie: refreshCookie(response) };
}

after(async () => {
  await app.prisma.user.deleteMany({ where: { email } });
  await app.close();
});

void test('production authentication flow', async () => {
  const anonymous = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
  assert.equal(anonymous.statusCode, 401, 'Protected endpoint must reject anonymous requests');

  const registration = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    headers: jsonHeaders,
    payload: {
      fullName: 'طالب اختبار المصادقة',
      email,
      password,
    },
  });
  assert.equal(registration.statusCode, 201);
  const registered = registration.json<AuthPayload>();
  assert.equal(registered.user.email, email);
  assert.deepEqual(registered.user.roles, ['STUDENT']);
  refreshCookie(registration);
  const cookieSession = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { cookie: namedCookie(registration, 'englishine_access') },
  });
  assert.equal(cookieSession.statusCode, 200, 'Access cookie must authenticate media-style requests');

  const duplicate = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    headers: jsonHeaders,
    payload: { fullName: 'طالب مكرر', email, password },
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json<ErrorPayload>().error.code, 'EMAIL_EXISTS');

  const currentUser = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { authorization: `Bearer ${registered.accessToken}` },
  });
  assert.equal(currentUser.statusCode, 200);
  assert.equal(currentUser.json<CurrentUserPayload>().user.id, registered.user.id);

  const decoded = app.jwt.decode(registered.accessToken) as {
    sub: string;
    email: string;
    roles: SystemRole[];
    sessionId: string;
  };
  const expiredToken = app.jwt.sign(
    {
      sub: decoded.sub,
      email: decoded.email,
      roles: decoded.roles,
      sessionId: decoded.sessionId,
    },
    { expiresIn: '1ms' },
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
  const expired = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { authorization: `Bearer ${expiredToken}` },
  });
  assert.equal(expired.statusCode, 401);

  const invalidLogin = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: jsonHeaders,
    payload: { email, password: 'incorrect-password' },
  });
  assert.equal(invalidLogin.statusCode, 401);
  assert.equal(invalidLogin.json<ErrorPayload>().error.code, 'INVALID_CREDENTIALS');

  const firstLogin = await login();
  const firstRefresh = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    headers: { ...sessionHeaders, cookie: firstLogin.cookie },
  });
  assert.equal(firstRefresh.statusCode, 200);
  const secondCookie = refreshCookie(firstRefresh);
  assert.notEqual(secondCookie, firstLogin.cookie, 'Refresh token must rotate');

  const persistedRefresh = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    headers: { ...sessionHeaders, cookie: secondCookie },
  });
  assert.equal(persistedRefresh.statusCode, 200, 'Rotated cookie must persist the session');
  refreshCookie(persistedRefresh);

  const reused = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    headers: { ...sessionHeaders, cookie: firstLogin.cookie },
  });
  assert.equal(reused.statusCode, 401);
  assert.equal(reused.json<ErrorPayload>().error.code, 'REFRESH_TOKEN_REUSED');

  const logoutSession = await login();
  const logout = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/logout',
    headers: { ...sessionHeaders, cookie: logoutSession.cookie },
  });
  assert.equal(logout.statusCode, 204);
  assert.match(String(logout.headers['set-cookie']), /Max-Age=0|Expires=/i);

  const afterLogout = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { authorization: `Bearer ${logoutSession.payload.accessToken}` },
  });
  assert.equal(afterLogout.statusCode, 401, 'Logout must invalidate the server-side session');
});
