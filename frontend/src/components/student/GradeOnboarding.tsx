import { useStudentPlatform } from '@/hooks/useStudentPlatform';

export function GradeOnboarding({ children }: { children: React.ReactNode }) {
  const { profile, loading, error, reload } = useStudentPlatform();

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
        <span className="student-kicker">يلزم تحديد الصف من الإدارة</span>
        <h1 id="grade-onboarding-title">صفك الدراسي غير محدد</h1>
        <p>
          لا يمكن للطالب تغيير الصف بنفسه. تواصل مع الإدارة لتعيين الصف الصحيح حتى تظهر الكورسات المناسبة.
        </p>
      </section>
    );
  }

  return children;
}
