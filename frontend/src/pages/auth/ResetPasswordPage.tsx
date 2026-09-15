import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  AuthCard,
  AuthField,
  AuthStatus,
  AuthSubmit,
  BackToLogin,
} from '@/components/auth/AuthCard';
import { useDocumentMetadata } from '@/hooks/useDocumentMetadata';

export function Component() {
  const [status, setStatus] = useState('');
  useDocumentMetadata({
    title: 'تعيين كلمة مرور — Englishine',
    description: 'تعيين كلمة مرور جديدة لحساب Englishine.',
    openGraph: [],
    structuredData: [],
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const data = new FormData(event.currentTarget);
    if (data.get('new-password') !== data.get('confirm-password')) {
      setStatus('كلمتا المرور غير متطابقتين.');
      return;
    }
    setStatus(
      'تغيير كلمة المرور يحتاج رمز استعادة صالح ومزود مصادقة على الخادم. لم يتم تغيير شيء.',
    );
  };
  return (
    <AuthCard
      eyebrow="حماية الحساب"
      title="اختار كلمة مرور جديدة"
      description="الرابط الآمن والتحقق من صلاحيته لازم يتمّا على الخادم قبل حفظ كلمة المرور."
      footer={<BackToLogin />}
    >
      <form className="auth-fields" onSubmit={submit} noValidate>
        <AuthField
          id="new-password"
          label="كلمة المرور الجديدة"
          type="password"
          autoComplete="new-password"
          hint="استخدم كلمة مرور قوية ومختلفة."
        />
        <AuthField
          id="confirm-password"
          label="تأكيد كلمة المرور"
          type="password"
          autoComplete="new-password"
        />
        <AuthSubmit>حفظ كلمة المرور</AuthSubmit>
        <AuthStatus message={status} />
      </form>
    </AuthCard>
  );
}
