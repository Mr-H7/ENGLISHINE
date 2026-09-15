import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { AppIcon } from '@/components/icons/AppIcon';
import { useDocumentMetadata } from '@/hooks/useDocumentMetadata';
import { useStudentPlatform } from '@/hooks/useStudentPlatform';
import {
  studentPlatformApi,
  type ExploreCourse,
  type FreeContentItem,
  type StudentCourseProgress,
  type StudentExam,
  type StudentHomework,
  type StudentCourseEnrollment,
  type MyCourseEnrollment,
  type StudentLesson,
} from '@/services/student-platform';
import { mediaUrl } from '@/services/api';
import { useSession } from '@/hooks/useSession';

function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="learning-page-header">
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

function DataState({
  loading,
  error,
  empty,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
}) {
  if (loading) {
    return (
      <div className="learning-skeleton" aria-label="جاري تحميل المحتوى">
        <span />
        <span />
      </div>
    );
  }
  if (error) return <div className="student-empty-wide" role="alert"><strong>تعذر تحميل المحتوى</strong><p>{error}</p></div>;
  if (empty) return <div className="student-empty-wide"><AppIcon name="courses" /><strong>لا يوجد محتوى متاح حاليًا</strong><p>سيظهر المحتوى هنا بعد نشره أو تفعيله لحسابك.</p></div>;
  return null;
}

function useCollection<T>(load: () => Promise<T[]>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void load().then(
      (value) => {
        if (active) setItems(value);
      },
      (reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'تعذر تحميل المحتوى.');
      },
    ).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [load]);
  return { items, loading, error };
}

export function MyCoursesConnectedPage() {
  useDocumentMetadata({ title: 'كورساتي — Englishine', description: 'الكورسات المفعّلة لحساب الطالب.', openGraph: [], structuredData: [] });
  const state = useCollection<MyCourseEnrollment>(studentPlatformApi.myCourses);
  return (
    <div className="learning-page">
      <PageHeader eyebrow="مساحة التعلّم" title="كورساتي" description="الكورسات اللي تم تفعيلها لحسابك فقط، مع حالة التقدم والوصول." />
      <DataState {...state} empty={!state.items.length} />
      {state.items.length ? (
        <div className="learning-course-grid">
          {state.items.map((item) => (
            <article className="learning-course-card student-catalog-card" key={item.id}>
              <div className="learning-course-cover"><AppIcon name="courses" /></div>
              <div className="learning-course-body">
                <span className="student-kicker">{item.course.grade?.nameAr ?? 'مسار تعليمي'}</span>
                <h2>{item.course.title}</h2>
                <p>{item.course.shortDescription ?? 'تفاصيل المحتوى تظهر داخل الكورس.'}</p>
                <div className="learning-tags"><span>{item.course._count.units} وحدات</span><span>مفعّل</span></div>
                <Link className="student-primary-action" to={`/student/courses/${item.course.id}/`}>فتح الكورس</Link>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function StudentCourseDetailsPage() {
  const { courseId = '' } = useParams();
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    enrollment: StudentCourseEnrollment | null;
  }>({ loading: true, error: null, enrollment: null });
  useDocumentMetadata({ title: 'محتوى الكورس — Englishine', description: 'الوحدات والدروس المفعّلة لحساب الطالب.', openGraph: [], structuredData: [] });
  useEffect(() => {
    let active = true;
    void studentPlatformApi.myCourse(courseId).then(
      (enrollment) => {
        if (active) setState({ loading: false, error: null, enrollment });
      },
      (reason: unknown) => {
        if (active) setState({ loading: false, error: reason instanceof Error ? reason.message : 'تعذر فتح الكورس.', enrollment: null });
      },
    );
    return () => { active = false; };
  }, [courseId]);
  return (
    <div className="learning-page">
      <PageHeader eyebrow="كورس مفعّل" title={state.enrollment?.course.title ?? 'محتوى الكورس'} description={state.enrollment?.course.shortDescription ?? 'الوحدات والدروس المنشورة والمتاحة لحسابك.'} />
      {state.loading ? <DataState loading error={null} empty={false} /> : null}
      {state.error ? <div className="student-empty-wide" role="alert"><strong>لا يمكن فتح الكورس</strong><p>{state.error}</p><Link className="student-secondary-action" to="/student/courses/">العودة إلى كورساتي</Link></div> : null}
      {state.enrollment ? <div className="learning-chapter-list">
        {state.enrollment.course.units.map((unit) => (
          <section className="learning-course-card student-catalog-card" key={unit.id}>
            <div className="learning-course-body">
              <span className="student-kicker">الوحدة {unit.position}</span>
              <h2>{unit.title}</h2>
              {unit.lessons.length ? <div className="learning-progress-list">
                {unit.lessons.map((lesson) => (
                  <article key={lesson.id}>
                    <div><strong>{lesson.title}</strong><span>{lesson.estimatedMinutes ? `${lesson.estimatedMinutes} دقيقة` : 'درس'}</span></div>
                    <Link className="student-secondary-action" to={`/student/lesson/${lesson.id}/`}>فتح الدرس</Link>
                  </article>
                ))}
              </div> : <p>لا توجد دروس منشورة في هذه الوحدة.</p>}
            </div>
          </section>
        ))}
      </div> : null}
    </div>
  );
}

export function ExploreCoursesPage() {
  const { profile } = useStudentPlatform();
  useDocumentMetadata({ title: 'استكشف الكورسات — Englishine', description: 'كورسات مناسبة للصف الدراسي المختار.', openGraph: [], structuredData: [] });
  const state = useCollection<ExploreCourse>(studentPlatformApi.explore);
  return (
    <div className="learning-page">
      <PageHeader eyebrow={profile?.grade?.nameAr ?? 'حسب صفك الدراسي'} title="استكشف الكورسات" description="نعرض هنا الكورسات المنشورة المناسبة لصفك، من غير كتالوجات غير مرتبطة بمرحلتك." />
      <DataState {...state} empty={!state.items.length} />
      {state.items.length ? (
        <div className="learning-course-grid">
          {state.items.map((course) => {
            const enrolled = course.enrollments.length > 0;
            return (
              <article className="learning-course-card student-catalog-card" key={course.id}>
                <div className="learning-course-cover"><AppIcon name="courses" /></div>
                <div className="learning-course-body">
                  <span className="student-kicker">{course.grade?.nameAr ?? 'مسار تعليمي'}</span>
                  <h2>{course.title}</h2>
                  <p>{course.shortDescription ?? 'تفاصيل الكورس ستظهر عند اكتمال إعدادها.'}</p>
                  <div className="learning-tags">
                    <span>{course.teachers[0]?.teacher.fullName ?? 'Englishine'}</span>
                    <span>{enrolled ? 'مفعّل' : 'غير مفعّل'}</span>
                  </div>
                  {enrolled ? (
                    <Link className="student-primary-action" to={`/student/courses/${course.id}/`}>فتح الكورس</Link>
                  ) : (
                    <Link className="student-secondary-action" to="/contact">اسأل عن التفعيل</Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function FreeContentPage() {
  const { profile } = useStudentPlatform();
  useDocumentMetadata({ title: 'المحتوى المجاني — Englishine', description: 'فيديوهات ودروس مجانية للطلاب المسجلين.', openGraph: [], structuredData: [] });
  const state = useCollection<FreeContentItem>(studentPlatformApi.freeContent);
  return (
    <div className="learning-page">
      <PageHeader eyebrow={profile?.grade?.nameAr ?? 'محتوى للطلاب المسجلين'} title="المحتوى المجاني" description="ريلز تعليمية وفيديوهات وعينات دروس نشرها فريق Englishine مجانًا للطلاب المسجلين." />
      <DataState {...state} empty={!state.items.length} />
      {state.items.length ? (
        <div className="student-free-grid">
          {state.items.map((item) => (
            <article className="student-free-card" key={item.id}>
              <div className="student-free-thumb"><AppIcon name="courses" /><span>{item.contentKind === 'LESSON' ? 'درس مجاني' : item.type === 'FREE_REEL' ? 'ريل تعليمي' : item.accessLevel === 'PREVIEW' ? 'معاينة' : 'فيديو مجاني'}</span></div>
              <div>
                <span className="student-kicker">{item.lesson.unit.course.grade?.nameAr ?? 'محتوى عام'}</span>
                <h2>{item.title}</h2>
                <p>{item.lesson.unit.course.title} · {item.lesson.title}</p>
                <Link className="student-primary-action" to={`/student/lesson/${item.lesson.id}/`}>فتح المحتوى</Link>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    : 'بدون موعد محدد';
}

export function StudentHomeworkPage() {
  useDocumentMetadata({ title: 'الواجبات — Englishine', description: 'واجبات الكورسات المفعّلة وحالات التسليم.', openGraph: [], structuredData: [] });
  const state = useCollection<StudentHomework>(studentPlatformApi.homework);
  return (
    <div className="learning-page">
      <PageHeader eyebrow="الكورسات المفعّلة" title="الواجبات" description="الواجبات المنشورة ضمن المحتوى المفعّل لحسابك فقط." />
      <DataState {...state} empty={!state.items.length} />
      {state.items.length ? <div className="learning-course-grid">
        {state.items.map((homework) => {
          const submission = homework.submissions[0];
          return <article className="learning-course-card student-catalog-card" key={homework.id}>
            <div className="learning-course-body">
              <span className="student-kicker">{homework.lesson.unit.course.title}</span>
              <h2>{homework.title}</h2>
              <p>{homework.lesson.title} · {formatDate(homework.dueAt)}</p>
              <div className="learning-tags"><span>{submission ? 'تم التسليم' : 'لم يُسلّم'}</span>{submission?.score != null ? <span>الدرجة: {String(submission.score)}</span> : null}</div>
            </div>
          </article>;
        })}
      </div> : null}
    </div>
  );
}

export function StudentExamsPage() {
  useDocumentMetadata({ title: 'الاختبارات — Englishine', description: 'اختبارات الكورسات المفعّلة والنتائج.', openGraph: [], structuredData: [] });
  const state = useCollection<StudentExam>(studentPlatformApi.exams);
  return (
    <div className="learning-page">
      <PageHeader eyebrow="الكورسات المفعّلة" title="الاختبارات" description="الاختبارات المنشورة ونتائج محاولاتك ضمن الكورسات المفعّلة." />
      <DataState {...state} empty={!state.items.length} />
      {state.items.length ? <div className="learning-course-grid">
        {state.items.map((exam) => {
          const latest = exam.attempts[0];
          return <article className="learning-course-card student-catalog-card" key={exam.id}>
            <div className="learning-course-body">
              <span className="student-kicker">{exam.course.title}</span>
              <h2>{exam.title}</h2>
              <p>يفتح: {formatDate(exam.opensAt)} · يغلق: {formatDate(exam.closesAt)}</p>
              <div className="learning-tags"><span>{exam.durationMinutes ? `${exam.durationMinutes} دقيقة` : 'بدون مدة'}</span><span>{latest?.result ? `النتيجة: ${String(latest.result.percentage)}%` : latest ? 'محاولة جارية' : 'لم تبدأ'}</span></div>
            </div>
          </article>;
        })}
      </div> : null}
    </div>
  );
}

export function StudentProgressPage() {
  useDocumentMetadata({ title: 'التقدم — Englishine', description: 'تقدم الطالب المحفوظ في الكورسات المفعّلة.', openGraph: [], structuredData: [] });
  const state = useCollection<StudentCourseProgress>(studentPlatformApi.progress);
  return (
    <div className="learning-page">
      <PageHeader eyebrow="بيانات محفوظة" title="التقدم والنتائج" description="ملخص التقدم المسجل في قاعدة البيانات لكل كورس مفعّل." />
      <DataState {...state} empty={!state.items.length} />
      {state.items.length ? <div className="learning-course-grid">
        {state.items.map((item) => {
          const progress = item.courseProgress;
          return <article className="learning-course-card student-catalog-card" key={item.id}>
            <div className="learning-course-body">
              <span className="student-kicker">كورس مفعّل</span>
              <h2>{item.course.title}</h2>
              <p>{progress ? `${progress.completedLessons} من ${progress.totalLessons} دروس مكتملة` : 'لم يبدأ التقدم بعد.'}</p>
              <div className="learning-tags"><span>{progress ? `${String(progress.progressPercent)}%` : '0%'}</span></div>
            </div>
          </article>;
        })}
      </div> : null}
    </div>
  );
}

export function StudentAccountPage() {
  const session = useSession();
  const { profile, stages, updateGrade } = useStudentPlatform();
  const [selected, setSelected] = useState(profile?.grade?.id ?? '');
  const [status, setStatus] = useState<string | null>(null);
  useDocumentMetadata({ title: 'حسابي — Englishine', description: 'بيانات حساب الطالب والصف الدراسي.', openGraph: [], structuredData: [] });
  const email = session.status === 'authenticated' ? session.user.email : '';
  return (
    <div className="learning-page">
      <PageHeader eyebrow="حساب الطالب" title="بياناتي التعليمية" description="حدّث صفك فقط عند الانتقال إلى مرحلة أو صف جديد حتى تظل توصيات المحتوى دقيقة." />
      <section className="student-account-card">
        <div><span>الاسم</span><strong>{profile?.fullName}</strong></div>
        <div><span>البريد</span><strong>{email}</strong></div>
        <div><span>الصف الحالي</span><strong>{profile?.grade?.nameAr ?? 'غير محدد'}</strong></div>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!selected || selected === profile?.grade?.id) return;
          setStatus(null);
          void updateGrade(selected).then(() => setStatus('تم تحديث الصف الدراسي.')).catch((reason: unknown) => setStatus(reason instanceof Error ? reason.message : 'تعذر تحديث الصف.'));
        }}>
          <label htmlFor="account-grade">تحديث الصف الدراسي</label>
          <select id="account-grade" value={selected} onChange={(event) => setSelected(event.target.value)}>
            {stages.map((stage) => (
              <optgroup key={stage.id} label={stage.nameAr}>
                {stage.grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.nameAr}</option>)}
              </optgroup>
            ))}
          </select>
          <p>تغيير الصف يغيّر توصيات الكورسات والمحتوى المجاني، لكنه لا يلغي أي تفعيل قائم.</p>
          <button className="student-primary-action" type="submit" disabled={!selected || selected === profile?.grade?.id}>حفظ الصف</button>
          {status ? <p role="status">{status}</p> : null}
        </form>
      </section>
    </div>
  );
}

function ProtectedVideo({ path, title }: { path: string; title: string }) {
  return (
    <video
      className="student-protected-video"
      controls
      playsInline
      preload="metadata"
      src={mediaUrl(path)}
      title={title}
    />
  );
}

function ProtectedResource({ id, title }: { id: string; title: string }) {
  return (
    <a
      className="student-secondary-action"
      href={mediaUrl(`/media/resources/${id}`)}
      target="_blank"
      rel="noreferrer"
    >
      فتح {title}
    </a>
  );
}

export function StudentLessonAccessPage() {
  const { lessonId = '' } = useParams();
  const [state, setState] = useState<{ loading: boolean; error: string | null; lesson: StudentLesson | null }>({ loading: true, error: null, lesson: null });
  useEffect(() => {
    let active = true;
    void studentPlatformApi.lesson(lessonId).then(
      (lesson) => { if (active) setState({ loading: false, error: null, lesson }); },
      (reason: unknown) => { if (active) setState({ loading: false, error: reason instanceof Error ? reason.message : 'تعذر فتح الدرس.', lesson: null }); },
    );
    return () => { active = false; };
  }, [lessonId]);
  const lesson = state.lesson;
  return (
    <div className="learning-page">
      <PageHeader eyebrow={lesson?.unit.course.title ?? 'محتوى محمي'} title={lesson?.title ?? 'الدرس'} description="يعرض Englishine المحتوى المجاني أو المحتوى المفعّل لحسابك فقط." />
      {state.loading ? <DataState loading error={null} empty={false} /> : null}
      {state.error ? <div className="student-empty-wide" role="alert"><strong>لا يمكن فتح هذا المحتوى</strong><p>{state.error}</p><Link className="student-secondary-action" to="/student/explore/">استكشف الكورسات</Link></div> : null}
      {lesson ? (
        <div className="student-lesson-access">
          <p>{lesson.description ?? lesson.unit.title}</p>
          <div className="learning-tags">
            <span>{lesson.entitled ? 'كورس مفعّل' : 'محتوى مجاني'}</span>
            <span>{lesson.accessLevel === 'FREE' || lesson.accessLevel === 'PREVIEW' ? 'وصول مجاني' : 'محتوى مدفوع'}</span>
          </div>
          {lesson.videos.length ? lesson.videos.map((video) => (
            <section className="student-account-card" key={video.id}>
              <h2>{video.title}</h2>
              <p>{video.type === 'FREE_REEL' ? 'ريل تعليمي' : 'فيديو'}</p>
              <ProtectedVideo path={video.streamPath} title={video.title} />
            </section>
          )) : <p>لا يوجد فيديو منشور في هذا الدرس بعد.</p>}
          {lesson.resources.length ? (
            <section className="student-account-card">
              <h2>المواد</h2>
              {lesson.resources.map((resource) => (
                <ProtectedResource key={resource.id} id={resource.id} title={resource.title} />
              ))}
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
