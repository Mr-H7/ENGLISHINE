import { useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ChapterAccordion,
  ContinueLearningCard,
  CourseCard,
  HomeworkCard,
  LearningEmptyState,
  LessonSidebar,
  ProgressBar,
  ResourceCard,
  VideoPlayerLayout,
} from '@/components/learning/LearningComponents';
import { previewCourse, getLesson } from '@/features/learning/learningData';
import { useDocumentMetadata } from '@/hooks/useDocumentMetadata';
import { useLearningProgress } from '@/hooks/useLearningProgress';

function useLearningMetadata(title: string, description: string) {
  useDocumentMetadata({
    title: `${title} — Englishine`,
    description,
    openGraph: [],
    structuredData: [],
  });
}
function LearningHeader({
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
function LessonNotFound() {
  return (
    <LearningEmptyState
      title="الدرس غير موجود"
      description="تعذر العثور على هذا الدرس داخل المسار الحالي."
    >
      <Link
        className="student-secondary-action"
        to={`/student/courses/${previewCourse.id}/`}
      >
        العودة إلى الكورس
      </Link>
    </LearningEmptyState>
  );
}

export function MyCoursesPage() {
  useLearningMetadata('كورساتي', 'مساحة الطالب لمتابعة الكورسات والدروس.');
  const { state } = useLearningProgress();
  const lesson = previewCourse.chapters[0]!.lessons[0]!;
  return (
    <div className="learning-page">
      <LearningHeader
        eyebrow="مساحة التعلّم"
        title="كورساتي"
        description="تابع محتوى مرحلتك من الوحدة والدرس حتى الواجب، مع حفظ التقدّم على هذا الجهاز في النسخة الحالية."
      />
      <section className="learning-section" aria-labelledby="continue-title">
        <div className="student-section-heading">
          <div>
            <span>الخطوة التالية</span>
            <h2 id="continue-title">كمّل من حيث توقفت</h2>
          </div>
        </div>
        <ContinueLearningCard
          lesson={lesson}
          progress={state.lessons[lesson.id] ?? 0}
        />
      </section>
      <section className="learning-section" aria-labelledby="courses-title">
        <div className="student-section-heading">
          <div>
            <span>المحتوى المتاح للمعاينة</span>
            <h2 id="courses-title">المسارات التعليمية</h2>
          </div>
        </div>
        <div className="learning-course-grid">
          <CourseCard
            course={previewCourse}
            progress={state.lessons[lesson.id] ?? 0}
          />
        </div>
        <LearningEmptyState
          title="لا توجد اشتراكات مؤكدة حتى الآن"
          description="المسار الظاهر معاينة منظمة للمنصة، ولا يعني وجود اشتراك أو فتح مدفوع."
        >
          <Link className="student-secondary-action" to="/activation/">
            فعّل كودًا إذا كان لديك
          </Link>
        </LearningEmptyState>
      </section>
    </div>
  );
}

export function CourseDetailsPage() {
  useLearningMetadata(
    'تفاصيل الكورس',
    'الوحدات والدروس المتاحة في مسار الصف الأول الإعدادي.',
  );
  const { courseId } = useParams();
  const { state } = useLearningProgress();
  if (courseId && courseId !== previewCourse.id)
    return (
      <LearningEmptyState
        title="المسار غير متاح"
        description="لم يتم ربط هذا المسار بالمحتوى بعد."
      >
        <Link className="student-secondary-action" to="/student/courses/">
          العودة إلى كورساتي
        </Link>
      </LearningEmptyState>
    );
  const lessons = previewCourse.chapters
    .flatMap((chapter) => chapter.lessons)
    .filter((lesson) => lesson.status === 'available');
  const average = lessons.length
    ? Math.round(
        lessons.reduce(
          (sum, lesson) => sum + (state.lessons[lesson.id] ?? 0),
          0,
        ) / lessons.length,
      )
    : 0;
  return (
    <div className="learning-page">
      <nav className="learning-breadcrumb" aria-label="مسار التنقل">
        <Link to="/student/courses/">كورساتي</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{previewCourse.title}</span>
      </nav>
      <section className="learning-course-hero">
        <div>
          <span className="student-kicker">{previewCourse.stage}</span>
          <h1>{previewCourse.title}</h1>
          <p>{previewCourse.description}</p>
          <div className="learning-tags">
            <span>{previewCourse.term}</span>
            <span>6 وحدات</span>
            <span>معاينة منظمة</span>
          </div>
        </div>
        <div className="learning-course-progress">
          <strong>{average}%</strong>
          <span>تقدّم محفوظ على هذا الجهاز</span>
          <ProgressBar value={average} label="إجمالي تقدم المسار" />
        </div>
      </section>
      <section className="learning-section" aria-labelledby="chapters-title">
        <div className="student-section-heading">
          <div>
            <span>الوحدات والدروس</span>
            <h2 id="chapters-title">محتوى الكورس</h2>
          </div>
        </div>
        <div className="learning-chapter-list">
          {previewCourse.chapters.map((chapter) => (
            <ChapterAccordion
              key={chapter.id}
              chapter={chapter}
              progressByLesson={state.lessons}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export function LessonPage() {
  const { lessonId = 'lesson-1-2' } = useParams();
  const lesson = getLesson(lessonId);
  const { state, saveLessonProgress } = useLearningProgress();
  useLearningMetadata(lesson.title, lesson.description);
  if (lesson.id !== lessonId) return <LessonNotFound />;
  if (lesson.status === 'coming')
    return (
      <div className="learning-page">
        <LearningHeader
          eyebrow="Unit 1"
          title={`${lesson.title} — قريبًا`}
          description="هذا الدرس ظاهر داخل ترتيب المنهج، لكنه لم يُسجّل بعد ولا يُعرض كمحتوى متاح."
        />
        <LessonSidebar active="lesson" lessonId={lesson.id} />
      </div>
    );
  const progress = state.lessons[lesson.id] ?? 0;
  return (
    <div className="learning-page lesson-workspace">
      <nav className="learning-breadcrumb" aria-label="مسار التنقل">
        <Link to="/student/courses/">كورساتي</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/student/courses/${previewCourse.id}/`}>Unit 1</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{lesson.title}</span>
      </nav>
      <header className="lesson-header">
        <div>
          <span className="student-kicker">
            الصف الأول الإعدادي · الترم الأول · Unit 1
          </span>
          <h1>{lesson.title}</h1>
          <p>{lesson.description}</p>
        </div>
        <div className="lesson-header-progress">
          <ProgressBar value={progress} label="تقدم الدرس" />
        </div>
      </header>
      <div className="lesson-layout">
        <LessonSidebar active="lesson" lessonId={lesson.id} />
        <main className="lesson-main">
          <VideoPlayerLayout
            lesson={lesson}
            progress={progress}
            onProgressChange={(value) => saveLessonProgress(lesson.id, value)}
          />
          <section className="lesson-next-actions">
            <div>
              <span>بعد الشرح</span>
              <h2>كمّل مكونات الدرس بالترتيب</h2>
              <p>راجع الملفات، دوّن ملاحظاتك، ثم أرسل الواجب لفتح حالة الحل.</p>
            </div>
            <div>
              <Link
                className="student-secondary-action"
                to={`/lesson/${lesson.id}/resources/`}
              >
                ملفات الدرس
              </Link>
              <Link
                className="student-primary-action"
                to={`/lesson/${lesson.id}/homework/`}
              >
                فتح الواجب
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export function LessonResourcesPage() {
  const { lessonId = 'lesson-1-2' } = useParams();
  const lesson = getLesson(lessonId);
  useLearningMetadata('ملفات الدرس', 'ملخصات وملفات التدريب المرتبطة بالدرس.');
  if (lesson.id !== lessonId) return <LessonNotFound />;
  return (
    <div className="learning-page lesson-workspace">
      <LearningHeader
        eyebrow={lesson.title}
        title="ملفات الدرس"
        description="مساحة منظمة للملخصات وملفات التدريب عند إضافتها رسميًا."
      />
      <div className="lesson-layout">
        <LessonSidebar active="resources" lessonId={lesson.id} />
        <main className="lesson-main">
          <div className="learning-resource-grid">
            <ResourceCard
              title="ملخص الدرس"
              description="ملف PDF قيد التجهيز."
            />
            <ResourceCard
              title="ورقة التدريب"
              description="تدريبات الدرس ستظهر هنا."
            />
            <ResourceCard
              title="قائمة الكلمات"
              description="ملف تعليمي قيد التجهيز."
            />
          </div>
          <LearningEmptyState
            title="التحميل غير متاح حاليًا"
            description="لا توجد روابط تنزيل وهمية. ستظهر الملفات بعد ربطها بمصدر المحتوى."
          />
        </main>
      </div>
    </div>
  );
}

export function LessonNotesPage() {
  const { lessonId = 'lesson-1-2' } = useParams();
  const lesson = getLesson(lessonId);
  const { state, saveNote } = useLearningProgress();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const note = drafts[lessonId] ?? state.notes[lessonId] ?? '';
  const [saved, setSaved] = useState(false);
  useLearningMetadata('ملاحظات الدرس', 'ملاحظات الطالب الخاصة بالدرس.');
  if (lesson.id !== lessonId) return <LessonNotFound />;
  return (
    <div className="learning-page lesson-workspace">
      <LearningHeader
        eyebrow={lesson.title}
        title="ملاحظات الدرس"
        description="اكتب أهم النقاط بأسلوبك. تُحفظ الملاحظات محليًا على هذا الجهاز فقط."
      />
      <div className="lesson-layout">
        <LessonSidebar active="notes" lessonId={lesson.id} />
        <main className="lesson-main">
          <section className="lesson-note-card">
            <label htmlFor="lesson-note">ملاحظاتك</label>
            <textarea
              id="lesson-note"
              value={note}
              onChange={(event) => {
                setDrafts((current) => ({
                  ...current,
                  [lessonId]: event.target.value,
                }));
                setSaved(false);
              }}
              placeholder="قاعدة مهمة، كلمة جديدة، أو سؤال للمراجعة…"
              rows={12}
            />
            <div>
              <span role="status">
                {saved
                  ? 'تم الحفظ على هذا الجهاز.'
                  : 'لم يتم إرسال أي بيانات للخادم.'}
              </span>
              <button
                className="student-primary-action"
                type="button"
                onClick={() => {
                  saveNote(lesson.id, note);
                  setSaved(true);
                }}
              >
                حفظ الملاحظات
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export function LessonHomeworkPage() {
  const { lessonId = 'lesson-1-2' } = useParams();
  const lesson = getLesson(lessonId);
  const { state, saveHomework } = useLearningProgress();
  useLearningMetadata('واجب الدرس', 'تسليم واجب الدرس ومتابعة حالة الحل.');
  if (lesson.id !== lessonId) return <LessonNotFound />;
  const status = state.homework[lesson.id] ?? 'not-opened';
  return (
    <div className="learning-page lesson-workspace">
      <LearningHeader
        eyebrow={lesson.title}
        title="واجب الدرس"
        description="اكتب إجابتك أو اختر ملفًا، ثم راجع حالة التسليم وحالة فتح الحل."
      />
      <div className="lesson-layout">
        <LessonSidebar active="homework" lessonId={lesson.id} />
        <main className="lesson-main">
          <HomeworkCard
            status={status}
            onSubmit={(answer) => {
              if (answer) saveHomework(lesson.id, 'submitted');
            }}
          />
          <aside
            className={`homework-solution-state ${status === 'submitted' ? 'is-unlocked' : ''}`}
          >
            <strong>
              {status === 'submitted' ? 'تم فتح حالة الحل' : 'حل الواجب مقفول'}
            </strong>
            <p>
              {status === 'submitted'
                ? 'تم تسجيل التسليم محليًا. فيديو الحل يحتاج مصدر فيديو وربطًا بالخادم قبل إتاحته.'
                : 'يجب تسليم الواجب أولًا قبل مشاهدة الحل.'}
            </p>
          </aside>
        </main>
      </div>
    </div>
  );
}

export function HomeworkOverviewPage() {
  useLearningMetadata('الواجبات', 'واجبات الطالب وحالات التسليم.');
  return (
    <div className="learning-page">
      <LearningHeader
        eyebrow="متابعة التطبيق"
        title="الواجبات"
        description="راجع واجبات الدروس المتاحة وحالة التسليم."
      />
      <div className="learning-homework-overview">
        <article>
          <div>
            <span>Unit 1</span>
            <h2>واجب Lesson 1.2</h2>
            <p>تسليم محلي تجريبي حتى ربط خدمة الواجبات.</p>
          </div>
          <Link
            className="student-primary-action"
            to="/lesson/lesson-1-2/homework/"
          >
            فتح الواجب
          </Link>
        </article>
      </div>
    </div>
  );
}

export function LearningProgressPage() {
  const { state } = useLearningProgress();
  useLearningMetadata('تقدّمي', 'ملخص تقدم الطالب في الدروس المتاحة.');
  const lessons = previewCourse.chapters
    .flatMap((chapter) => chapter.lessons)
    .filter((lesson) => lesson.status === 'available');
  const completed = lessons.filter(
    (lesson) => (state.lessons[lesson.id] ?? 0) === 100,
  ).length;
  const average = lessons.length
    ? Math.round(
        lessons.reduce(
          (sum, lesson) => sum + (state.lessons[lesson.id] ?? 0),
          0,
        ) / lessons.length,
      )
    : 0;
  return (
    <div className="learning-page">
      <LearningHeader
        eyebrow="متابعة التعلّم"
        title="تقدّمي"
        description="ملخص واضح لتقدّم الدروس المتاحة. القيم محفوظة على هذا الجهاز وليست تحليلات من خادم."
      />
      <section className="learning-progress-overview">
        <div>
          <span>متوسط التقدّم</span>
          <strong>{average}%</strong>
          <ProgressBar value={average} />
        </div>
        <div>
          <span>الدروس المكتملة</span>
          <strong>{completed}</strong>
          <small>من {lessons.length} دروس متاحة</small>
        </div>
        <div>
          <span>الواجبات المسلّمة</span>
          <strong>
            {
              Object.values(state.homework).filter(
                (value) => value === 'submitted',
              ).length
            }
          </strong>
          <small>حالة محلية تجريبية</small>
        </div>
      </section>
      <section
        className="learning-section"
        aria-labelledby="progress-list-title"
      >
        <div className="student-section-heading">
          <div>
            <span>تفاصيل المسار</span>
            <h2 id="progress-list-title">تقدّم الدروس</h2>
          </div>
        </div>
        <div className="learning-progress-list">
          {lessons.map((lesson) => {
            const value = state.lessons[lesson.id] ?? 0;
            return (
              <article key={lesson.id}>
                <div>
                  <strong>{lesson.title}</strong>
                  <span>Unit 1</span>
                </div>
                <ProgressBar value={value} label={`تقدم ${lesson.title}`} />
                <Link
                  className="student-secondary-action"
                  to={`/lesson/${lesson.id}/`}
                >
                  فتح
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
