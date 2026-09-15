import { useState } from 'react';
import { useStudentPlatform } from '@/hooks/useStudentPlatform';

export function GradeOnboarding({ children }: { children: React.ReactNode }) {
  const { profile, stages, loading, error, updateGrade, reload } =
    useStudentPlatform();
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (loading) {
    return (
      <section className="student-onboarding" aria-live="polite">
        <span className="student-kicker">بنجهّز مساحتك التعليمية</span>
        <h1>لحظة واحدة…</h1>
        <p>بنحمّل مرحلتك والمسارات المناسبة ليك.</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="student-onboarding" role="alert">
        <span className="student-kicker">تعذر تحميل الملف</span>
        <h1>خلّينا نحاول مرة تانية</h1>
        <p>{error}</p>
        <button className="student-primary-action" type="button" onClick={() => void reload()}>
          إعادة المحاولة
        </button>
      </section>
    );
  }

  if (!profile?.grade) {
    return (
      <section className="student-onboarding" aria-labelledby="grade-onboarding-title">
        <span className="student-kicker">خطوة واحدة قبل البداية</span>
        <h1 id="grade-onboarding-title">اختار صفك الدراسي</h1>
        <p>
          هنستخدم الصف علشان نرتّب الكورسات والمحتوى المجاني المناسب ليك من غير زحمة.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!selected) return;
            setSaving(true);
            setSubmitError(null);
            void updateGrade(selected)
              .catch((reason: unknown) => {
                setSubmitError(
                  reason instanceof Error ? reason.message : 'تعذر حفظ الصف الدراسي.',
                );
              })
              .finally(() => setSaving(false));
          }}
        >
          <label htmlFor="student-grade">الصف الدراسي الحالي</label>
          <select
            id="student-grade"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            required
          >
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
          {submitError ? <p className="student-form-error">{submitError}</p> : null}
          <button
            className="student-primary-action"
            type="submit"
            disabled={!selected || saving}
          >
            {saving ? 'جاري الحفظ…' : 'ابدأ التعلّم'}
          </button>
        </form>
      </section>
    );
  }

  return children;
}
