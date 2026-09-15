import { Link, useLocation } from 'react-router';
import { AppIcon } from '@/components/icons/AppIcon';
import type { AppIconName } from '@/components/icons/AppIcon';
import { useDocumentMetadata } from '@/hooks/useDocumentMetadata';

const pages: Record<
  string,
  { title: string; description: string; icon: AppIconName }
> = {
  '/student/courses/': {
    title: 'كورساتي',
    description: 'الكورسات المرتبطة بحسابك هتظهر هنا بعد تفعيل الوصول.',
    icon: 'courses',
  },
  '/student/homework/': {
    title: 'الواجب',
    description: 'الواجبات ومواعيد التسليم هتظهر هنا بعد ربط بيانات الدروس.',
    icon: 'homework',
  },
  '/student/assignments/': {
    title: 'التكليفات',
    description: 'التكليفات الإضافية وحالات التسليم هتظهر هنا.',
    icon: 'assignments',
  },
  '/student/exams/': {
    title: 'الاختبارات',
    description: 'الاختبارات القادمة والنتائج المعتمدة هتظهر هنا.',
    icon: 'exams',
  },
  '/student/certificates/': {
    title: 'الشهادات',
    description: 'شهادات الإنجاز المرتبطة بحسابك هتظهر هنا.',
    icon: 'certificates',
  },
  '/student/progress/': {
    title: 'التقدم',
    description: 'تحليل تقدمك يعتمد على بيانات المشاهدة والتسليم والاختبارات.',
    icon: 'progress',
  },
  '/student/notifications/': {
    title: 'الإشعارات',
    description: 'إعلانات مستر أحمد وتنبيهات مسارك هتظهر هنا.',
    icon: 'notifications',
  },
  '/student/profile/': {
    title: 'الملف الشخصي',
    description: 'بيانات الحساب تحتاج مزود مصادقة وقاعدة بيانات قبل التعديل.',
    icon: 'profile',
  },
  '/student/support/': {
    title: 'الدعم',
    description: 'قناة الدعم تحتاج خدمة رسائل حقيقية قبل استقبال الطلبات.',
    icon: 'support',
  },
};

export function Component() {
  const location = useLocation();
  const page = pages[location.pathname] ?? pages['/student/courses/']!;
  useDocumentMetadata({
    title: `${page.title} — Englishine`,
    description: page.description,
    openGraph: [],
    structuredData: [],
  });
  return (
    <section
      className="student-placeholder"
      aria-labelledby="student-page-title"
    >
      <span className="student-placeholder-icon">
        <AppIcon name={page.icon} />
      </span>
      <span className="student-kicker">مساحة الطالب</span>
      <h1 id="student-page-title">{page.title}</h1>
      <p>{page.description}</p>
      <div className="student-empty">
        <strong>لا توجد بيانات حقيقية متاحة حاليًا</strong>
        <p>الواجهة جاهزة للربط، لكن لن نعرض بيانات تجريبية كأنها تخص الطالب.</p>
      </div>
      <Link className="student-secondary-action" to="/student/">
        ارجع للوحة التعلم
      </Link>
    </section>
  );
}
