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
      if (data.has('login-email') || data.has('login-identifier')) {
        setStatus('جارٍ تسجيل الدخول…');
        const identifier = String(data.get('login-identifier') ?? data.get('login-email') ?? '');
        const user = await session.login({
          identifier,
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
      if (data.has('student-phone')) {
        setStatus('جارٍ إنشاء الحساب…');
        await session.signup({
          fullName: String(data.get('student-name') ?? ''),
          email: String(data.get('signup-email') ?? '') || undefined,
          studentPhone: String(data.get('student-phone') ?? ''),
          guardianPhone: String(data.get('guardian-phone') ?? ''),
          gradeId: String(data.get('grade-id') ?? ''),
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
