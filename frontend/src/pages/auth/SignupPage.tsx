import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  AuthCard,
  AuthField,
  AuthStatus,
  AuthSubmit,
} from '@/components/auth/AuthCard';
import { useDocumentMetadata } from '@/hooks/useDocumentMetadata';
import { usePreviewSubmit } from '@/hooks/usePreviewSubmit';
import { apiRequest } from '@/services/api';
import type { StageOption } from '@/services/student-platform';

export function Component() {
  const { status, submit, isSubmitting, hasError } = usePreviewSubmit('');
  const [stages, setStages] = useState<StageOption[]>([]);
  useDocumentMetadata({
    title: 'إنشاء حساب — Englishine',
    description: 'إنشاء حساب طالب جديد في Englishine.',
    openGraph: [],
    structuredData: [],
  });
  useEffect(() => {
    void apiRequest<{ data: StageOption[] }>('/catalog/grades').then((payload) => setStages(payload.data));
  }, []);
  return (
    <AuthCard
      eyebrow="ابدأ مع Englishine"
      title="أنشئ حساب الطالب"
      description="الاسم ورقم الطالب ورقم ولي الأمر والصف مطلوبة. البريد الإلكتروني اختياري."
      footer={
        <p>
          عندك حساب بالفعل؟ <Link to="/login/">سجل دخول</Link>
        </p>
      }
    >
      <form className="auth-fields" onSubmit={submit} noValidate>
        <AuthField id="student-name" label="اسم الطالب" autoComplete="name" />
        <AuthField id="student-phone" label="رقم هاتف الطالب" type="tel" autoComplete="tel" />
        <AuthField id="guardian-phone" label="رقم ولي الأمر" type="tel" autoComplete="tel" />
        <AuthField
          id="signup-email"
          label="البريد الإلكتروني (اختياري)"
          type="email"
          autoComplete="email"
          required={false}
        />
        <div className="auth-field">
          <label htmlFor="grade-id">الصف الدراسي</label>
          <select id="grade-id" name="grade-id" required>
            <option value="">اختر الصف</option>
            {stages.map((stage) => (
              <optgroup key={stage.id} label={stage.nameAr}>
                {stage.grades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.nameAr}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
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
