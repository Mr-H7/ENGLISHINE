import { useState } from 'react';
import type { FormEvent } from 'react';
import { AuthCard, AuthStatus, AuthSubmit } from '@/components/auth/AuthCard';
import { useDocumentMetadata } from '@/hooks/useDocumentMetadata';

const stateMessages = {
  success: 'تم قبول الكود في المعاينة فقط. لا يوجد فتح حقيقي للمحتوى.',
  invalid: 'الكود غير صحيح.',
  used: 'تم استخدام الكود من قبل.',
  expired: 'انتهت صلاحية الكود.',
} as const;

export function Component() {
  const [status, setStatus] = useState('');
  useDocumentMetadata({
    title: 'تفعيل كود — Englishine',
    description: 'تفعيل كود الوصول إلى محتوى Englishine.',
    openGraph: [],
    structuredData: [],
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const preview = new FormData(event.currentTarget).get(
      'activation-preview',
    ) as keyof typeof stateMessages;
    setStatus(stateMessages[preview] ?? stateMessages.invalid);
  };
  return (
    <AuthCard
      eyebrow="تفعيل الوصول"
      title="فعّل كود المجموعة"
      description="الكود ممكن يفتح كورس أو وحدة أو درس أو باقة بعد ربط نظام الصلاحيات."
      footer={
        <p>
          الاستخدام والصلاحية وربط الطالب لازم يتم التحقق منهم داخل قاعدة
          البيانات.
        </p>
      }
    >
      <form className="auth-fields" onSubmit={submit} noValidate>
        <div className="auth-field">
          <label htmlFor="activation-code">كود التفعيل</label>
          <div className="auth-input-wrap">
            <input
              id="activation-code"
              name="activation-code"
              dir="ltr"
              placeholder="XXXX-XXXX-XXXX"
              required
            />
          </div>
        </div>
        <div className="auth-field">
          <label htmlFor="activation-preview">معاينة حالة الواجهة فقط</label>
          <select id="activation-preview" name="activation-preview">
            <option value="success">نجاح</option>
            <option value="invalid">غير صحيح</option>
            <option value="used">مستخدم من قبل</option>
            <option value="expired">منتهي</option>
          </select>
        </div>
        <AuthSubmit>فعّل الكود</AuthSubmit>
        <AuthStatus message={status} />
      </form>
    </AuthCard>
  );
}
