function normalizeApiUrl(configured: string | undefined): string | undefined {
  const value = configured?.trim().replace(/\/$/, '');
  if (!value || typeof window === 'undefined') return value || undefined;
  try {
    const url = new URL(value, window.location.origin);
    const frontendIsLoopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(
      window.location.hostname,
    );
    const apiIsLoopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(
      url.hostname,
    );
    if (frontendIsLoopback && apiIsLoopback) {
      url.hostname = window.location.hostname;
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return value;
  }
}

const configuredApiUrl = normalizeApiUrl(
  import.meta.env.VITE_API_URL as string | undefined,
);
const apiBaseUrl = configuredApiUrl ?? '/api/v1';

export function mediaUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${apiBaseUrl}${normalized}`;
}

export interface ApiUser {
  id: string;
  email: string;
  displayName: string;
  roles: Array<'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT'>;
}

interface AuthResponse {
  accessToken: string;
  user: ApiUser;
}

let accessToken: string | null = null;
let refreshRequest: Promise<AuthResponse> | null = null;
const fallbackDeviceId = crypto.randomUUID();

function getDeviceId(): string {
  if (typeof window === 'undefined') return fallbackDeviceId;
  try {
    const key = 'englishine-device-id';
    const current = window.localStorage.getItem(key);
    if (current) return current;
    const created = crypto.randomUUID();
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return fallbackDeviceId;
  }
}

function authHeaders(withBody: boolean): HeadersInit {
  return {
    'x-device-id': getDeviceId(),
    ...(withBody ? { 'content-type': 'application/json' } : {}),
  };
}

const authErrorMessages: Record<string, string> = {
  EMAIL_EXISTS: 'يوجد حساب مسجل بهذا البريد الإلكتروني بالفعل.',
  INVALID_CREDENTIALS: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  ACCOUNT_INACTIVE: 'هذا الحساب غير نشط حاليًا.',
  VALIDATION_ERROR: 'راجع البيانات المكتوبة وحاول مرة أخرى.',
  REFRESH_TOKEN_REQUIRED: 'انتهت الجلسة. سجل الدخول مرة أخرى.',
  INVALID_REFRESH_TOKEN: 'انتهت الجلسة. سجل الدخول مرة أخرى.',
  REFRESH_TOKEN_EXPIRED: 'انتهت الجلسة. سجل الدخول مرة أخرى.',
  REFRESH_TOKEN_REUSED: 'تم إغلاق الجلسة لحماية حسابك. سجل الدخول مرة أخرى.',
  INVALID_DEVICE_SESSION: 'هذه الجلسة غير صالحة على الجهاز الحالي.',
  SESSION_INVALID: 'انتهت الجلسة. سجل الدخول مرة أخرى.',
  ENROLLMENT_REQUIRED: 'هذا المحتوى متاح بعد تفعيل الكورس.',
  GRADE_NOT_FOUND: 'الصف الدراسي المختار غير متاح.',
  STUDENT_PROFILE_REQUIRED: 'حساب الطالب غير مكتمل.',
  FST_ERR_RATE_LIMIT:
    'محاولات كثيرة في وقت قصير. انتظر قليلًا ثم حاول مرة أخرى.',
};

const connectionErrorMessage = 'تعذر الاتصال بالخادم. تحقق من الشبكة وحاول مرة أخرى.';

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    const code = payload?.error?.code;
    throw new Error(
      (code && authErrorMessages[code]) ??
        payload?.error?.message ??
        'تعذر إكمال الطلب. حاول مرة أخرى.',
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function request(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('x-device-id', getDeviceId());
  if (accessToken && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }
  if (init.body && !(init.body instanceof FormData) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  try {
    return await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new Error(connectionErrorMessage);
  }
}

async function authRequest(
  path: string,
  body?: unknown,
): Promise<AuthResponse> {
  const response = await request(path, {
    method: 'POST',
    headers: authHeaders(body !== undefined),
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await parseResponse<AuthResponse>(response);
  accessToken = payload.accessToken;
  return payload;
}

function refreshSession(): Promise<AuthResponse> {
  refreshRequest ??= authRequest('/auth/refresh').finally(() => {
    refreshRequest = null;
  });
  return refreshRequest;
}

export const authApi = {
  login: (input: { email: string; password: string }) =>
    authRequest('/auth/login', input),
  signup: (input: {
    fullName: string;
    email: string;
    password: string;
    parentPhone?: string;
  }) => authRequest('/auth/register', input),
  refresh: refreshSession,
  async logout() {
    const response = await request('/auth/logout', { method: 'POST' });
    await parseResponse<void>(response);
    accessToken = null;
  },
};

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response = await request(path, init);
  if (response.status === 401) {
    try {
      await refreshSession();
      response = await request(path, init);
    } catch {
      accessToken = null;
    }
  }
  return parseResponse<T>(response);
}

export async function apiBlob(path: string): Promise<Blob> {
  let response = await request(path);
  if (response.status === 401) {
    try {
      await refreshSession();
      response = await request(path);
    } catch {
      accessToken = null;
    }
  }
  if (!response.ok) {
    await parseResponse<void>(response);
  }
  return response.blob();
}
