import {
  AuthCard,
  AuthField,
  AuthStatus,
  AuthSubmit,
  BackToLogin,
} from '@/components/auth/AuthCard';
import { useDocumentMetadata } from '@/hooks/useDocumentMetadata';
import { usePreviewSubmit } from '@/hooks/usePreviewSubmit';

export function Component() {
  const { status, submit } = usePreviewSubmit(
    'استعادة كلمة المرور تحتاج خدمة بريد ومزود مصادقة حقيقيين. لم يتم إرسال رسالة.',
  );
  useDocumentMetadata({
    title: 'نسيت كلمة المرور — Englishine',
    description: 'طلب استعادة كلمة مرور حساب Englishine.',
    openGraph: [],
    structuredData: [],
  });
  return (
    <AuthCard
      eyebrow="استعادة الحساب"
      title="نسيت كلمة المرور؟"
      description="اكتب بريدك، وبعد ربط خدمة المصادقة هنقدر نبعت لك رابط استعادة آمن."
      footer={<BackToLogin />}
    >
      <form className="auth-fields" onSubmit={submit} noValidate>
        <AuthField
          id="recovery-email"
          label="البريد الإلكتروني"
          type="email"
          autoComplete="email"
        />
        <AuthSubmit>طلب رابط الاستعادة</AuthSubmit>
        <AuthStatus message={status} />
      </form>
    </AuthCard>
  );
}
