import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  AssessmentFlow,
  type AssessmentAnswer,
  HomeworkItem,
  LessonSequence,
  MaterialRow,
  NextAction,
  StudentProgressBar,
  Roadmap,
  StudentCourseCard,
  StudentEmptyState,
  StudentLoading,
  StudentStatusBadge,
  StudentUnitCard,
} from '@/components/student/StudentExperience';
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
  type RoadmapUnit,
  type StudentHomeworkDetail,
  type StudentExamSession,
  type StudentExamResult,
  type HomeworkAnswerInput,
  type ExamAnswerInput,
} from '@/services/student-platform';
import { LessonVideoPlayer } from '@/components/media/LessonVideoPlayer';
import { mediaUrl } from '@/services/api';
import { useSession } from '@/hooks/useSession';
import { deriveNextAction } from '@/features/student/student-learning';
import { LessonLearningContext } from '@/components/student/LessonLearningContext';

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
  emptyTitle = 'لا يوجد محتوى منشور لهذا القسم بعد',
  emptyDescription = 'يمكنك الرجوع لاحقًا أو متابعة المحتوى المفعّل في كورساتك.',
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (loading) {
    return (
      <div className="learning-skeleton" aria-label="جاري تحميل المحتوى">
        <span />
        <span />
      </div>
    );
  }
  if (error) return <div role="alert"><StudentEmptyState title="تعذر تحميل المحتوى" description={error} /></div>;
  if (empty) return <StudentEmptyState title={emptyTitle} description={emptyDescription} />;
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
  const loading = state.loading;
  const empty = !state.items.length;
  return (
    <div className="sx-page">
      <PageHeader eyebrow="مساحة التعلّم" title="كورساتي" description="الكورسات والوحدات التي تم تفعيلها لحسابك، مع التقدم المحفوظ." />
      <DataState loading={loading} error={state.error} empty={empty} emptyTitle="لم تفعّل كورسًا أو وحدة أو درسًا بعد" emptyDescription="استكشف الكورسات المناسبة لصفك، أو فعّل كود المحتوى من صفحة التفعيل." />
      {state.items.length ? <div className="sx-course-grid">{state.items.map((item) => <StudentCourseCard key={item.course.id} enrollment={item} />)}</div> : null}
    </div>
  );
}

export function StudentCourseDetailsPage() {
  const { courseId = '' } = useParams();
  const [state, setState] = useState<{ loading: boolean; error: string | null; enrollment: StudentCourseEnrollment | null; roadmap: RoadmapUnit[] }>({ loading: true, error: null, enrollment: null, roadmap: [] });
  useDocumentMetadata({ title: 'محتوى الكورس — Englishine', description: 'الوحدات والدروس المفعّلة لحساب الطالب.', openGraph: [], structuredData: [] });
  useEffect(() => {
    let active = true;
    void Promise.all([studentPlatformApi.myCourse(courseId), studentPlatformApi.roadmap(courseId)]).then(
      ([enrollment, roadmap]) => { if (active) setState({ loading: false, error: null, enrollment, roadmap }); },
      (reason: unknown) => { if (active) setState({ loading: false, error: reason instanceof Error ? reason.message : 'تعذر فتح الكورس.', enrollment: null, roadmap: [] }); },
    );
    return () => { active = false; };
  }, [courseId]);
  if (state.loading) return <StudentLoading />;
  if (state.error || !state.enrollment) return <StudentEmptyState title="لا يمكن فتح الكورس" description={state.error ?? undefined} action={<Link className="sx-button sx-button-secondary" to="/student/courses/">العودة إلى كورساتي</Link>} />;
  const { course } = state.enrollment;
  return (
    <div className="sx-page">
      <nav className="sx-breadcrumb"><Link to="/student/courses/">كورساتي</Link><span>/</span><span>{course.title}</span></nav>
      <header className="sx-course-hero">
        <span>{course.grade?.nameAr ?? 'كورس Englishine'}</span>
        <h1>{course.title}</h1>
        {state.enrollment.accessKind === 'ACTIVATION' ? <p>الوصول هنا للوحدات أو الدروس التي فعّلتها فقط، وليس للكورس كاملًا.</p> : null}
        {course.shortDescription ? <p>{course.shortDescription}</p> : null}
      </header>
      {course.units.length ? <div className="sx-unit-grid">{course.units.map((unit) => <StudentUnitCard key={unit.id} courseId={course.id} unit={unit} roadmap={state.roadmap.find((item) => item.unitId === unit.id)} />)}</div> : <StudentEmptyState title="لا توجد وحدات منشورة في هذا الكورس" />}
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
      <DataState {...state} empty={!state.items.length} emptyTitle="لا توجد كورسات منشورة لصفك الآن" emptyDescription="ستظهر الكورسات المناسبة لصفك عند نشرها." />
      {state.items.length ? (
        <div className="learning-course-grid">
          {state.items.map((course) => {
            const enrolled = course.enrollments.length > 0;
            return (
              <article className="learning-course-card student-catalog-card" key={course.id}>
                <div className="learning-course-cover">{course.units?.find((unit) => unit.coverAssetId) ? <img src={mediaUrl(`/media/covers/unit/${course.units.find((unit) => unit.coverAssetId)!.id}`)} alt={`غلاف وحدة من ${course.title}`} loading="lazy" /> : <AppIcon name="courses" />}</div>
                <div className="learning-course-body">
                  <span className="student-kicker">{course.grade?.nameAr ?? 'مسار تعليمي'}</span>
                  <h2 dir="auto">{course.title}</h2>
                  <p>{course.shortDescription ?? 'تفاصيل الكورس ستظهر عند اكتمال إعدادها.'}</p>
                  <div className="learning-tags">
                    <span>{course.teachers[0]?.teacher.fullName ?? 'Englishine'}</span>
                    <span>{enrolled ? 'مفعّل' : 'غير مفعّل'}</span>
                  </div>
                  {enrolled ? (
                    <Link className="student-primary-action" to={`/student/courses/${course.id}/`}>فتح الكورس</Link>
                  ) : (
                    <Link className="student-secondary-action" to="/account/activation/">فعّل الكود</Link>
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
      <DataState {...state} empty={!state.items.length} emptyTitle="لا يوجد محتوى مجاني منشور لصفك الآن" emptyDescription="ستجد هنا الدروس والعينات المجانية عندما يتيحها المدرّس." />
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



export function StudentHomeworkPage() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted'>('all');
  useDocumentMetadata({ title: 'الواجبات — Englishine', description: 'واجبات الكورسات المفعّلة وحالات التسليم.', openGraph: [], structuredData: [] });
  const state = useCollection<StudentHomework>(studentPlatformApi.homework);
  const visible = state.items.filter((item) => filter === 'all' || (filter === 'submitted' ? item.submissions.length > 0 : item.submissions.length === 0));
  return (
    <div className="sx-page">
      <PageHeader eyebrow="متابعة التعلّم" title="الواجبات" description="حل واجبات الدروس وتابع حالة التسليم والمراجعة." />
      <div className="sx-filter-tabs" aria-label="تصفية الواجبات">
        {([['all', 'الكل'], ['pending', 'مطلوب'], ['submitted', 'تم التسليم']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
      </div>
      <DataState {...state} empty={!state.items.length} emptyTitle="لا توجد واجبات متاحة لحسابك الآن" emptyDescription="ستظهر واجبات الدروس المفعّلة هنا عند نشرها." />
      {!state.loading && !state.error && state.items.length && !visible.length ? <StudentEmptyState icon="homework" title="لا توجد واجبات في هذه الحالة" /> : null}
      {visible.length ? <div className="sx-homework-list">{visible.map((item) => <HomeworkItem key={item.id} homework={item} />)}</div> : null}
    </div>
  );
}

export function StudentExamsPage() {
  useDocumentMetadata({ title: 'الاختبارات — Englishine', description: 'اختبارات الكورسات المفعّلة والنتائج.', openGraph: [], structuredData: [] });
  const state = useCollection<StudentExam>(studentPlatformApi.exams);
  return (
    <div className="sx-page">
      <PageHeader eyebrow="قياس التقدم" title="الاختبارات" description="ابدأ الاختبارات المنشورة وتابع نتائج محاولاتك الحقيقية." />
      <DataState {...state} empty={!state.items.length} emptyTitle="لا توجد اختبارات متاحة لحسابك الآن" emptyDescription="ستظهر الاختبارات المنشورة المرتبطة بالمحتوى المفعّل هنا." />
      {state.items.length ? <div className="sx-test-list">
        {state.items.map((exam) => {
          const latest = exam.attempts[0];
          const exhausted = exam.attempts.length >= exam.maxAttempts;
          return <article key={exam.id}>
            <span className="sx-homework-icon"><AppIcon name="exams" /></span>
            <div><small>{exam.course.title}</small><h2>{exam.title}</h2><p>{exam.durationMinutes ? `${exam.durationMinutes} دقيقة` : 'بدون مدة محددة'} · {exam.attempts.length} من {exam.maxAttempts} محاولات</p></div>
            <StudentStatusBadge state={latest?.result?.passed === true ? 'PASSED' : latest?.result?.passed === false ? exhausted ? 'ATTEMPTS_EXHAUSTED' : 'FAILED' : latest?.result && !latest.result.publishedAt ? 'PENDING_REVIEW' : latest?.result ? 'GRADED' : latest ? 'IN_PROGRESS' : 'AVAILABLE'} />
            {latest?.result?.publishedAt ? <strong className="sx-score">{String(latest.result.percentage)}%</strong> : null}
            <Link className="sx-button sx-button-secondary" to={`/student/exams/${exam.id}/`}>{latest?.result && exhausted ? 'عرض النتيجة' : 'فتح الاختبار'}</Link>
          </article>;
        })}
      </div> : null}
    </div>
  );
}

function StudentProgressCourse({ item }: { item: StudentCourseProgress }) {
  const [course, setCourse] = useState<StudentCourseEnrollment | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void studentPlatformApi.myCourse(item.course.id).then(
      (value) => { if (active) setCourse(value); },
      (reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'تعذر تحميل تفاصيل الكورس.'); },
    );
    return () => { active = false; };
  }, [item.course.id]);
  if (error) return <StudentEmptyState title={item.course.title} description={error} />;
  if (!course) return <StudentLoading label={`جارٍ تحميل ${item.course.title}`} />;
  const action = deriveNextAction(course, item.units, [], []);
  return <section className="sx-page"><header className="sx-course-hero"><span>{course.course.grade?.nameAr ?? 'مسار التقدم'}</span><h2>{item.course.title}</h2></header>{action && !item.units.every((unit) => unit.state === 'COMPLETED') ? <NextAction action={action} /> : null}<Roadmap courseId={item.course.id} units={item.units} courseUnits={course.course.units} /></section>;
}

export function StudentProgressPage() {
  useDocumentMetadata({ title: 'التقدم — Englishine', description: 'خريطة التقدم الفعلية في الكورسات المفعّلة.', openGraph: [], structuredData: [] });
  const state = useCollection<StudentCourseProgress>(studentPlatformApi.progress);
  return (
    <div className="sx-page">
      <PageHeader eyebrow="خطواتك التعليمية" title="التقدم والنتائج" description="المسار المحفوظ لكل كورس، والمتطلبات الحالية قبل الانتقال للخطوة التالية." />
      <DataState {...state} empty={!state.items.length} emptyTitle="لم يبدأ مسار التقدم بعد" emptyDescription="سيظهر تقدمك بعد تفعيل المحتوى والبدء في التعلّم." />
      {state.items.map((item) => <StudentProgressCourse key={item.course.id} item={item} />)}
    </div>
  );
}

function StudentProfileForm({
  profile,
  email,
  save,
}: {
  profile: import('@/services/student-platform').StudentProfile;
  email: string;
  save: (input: { fullName?: string; studentPhone?: string; guardianPhone?: string; email?: string | null }) => Promise<import('@/services/student-platform').StudentProfile>;
}) {
  const [form, setForm] = useState({ fullName: profile.fullName, studentPhone: profile.studentPhone ?? '', guardianPhone: profile.parentPhone ?? '', email });
  const [state, setState] = useState({ busy: false, error: null as string | null, success: false });
  async function submit(event: FormEvent) {
    event.preventDefault();
    setState({ busy: true, error: null, success: false });
    try {
      await save({ fullName: form.fullName, studentPhone: form.studentPhone, guardianPhone: form.guardianPhone, email: form.email || null });
      setState({ busy: false, error: null, success: true });
    } catch (reason) {
      setState({ busy: false, error: reason instanceof Error ? reason.message : 'تعذر حفظ البيانات.', success: false });
    }
  }
  return (
    <section className="sx-profile">
      <div className="sx-profile-summary"><span className="student-avatar-fallback">{profile.fullName.slice(0, 1)}</span><div><strong>{profile.fullName}</strong><small>{profile.grade?.nameAr ?? 'الصف غير محدد'}</small></div></div>
      <form onSubmit={submit}>
        <label>الاسم الكامل<input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} required /></label>
        <label>رقم الطالب<input dir="ltr" value={form.studentPhone} onChange={(event) => setForm((current) => ({ ...current, studentPhone: event.target.value }))} required /></label>
        <label>رقم ولي الأمر<input dir="ltr" value={form.guardianPhone} onChange={(event) => setForm((current) => ({ ...current, guardianPhone: event.target.value }))} required /></label>
        <label>البريد الإلكتروني<input dir="ltr" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
        <label>الصف الدراسي<input value={profile.grade?.nameAr ?? 'غير محدد'} readOnly aria-describedby="grade-help" /></label>
        <small id="grade-help">يتم تعديل الصف الدراسي من الإدارة فقط لحماية مسار المحتوى.</small>
        {state.error ? <p className="sx-form-error" role="alert">{state.error}</p> : null}
        {state.success ? <p className="sx-form-success" role="status">تم حفظ البيانات.</p> : null}
        <button className="sx-button sx-button-primary" type="submit" disabled={state.busy}>{state.busy ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}</button>
      </form>
    </section>
  );
}

export function StudentAccountPage() {
  const session = useSession();
  const { profile, updateProfile } = useStudentPlatform();
  useDocumentMetadata({ title: 'حسابي — Englishine', description: 'بيانات حساب الطالب والصف الدراسي.', openGraph: [], structuredData: [] });
  const email = profile?.user ? profile.user.email ?? '' : session.status === 'authenticated' ? session.user.email ?? '' : '';
  return (
    <div className="sx-page">
      <PageHeader eyebrow="حساب الطالب" title="بياناتي التعليمية" description="حدّث بيانات التواصل. الصف الدراسي معروض للمتابعة ويُعدّل من الإدارة فقط." />
      {profile ? <StudentProfileForm key={profile.id} profile={profile} email={email} save={updateProfile} /> : <StudentLoading />}
    </div>
  );
}

function ProtectedVideo({ path, title, videoId }: { path: string; title: string; videoId: string }) {
  return <LessonVideoPlayer src={mediaUrl(path)} title={title} videoId={videoId} />;
}



export function StudentLessonAccessPage() {
  const { lessonId = '' } = useParams();
  const [state, setState] = useState<{ loading: boolean; error: string | null; lesson: StudentLesson | null }>({ loading: true, error: null, lesson: null });
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void studentPlatformApi.lesson(lessonId).then(
      (lesson) => { if (active) { setState({ loading: false, error: null, lesson }); setSelectedVideoId(lesson.videos[0]?.id ?? null); } },
      (reason: unknown) => { if (active) setState({ loading: false, error: reason instanceof Error ? reason.message : 'تعذر فتح الدرس.', lesson: null }); },
    );
    return () => { active = false; };
  }, [lessonId]);
  const lessonData = state.lesson;
  const selectedVideo = lessonData?.videos.find((video) => video.id === selectedVideoId) ?? lessonData?.videos[0];
  useDocumentMetadata({ title: `${lessonData?.title ?? 'الدرس'} — Englishine`, description: lessonData?.description ?? 'درس Englishine.', openGraph: [], structuredData: [] });
  if (state.loading) return <StudentLoading />;
  if (state.error || !lessonData) return <StudentEmptyState title="لا يمكن فتح هذا المحتوى" description={state.error ?? undefined} action={<Link className="sx-button sx-button-secondary" to="/student/explore/">استكشف الكورسات</Link>} />;
  return (
    <div className="sx-page student-lesson-page">
      <nav className="sx-breadcrumb" aria-label="مسار الدرس"><Link to="/student/courses/">كورساتي</Link><span>/</span><Link to={`/student/courses/${lessonData.unit.course.id}/`}>{lessonData.unit.course.title}</Link><span>/</span><span>{lessonData.unit.title}</span></nav>
      <header className="student-lesson-hero"><span className="sx-eyebrow">{lessonData.unit.title}</span><h1>{lessonData.title}</h1>{lessonData.description ? <p>{lessonData.description}</p> : null}</header>
      {lessonData.videos.length > 1 ? <div className="sx-video-selector" role="tablist" aria-label="فيديوهات الدرس">{lessonData.videos.map((video) => <button key={video.id} type="button" role="tab" aria-selected={selectedVideo?.id === video.id} onClick={() => setSelectedVideoId(video.id)}>{video.title}</button>)}</div> : null}
      {selectedVideo ? <section className="student-lesson-player" aria-labelledby={`video-${selectedVideo.id}`}><h2 id={`video-${selectedVideo.id}`}>{selectedVideo.title}</h2><ProtectedVideo path={selectedVideo.streamPath} title={selectedVideo.title} videoId={selectedVideo.id} /></section> : <StudentEmptyState title="لا يوجد فيديو منشور في هذا الدرس بعد" />}
      {lessonData.resources.length ? <section className="student-lesson-materials"><h2>ملفات الدرس</h2><div className="sx-material-list">{lessonData.resources.map((resource) => <MaterialRow key={resource.id} {...resource} />)}</div></section> : null}
      <LessonLearningContext key={lessonData.id} courseId={lessonData.unit.course.id} lessonId={lessonData.id} title={lessonData.title} />
      <p className="student-lesson-back"><Link className="sx-button sx-button-secondary" to={`/student/courses/${lessonData.unit.course.id}/`}>العودة إلى الكورس</Link></p>
    </div>
  );
}

export function StudentUnitDetailsPage() {
  const { courseId = '', unitId = '' } = useParams();
  const [state, setState] = useState<{ loading: boolean; error: string | null; course: StudentCourseEnrollment | null; roadmap: RoadmapUnit[] }>({
    loading: true,
    error: null,
    course: null,
    roadmap: [],
  });
  useEffect(() => {
    let active = true;
    void Promise.all([
      studentPlatformApi.myCourse(courseId),
      studentPlatformApi.roadmap(courseId),
    ]).then(
      ([course, roadmap]) => { if (active) setState({ loading: false, error: null, course, roadmap }); },
      (reason: unknown) => { if (active) setState({ loading: false, error: reason instanceof Error ? reason.message : 'تعذر فتح الوحدة.', course: null, roadmap: [] }); },
    );
    return () => { active = false; };
  }, [courseId]);
  const unit = state.course?.course.units.find((entry) => entry.id === unitId);
  const roadmap = state.roadmap.find((entry) => entry.unitId === unitId);
  useDocumentMetadata({ title: `${unit?.title ?? 'الوحدة'} — Englishine`, description: unit?.description ?? 'دروس الوحدة.', openGraph: [], structuredData: [] });
  if (state.loading) return <StudentLoading />;
  if (state.error || !state.course || !unit) {
    return <StudentEmptyState title="تعذر فتح الوحدة" description={state.error ?? 'هذه الوحدة غير متاحة لحسابك.'} action={<Link className="sx-button sx-button-secondary" to={`/student/courses/${courseId}/`}>العودة إلى الكورس</Link>} />;
  }
  if (!roadmap?.entitled && !roadmap?.contextAccessible) {
    return <StudentEmptyState icon="courses" title="هذه الوحدة تحتاج إلى تفعيل" description="التفعيل خاص بهذه الوحدة أو بالكورس المسجّل عليه حسابك." action={<Link className="sx-button sx-button-primary" to="/student/explore/">عرض طرق التفعيل</Link>} />;
  }
  return (
    <div className="sx-page">
      <nav className="sx-breadcrumb" aria-label="مسار الوحدة">
        <Link to="/student/courses/">كورساتي</Link><span>/</span>
        <Link to={`/student/courses/${courseId}/`}>{state.course.course.title}</Link><span>/</span>
        <span>{unit.title}</span>
      </nav>
      <header className="sx-unit-hero">
        {unit.coverAssetId ? <img className="sx-unit-detail-cover" src={mediaUrl(`/media/covers/unit/${unit.id}`)} alt={`غلاف ${unit.title}`} /> : null}
        <span>الوحدة {unit.position}</span>
        <h1>{unit.title}</h1>
        {unit.description ? <p>{unit.description}</p> : null}
        <StudentStatusBadge state={roadmap.state} />
        <StudentProgressBar value={roadmap.progressPercent} label="تقدم الوحدة" />
      </header>
      {(() => { const action = deriveNextAction(state.course, [roadmap], [], []); return action ? <NextAction action={action} /> : null; })()}
      {unit.lessons.length ? <LessonSequence unit={unit} roadmap={roadmap} /> : <StudentEmptyState title="لا توجد دروس منشورة في هذه الوحدة" />}
    </div>
  );
}

export function StudentHomeworkAssessmentPage() {
  const { homeworkId = '' } = useParams();
  const [detail, setDetail] = useState<StudentHomeworkDetail | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AssessmentAnswer>>({});
  const [state, setState] = useState({ loading: true, submitting: false, error: null as string | null, success: false });
  useEffect(() => {
    let active = true;
    void Promise.all([studentPlatformApi.homeworkDetail(homeworkId), studentPlatformApi.homework()]).then(
      ([value, all]) => {
        if (!active) return;
        setDetail(value);
        void all;
        setState((current) => ({ ...current, loading: false }));
      },
      (reason: unknown) => { if (active) setState((current) => ({ ...current, loading: false, error: reason instanceof Error ? reason.message : 'تعذر فتح الواجب.' })); },
    );
    return () => { active = false; };
  }, [homeworkId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!detail || !attemptId) return;
    const payload: HomeworkAnswerInput[] = detail.questions.map((question) => {
      const answer = answers[question.id] ?? { choiceIds: [], text: '' };
      return {
        questionId: question.id,
        ...(question.type === 'MULTIPLE_CHOICE' ? { selectedChoiceIds: answer.choiceIds } : answer.choiceIds[0] ? { selectedChoiceId: answer.choiceIds[0] } : {}),
        ...(answer.text.trim() ? { textAnswer: answer.text.trim() } : {}),
      };
    });
    setState((current) => ({ ...current, submitting: true, error: null }));
    try {
      await studentPlatformApi.submitHomework(homeworkId, payload, attemptId);
      sessionStorage.removeItem(`englishine-assessment:${attemptId}`);
      setDetail(await studentPlatformApi.homeworkDetail(homeworkId));
      setAttemptId(null);
      setState((current) => ({ ...current, submitting: false, success: true }));
    } catch (reason) {
      setState((current) => ({ ...current, submitting: false, error: reason instanceof Error ? reason.message : 'تعذر تسليم الواجب.' }));
    }
  }

  if (state.loading) return <StudentLoading />;
  if (!detail || state.error && !detail) return <StudentEmptyState icon="homework" title="تعذر فتح الواجب" description={state.error ?? undefined} />;
  const latest = detail.submission;
  const submitted = state.success || Boolean(latest?.submittedAt && (latest.passed !== false || detail.remainingAttempts === 0));
  return (
    <div className="sx-page sx-assessment-page">
      <nav className="sx-breadcrumb"><Link to="/student/homework/">الواجبات</Link><span>/</span><span>{detail.title}</span></nav>
      <header>
        <span className="sx-eyebrow">{detail.lesson.title}</span>
        <h1>{detail.title}</h1>
        {detail.instructions ? <p>{detail.instructions}</p> : null}
      </header>
      {submitted ? (
        <StudentEmptyState icon="homework" title={latest?.passed === true ? 'تم الاجتياز' : latest?.passed === false ? detail.remainingAttempts ? 'لم يتم الاجتياز' : 'نفدت المحاولات المتاحة' : 'تم تسليم إجابتك وهي قيد المراجعة'} description={latest?.percentage != null && latest.reviewStatus === 'REVIEWED' ? `نتيجتك ${latest.percentage}% · المحاولات المتبقية: ${detail.remainingAttempts}` : 'تظهر النتيجة بعد اعتماد المراجعة.'} action={latest?.passed === false && detail.remainingAttempts > 0 ? <button className="sx-button sx-button-primary" onClick={() => { setAnswers({}); setState((current) => ({ ...current, success: false })); }}>حاول مرة أخرى</button> : <Link className="sx-button sx-button-secondary" to="/student/homework/">العودة إلى الواجبات</Link>} />
      ) : detail.questions.length && !attemptId ? <section className="sx-result-card"><p>المحاولات المستخدمة: {detail.attemptsUsed} · الحد: {detail.maxAttempts}</p>{state.error ? <p role="alert">{state.error}</p> : null}<button className="sx-button sx-button-primary" disabled={state.submitting || detail.remainingAttempts === 0 && latest?.status !== 'IN_PROGRESS'} onClick={() => {
        setState((current) => ({ ...current, submitting: true, error: null }));
        void studentPlatformApi.startHomework(homeworkId).then((attempt) => {
          setAttemptId(attempt.id);
          try { setAnswers(JSON.parse(sessionStorage.getItem(`englishine-assessment:${attempt.id}`) ?? '{}') as Record<string, AssessmentAnswer>); } catch { setAnswers({}); }
          setState((current) => ({ ...current, submitting: false }));
        }, (reason: unknown) => setState((current) => ({ ...current, submitting: false, error: reason instanceof Error ? reason.message : 'تعذر بدء المحاولة.' })));
      }}>{latest?.status === 'IN_PROGRESS' ? 'متابعة المحاولة' : 'ابدأ الواجب'}</button></section> : detail.questions.length ? (
        <AssessmentFlow questions={detail.questions} answers={answers} onChange={(id, answer) => { const next = { ...answers, [id]: answer }; setAnswers(next); try { sessionStorage.setItem(`englishine-assessment:${attemptId}`, JSON.stringify(next)); } catch { /* Optional local resume storage. */ } }} onSubmit={submit} busy={state.submitting} error={state.error} allowMultiple />
      ) : <StudentEmptyState icon="homework" title="لا توجد أسئلة منشورة في هذا الواجب" />}
    </div>
  );
}

export function StudentExamAssessmentPage() {
  const { examId = '' } = useParams();
  const [summary, setSummary] = useState<StudentExam | null>(null);
  const [session, setSession] = useState<StudentExamSession | null>(null);
  const [result, setResult] = useState<StudentExamResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, AssessmentAnswer>>({});
  const [state, setState] = useState({ loading: true, busy: false, error: null as string | null });
  useEffect(() => {
    let active = true;
    void studentPlatformApi.exams().then(
      (items) => { if (active) { setSummary(items.find((item) => item.id === examId) ?? null); setState((current) => ({ ...current, loading: false })); } },
      (reason: unknown) => { if (active) setState((current) => ({ ...current, loading: false, error: reason instanceof Error ? reason.message : 'تعذر فتح الاختبار.' })); },
    );
    return () => { active = false; };
  }, [examId]);

  async function start() {
    setState((current) => ({ ...current, busy: true, error: null }));
    try {
      const value = await studentPlatformApi.startExam(examId);
      setSession(value);
      try { setAnswers(JSON.parse(sessionStorage.getItem(`englishine-assessment:${value.attempt.id}`) ?? '{}') as Record<string, AssessmentAnswer>); } catch { setAnswers({}); }
      setState((current) => ({ ...current, busy: false }));
    } catch (reason) {
      setState((current) => ({ ...current, busy: false, error: reason instanceof Error ? reason.message : 'تعذر بدء الاختبار.' }));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    const questions = session.exam.sections.flatMap((section) => section.questions);
    const payload: ExamAnswerInput[] = questions.map((question) => {
      const answer = answers[question.id] ?? { choiceIds: [], text: '' };
      return { questionId: question.id, ...(answer.choiceIds.length ? { choiceIds: answer.choiceIds } : {}), ...(answer.text.trim() ? { textAnswer: answer.text.trim() } : {}) };
    });
    setState((current) => ({ ...current, busy: true, error: null }));
    try {
      setResult(await studentPlatformApi.submitExam(session.attempt.id, payload));
      sessionStorage.removeItem(`englishine-assessment:${session.attempt.id}`);
      setState((current) => ({ ...current, busy: false }));
    } catch (reason) {
      setState((current) => ({ ...current, busy: false, error: reason instanceof Error ? reason.message : 'تعذر تسليم الاختبار.' }));
    }
  }

  if (state.loading) return <StudentLoading />;
  if (!summary) return <StudentEmptyState icon="exams" title="تعذر فتح الاختبار" description={state.error ?? 'هذا الاختبار غير متاح لحسابك.'} />;
  if (result) {
    return <div className="sx-page"><section className="sx-result-card"><span className="sx-eyebrow">{!result.publishedAt ? 'تم تسليم إجابتك وهي قيد المراجعة' : result.passed === null ? 'تم اعتماد النتيجة' : result.passed ? 'تم الاجتياز' : 'لم يتم الاجتياز'}</span><h1>{summary.title}</h1>{result.publishedAt ? <><strong>{String(result.percentage)}%</strong><p>{String(result.score)} من {String(result.maxScore)}</p></> : null}<Link className="sx-button sx-button-primary" to="/student/exams/">العودة إلى الاختبارات</Link></section></div>;
  }
  if (!session) {
    const latest = summary.attempts[0];
    const resumable = summary.attempts.some((attempt) => attempt.status === 'IN_PROGRESS' && (!attempt.expiresAt || new Date(attempt.expiresAt).getTime() > Date.now()));
    return (
      <div className="sx-page sx-test-intro">
        <nav className="sx-breadcrumb"><Link to="/student/exams/">الاختبارات</Link><span>/</span><span>{summary.title}</span></nav>
        <section>
          <span className="sx-eyebrow">{summary.course.title}</span><h1>{summary.title}</h1>
          {summary.instructions ? <p>{summary.instructions}</p> : null}
          <dl><div><dt>المدة</dt><dd>{summary.durationMinutes ? `${summary.durationMinutes} دقيقة` : 'غير محددة'}</dd></div><div><dt>المحاولات</dt><dd>{summary.attempts.length} من {summary.maxAttempts}</dd></div></dl>
          {latest?.result?.publishedAt ? <p>آخر نتيجة: {String(latest.result.percentage)}%</p> : latest?.result ? <p>تم تسليم إجابتك وهي قيد المراجعة</p> : null}
          {state.error ? <p className="sx-form-error" role="alert">{state.error}</p> : null}
          <button className="sx-button sx-button-primary" type="button" onClick={() => void start()} disabled={state.busy || (!resumable && summary.attempts.length >= summary.maxAttempts)}>{state.busy ? 'جارٍ البدء…' : resumable ? 'متابعة المحاولة' : 'ابدأ الاختبار'}</button>
        </section>
      </div>
    );
  }
  return (
    <div className="sx-page sx-assessment-page">
      <header><span className="sx-eyebrow">المحاولة {session.attempt.attemptNo}</span><h1>{session.exam.title}</h1>{session.exam.instructions ? <p>{session.exam.instructions}</p> : null}</header>
      <AssessmentFlow questions={session.exam.sections.flatMap((section) => section.questions)} answers={answers} onChange={(id, answer) => { const next = { ...answers, [id]: answer }; setAnswers(next); try { sessionStorage.setItem(`englishine-assessment:${session.attempt.id}`, JSON.stringify(next)); } catch { /* Optional local resume storage. */ } }} onSubmit={submit} busy={state.busy} error={state.error} allowMultiple />
    </div>
  );
}
