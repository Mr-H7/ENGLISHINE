import {
  ApiClientError,
  shouldRefreshOnUnauthorized,
} from '@/services/auth-errors';

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
  email: string | null;
  phone?: string | null;
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
  PHONE_EXISTS: 'يوجد حساب مسجل بهذا الرقم بالفعل.',
  INVALID_PHONE: 'أدخل رقم هاتف مصري صحيح.',
  INVALID_CREDENTIALS: 'بيانات الدخول غير صحيحة.',
  ACCOUNT_INACTIVE: 'هذا الحساب غير نشط حاليًا.',
  VALIDATION_ERROR: 'راجع البيانات المكتوبة وحاول مرة أخرى.',
  REFRESH_TOKEN_REQUIRED: 'انتهت الجلسة. سجل الدخول مرة أخرى.',
  INVALID_REFRESH_TOKEN: 'انتهت الجلسة. سجل الدخول مرة أخرى.',
  REFRESH_TOKEN_EXPIRED: 'انتهت الجلسة. سجل الدخول مرة أخرى.',
  REFRESH_TOKEN_REUSED: 'تم إغلاق الجلسة لحماية حسابك. سجل الدخول مرة أخرى.',
  INVALID_DEVICE_SESSION: 'هذه الجلسة غير صالحة على الجهاز الحالي.',
  SESSION_INVALID: 'انتهت الجلسة. سجل الدخول مرة أخرى.',
  ENROLLMENT_REQUIRED: 'هذا المحتوى متاح بعد تفعيل الكورس.',
  UNSUPPORTED_FILE_TYPE: 'نوع الملف غير مدعوم.',
  UPLOAD_TOO_LARGE: 'حجم الملف أكبر من الحد المسموح.',
  DIRECT_UPLOAD_UNAVAILABLE: 'الرفع المباشر غير متاح حالياً. استخدم التخزين المحلي.',
  UPLOAD_OBJECT_MISSING: 'لم يتم العثور على الملف المرفوع. أعد المحاولة.',
  UPLOAD_SIZE_MISMATCH: 'حجم الملف المرفوع لا يطابق التصريح.',
  UPLOAD_TYPE_MISMATCH: 'نوع الملف المرفوع لا يطابق التصريح.',
  UPLOAD_AUTHORIZATION_REUSED: 'تم استخدام تصريح الرفع بالفعل.',
  UNIT_HAS_DEPENDENCIES: 'احذف الدروس وأكواد التفعيل المرتبطة بالوحدة أولًا.',
  LESSON_HAS_DEPENDENCIES: 'احذف فيديوهات الدرس وملفاته وواجباته وأكواد تفعيله أولًا.',
  VIDEO_HAS_DEPENDENCIES: 'افصل الفيديو عن حل الواجب قبل حذفه.',
  ACTIVATION_CODE_NOT_FOUND: 'كود التفعيل غير موجود.',
  ACTIVATION_HAS_REDEMPTIONS: 'هذا الكود مستخدم بالفعل. عطّله بدلًا من حذفه.',
  ACTIVATION_INVALID: 'كود التفعيل غير صحيح.',
  ACTIVATION_ALREADY_USED: 'تم استخدام هذا الكود على حسابك من قبل.',
  ACTIVATION_INACTIVE: 'كود التفعيل لم يعد نشطًا.',
  ACTIVATION_EXPIRED: 'انتهت صلاحية كود التفعيل.',
  ACTIVATION_ASSIGNED: 'هذا الكود مخصص لطالب آخر.',
  ACTIVATION_TARGET_UNAVAILABLE: 'المحتوى المرتبط بالكود غير منشور حاليًا.',
  ACTIVATION_EXHAUSTED: 'وصل الكود إلى الحد الأقصى للاستخدام.',
  UPLOAD_AUTHORIZATION_EXPIRED: 'انتهت صلاحية تصريح الرفع. أعد المحاولة.',
  GRADE_NOT_FOUND: 'الصف الدراسي المختار غير متاح.',
  STUDENT_PROFILE_REQUIRED: 'حساب الطالب غير مكتمل.',
  FST_ERR_RATE_LIMIT:
    'محاولات كثيرة في وقت قصير. انتظر قليلًا ثم حاول مرة أخرى.',
};

const connectionErrorMessage = 'تعذر الاتصال بالخادم. تحقق من الشبكة وحاول مرة أخرى.';

async function readErrorPayload(response: Response): Promise<{
  code?: string;
  message?: string;
} | null> {
  const payload = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  return payload?.error ?? null;
}

function toClientError(error: { code?: string; message?: string } | null): ApiClientError {
  const code = error?.code;
  return new ApiClientError(
    (code && authErrorMessages[code]) ?? error?.message ?? 'تعذر إكمال الطلب. حاول مرة أخرى.',
    code,
  );
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw toClientError(await readErrorPayload(response));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function readAccessTokenExpiresAt(token: string | null): number | null {
  if (!token) return null;
  try {
    const [, encoded] = token.split('.');
    if (!encoded) return null;
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(normalized)) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function getAccessTokenExpiresAt(): number | null {
  return readAccessTokenExpiresAt(accessToken);
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
  login: (input: { email?: string; phone?: string; identifier?: string; password: string }) =>
    authRequest('/auth/login', input),
  signup: (input: {
    fullName: string;
    email?: string;
    studentPhone: string;
    guardianPhone: string;
    gradeId: string;
    password: string;
  }) => authRequest('/auth/register', input),
  refresh: refreshSession,
  async logout() {
    const response = await request('/auth/logout', { method: 'POST' });
    await parseResponse<void>(response);
    accessToken = null;
  },
};

async function recoverFromUnauthorized(response: Response): Promise<boolean> {
  const preview = response.clone();
  const error = await readErrorPayload(preview);
  if (!shouldRefreshOnUnauthorized(error?.code)) {
    return false;
  }
  try {
    await refreshSession();
    return true;
  } catch {
    accessToken = null;
    return false;
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response = await request(path, init);
  if (response.status === 401 && (await recoverFromUnauthorized(response))) {
    response = await request(path, init);
  }
  return parseResponse<T>(response);
}

export async function apiBlob(path: string): Promise<Blob> {
  let response = await request(path);
  if (response.status === 401 && (await recoverFromUnauthorized(response))) {
    response = await request(path);
  }
  if (!response.ok) {
    await parseResponse<void>(response);
  }
  return response.blob();
}
