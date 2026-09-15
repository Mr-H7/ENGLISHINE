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
    title: 'تسجيل الدخول — Englishine',
    description: 'تسجيل الدخول إلى مساحة الطالب في Englishine.',
    openGraph: [],
    structuredData: [],
  });
  return (
    <AuthCard
      eyebrow="مساحة الطالب"
      title="أهلًا بيك من جديد"
      description="ادخل بياناتك علشان ترجع لمسار تعلمك.
"
      footer={
        <p>
          لسه معندكش حساب؟ <Link to="/signup/">أنشئ حساب جديد</Link>
        </p>
      }
    >
      <form className="auth-fields" onSubmit={submit} noValidate>
        <AuthField
          id="login-email"
          label="البريد الإلكتروني"
          type="email"
          autoComplete="email"
        />
        <AuthField
          id="login-password"
          label="كلمة المرور"
          type="password"
          autoComplete="current-password"
        />
        <div className="auth-row">
          <label>
            <input type="checkbox" name="remember" /> تذكرني
          </label>
          <Link to="/forgot-password/">نسيت كلمة المرور؟</Link>
        </div>
        <AuthSubmit busy={isSubmitting}>تسجيل الدخول</AuthSubmit>
        <AuthStatus message={status} error={hasError} />
      </form>
    </AuthCard>
  );
}
