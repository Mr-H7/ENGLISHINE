import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useSession } from '@/hooks/useSession';

function safeReturnTo(state: unknown): string | null {
  if (!state || typeof state !== 'object' || !('returnTo' in state))
    return null;
  const value = state.returnTo;
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//')
    ? value
    : null;
}

export function usePreviewSubmit(message: string) {
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!event.currentTarget.reportValidity()) return;
    const data = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setHasError(false);
    try {
      if (data.has('login-email')) {
        setStatus('جارٍ تسجيل الدخول…');
        const user = await session.login({
          email: String(data.get('login-email') ?? ''),
          password: String(data.get('login-password') ?? ''),
        });
        const staff = user.roles.some((role) => role !== 'STUDENT');
        navigate(
          safeReturnTo(location.state) ?? (staff ? '/admin/' : '/student/'),
          {
            replace: true,
          },
        );
        return;
      }
      if (data.has('signup-email')) {
        setStatus('جارٍ إنشاء الحساب…');
        await session.signup({
          fullName: String(data.get('student-name') ?? ''),
          email: String(data.get('signup-email') ?? ''),
          parentPhone: String(data.get('parent-phone') ?? '') || undefined,
          password: String(data.get('signup-password') ?? ''),
        });
        navigate('/student/', { replace: true });
        return;
      }
      setStatus(message);
    } catch (error) {
      setHasError(true);
      setStatus(error instanceof Error ? error.message : 'تعذر إكمال الطلب.');
    } finally {
      setIsSubmitting(false);
    }
  };
  return { status, submit, isSubmitting, hasError };
}
