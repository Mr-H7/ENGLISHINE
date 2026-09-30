import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { AuthCard, AuthStatus, AuthSubmit } from '@/components/auth/AuthCard';
import { useDocumentMetadata } from '@/hooks/useDocumentMetadata';
import { useSession } from '@/hooks/useSession';
import { apiRequest } from '@/services/api';

interface ActivationResult {
  unlockType: 'UNIT' | 'LESSON';
  unitId: string | null;
  lessonId: string | null;
  title: string;
}

export function Component() {
  const session = useSession();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<ActivationResult | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useDocumentMetadata({
    title: 'تفعيل كود - Englishine',
    description: 'تفعيل كود الوصول إلى محتوى Englishine.',
    openGraph: [],
    structuredData: [],
  });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (code.trim().length < 8 || code.trim().length > 120) {
      setMessage('أدخل كود التفعيل كاملًا، من 8 إلى 120 حرفًا.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const response = await apiRequest<{ data: ActivationResult }>('/student/activation', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() }),
      });
      setResult(response.data);
      setCode('');
      setMessage(`تم تفعيل «${response.data.title}» بنجاح.`);
    } catch (reason: unknown) {
      setMessage(reason instanceof Error ? reason.message : 'تعذر تفعيل الكود.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthCard
      eyebrow="تفعيل المحتوى"
      title="فعّل كود الوصول"
      description="أدخل الكود الذي حصلت عليه لتفعيل الوحدة أو الدرس على حسابك."
      footer={<p>يُستخدم الكود حسب شروط التفعيل التي حددها المعلم ولا يمنح وصولًا إلى محتوى آخر.</p>}
    >
      {session.user ? <form className="auth-fields" onSubmit={(event) => void submit(event)}>
        <div className="auth-field">
          <label htmlFor="activation-code">كود التفعيل</label>
          <div className="auth-input-wrap">
            <input id="activation-code" name="activation-code" dir="ltr" value={code}
              onChange={(event) => setCode(event.target.value)} minLength={8} maxLength={120} required autoComplete="off" />
          </div>
        </div>
        <AuthSubmit busy={busy}>تفعيل الكود</AuthSubmit>
        <AuthStatus message={message} />
        {result?.lessonId ? <Link className="student-primary-action" to={`/student/lesson/${result.lessonId}/`}>افتح الدرس المفعّل</Link> : null}
        {result?.unitId && !result.lessonId ? <Link className="student-secondary-action" to="/student/">استعرض دروس الوحدة المفعّلة</Link> : null}
      </form> : <p>يجب تسجيل الدخول قبل تفعيل الكود. <Link to="/login/">تسجيل الدخول</Link></p>}
    </AuthCard>
  );
}
