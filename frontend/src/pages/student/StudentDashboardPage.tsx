import { Link } from 'react-router';
import { AppIcon } from '@/components/icons/AppIcon';
import type { AppIconName } from '@/components/icons/AppIcon';
import {
  AnnouncementCard,
  ActivityCard,
  ContinueCard,
  ExamCard,
  HomeworkCard,
  ProgressCard,
  QuickActionCard,
} from '@/components/student/DashboardCards';
import { useSession } from '@/hooks/useSession';
import { useDocumentMetadata } from '@/hooks/useDocumentMetadata';
import { useStudentPlatform } from '@/hooks/useStudentPlatform';
import { studentPlatformApi, type MyCourseEnrollment } from '@/services/student-platform';
import { useEffect, useState } from 'react';

const quickActions = [
  {
    href: '/student/courses/',
    icon: 'courses' as const,
    title: 'كورساتي',
    description: 'المحتوى المفعّل لحسابك',
  },
  {
    href: '/student/explore/',
    icon: 'courses' as const,
    title: 'استكشف الكورسات',
    description: 'كورسات صفك الدراسي',
  },
  {
    href: '/student/free/',
    icon: 'courses' as const,
    title: 'محتوى مجاني',
    description: 'ريلز وفيديوهات وعينات',
  },
  {
    href: '/student/homework/',
    icon: 'homework' as const,
    title: 'الواجب',
    description: 'راجع المطلوب منك',
  },
  {
    href: '/student/exams/',
    icon: 'exams' as const,
    title: 'الاختبارات',
    description: 'المواعيد والنتائج',
  },
  {
    href: '/student/progress/',
    icon: 'progress' as const,
    title: 'التقدم',
    description: 'نتائجك المحفوظة',
  },
];

const quickStats: { label: string; icon: AppIconName }[] = [
  { label: 'كورسات مفعّلة', icon: 'courses' },
  { label: 'واجبات متبقية', icon: 'homework' },
  { label: 'اختبارات', icon: 'exams' },
];

export function Component() {
  const session = useSession();
  const { profile } = useStudentPlatform();
  const [courses, setCourses] = useState<MyCourseEnrollment[]>([]);
  useDocumentMetadata({
    title: 'لوحة التعلم — Englishine',
    description: 'مساحة الطالب اليومية لمتابعة التعلم والواجبات والتقدم.',
    openGraph: [],
    structuredData: [],
  });
  useEffect(() => {
    let active = true;
    void studentPlatformApi.myCourses().then(
      (items) => {
        if (active) setCourses(items);
      },
      () => {
        if (active) setCourses([]);
      },
    );
    return () => {
      active = false;
    };
  }, []);
  const studentName =
    session.status === 'authenticated' ? session.user.displayName : null;
  return (
    <div className="student-dashboard">
      <section
        className="student-command-hero"
        aria-labelledby="student-welcome"
      >
        <div className="student-command-copy">
          <span className="student-kicker">مساحة التعلم اليومية</span>
          <h1 id="student-welcome">
            {studentName
              ? `أهلًا يا ${studentName}`
              : 'أهلًا بيك في Englishine'}
          </h1>
          <p>ابدأ من الكورسات المفعّلة أو المحتوى المجاني المناسب لصفك.</p>
          <div className="student-hero-meta">
            <span>الصف: {profile?.grade?.nameAr ?? 'غير محدد'}</span>
            <span>الكورسات المفعّلة: {courses.length}</span>
          </div>
          <div className="student-hero-actions">
            <Link className="student-primary-action" to="/student/courses/">
              كورساتي
            </Link>
            <Link className="student-secondary-action" to="/student/free/">
              المحتوى المجاني
            </Link>
          </div>
        </div>
        <div
          className="student-progress-ring"
          aria-label="عدد الكورسات المفعّلة"
        >
          <span>{courses.length}</span>
          <small>كورسات مفعّلة</small>
        </div>
      </section>

      <section aria-labelledby="quick-stats-title">
        <div className="student-section-heading">
          <div>
            <span>نظرة سريعة</span>
            <h2 id="quick-stats-title">وضعك اليوم</h2>
          </div>
        </div>
        <div className="student-stat-grid">
          {quickStats.map(({ label, icon }) => (
            <article className="student-stat-card" key={label}>
              <span>
                <AppIcon name={icon} />
              </span>
              <strong>{label === 'كورسات مفعّلة' ? courses.length : '—'}</strong>
              <small>{label}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="student-dashboard-grid" aria-label="ملخص التعلم">
        <ContinueCard />
        <HomeworkCard />
        <ExamCard />
        <AnnouncementCard />
      </section>

      <section aria-labelledby="my-courses-title">
        <div className="student-section-heading">
          <div>
            <span>مساراتك</span>
            <h2 id="my-courses-title">كورساتي</h2>
          </div>
          <Link to="/student/courses/">عرض الكل</Link>
        </div>
        {courses.length ? (
          <div className="learning-course-grid">
            {courses.slice(0, 3).map((item) => (
              <article className="learning-course-card student-catalog-card" key={item.id}>
                <div className="learning-course-body">
                  <span className="student-kicker">
                    {item.course.grade?.nameAr ?? 'كورس مفعّل'}
                  </span>
                  <h2>{item.course.title}</h2>
                  <p>
                    {item.course.shortDescription ??
                      'المحتوى المفعّل لحسابك جاهز للمتابعة.'}
                  </p>
                  <Link
                    className="student-primary-action"
                    to={`/student/courses/${item.course.id}/`}
                  >
                    فتح الكورس
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="student-empty-wide">
            <AppIcon name="courses" />
            <strong>لم يتم تفعيل كورسات بعد</strong>
            <p>
              التسجيل لا يفتح الكورسات المدفوعة. يظهر هنا فقط ما يتم تفعيله
              لحسابك، مع محتوى مجاني مناسب لصفك.
            </p>
            <Link className="student-secondary-action" to="/student/explore/">
              استكشف كورسات صفك
            </Link>
          </div>
        )}
      </section>

      <section className="student-insight-grid" aria-label="التقدم">
        <ProgressCard />
        <ActivityCard />
      </section>

      <section aria-labelledby="quick-actions-title">
        <div className="student-section-heading">
          <div>
            <span>اختصارات</span>
            <h2 id="quick-actions-title">وصول سريع</h2>
          </div>
        </div>
        <div className="quick-actions-grid">
          {quickActions.map((action) => (
            <QuickActionCard key={action.href} {...action} />
          ))}
        </div>
      </section>
    </div>
  );
}
