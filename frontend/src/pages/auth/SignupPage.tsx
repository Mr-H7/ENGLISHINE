import { Link } from 'react-router';
import {
  AuthCard,
  AuthField,
  AuthStatus,
  AuthSubmit,
} from '@/components/auth/AuthCard';
import { useDocumentMetadata } from '@/hooks/useDocumentMetadata';
import { usePreviewSubmit } from '@/hooks/usePreviewSubmit';

export function Component() {
  const { status, submit, isSubmitting, hasError } = usePreviewSubmit('');
  useDocumentMetadata({
    title: 'إنشاء حساب — Englishine',
    description: 'إنشاء حساب طالب جديد في Englishine.',
    openGraph: [],
    structuredData: [],
  });
  return (
    <AuthCard
      eyebrow="ابدأ مع Englishine"
      title="أنشئ حساب الطالب"
      description="اكتب بياناتك الأساسية لبدء مساحة التعلم الخاصة بك."
      footer={
        <p>
          عندك حساب بالفعل؟ <Link to="/login/">سجل دخول</Link>
        </p>
      }
    >
      <form className="auth-fields" onSubmit={submit} noValidate>
        <AuthField id="student-name" label="اسم الطالب" autoComplete="name" />
        <AuthField
          id="signup-email"
          label="البريد الإلكتروني"
          type="email"
          autoComplete="email"
        />
        <AuthField
          id="parent-phone"
          label="رقم ولي الأمر"
          type="tel"
          autoComplete="tel"
          required={false}
        />
        <AuthField
          id="signup-password"
          label="كلمة المرور"
          type="password"
          autoComplete="new-password"
          minLength={10}
        />
        <AuthSubmit busy={isSubmitting}>إنشاء الحساب</AuthSubmit>
        <AuthStatus message={status} error={hasError} />
      </form>
    </AuthCard>
  );
}
