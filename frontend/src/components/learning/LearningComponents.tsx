import type { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router';
import { assets } from '@/assets/registry';
import { AppIcon } from '@/components/icons/AppIcon';
import { useSession } from '@/hooks/useSession';
import type {
  LearningChapter,
  LearningCourse,
  LearningLesson,
} from '@/features/learning/learningData';
import {
  playbackSpeeds,
  qualityOptions,
  videoSections,
} from '@/features/learning/learningData';

export function ProgressBar({
  value,
  label = 'نسبة التقدم',
}: {
  value: number;
  label?: string;
}) {
  const safe = Math.min(100, Math.max(0, value));
  return (
    <div className="learning-progress">
      <div>
        <span>{label}</span>
        <strong>{safe}%</strong>
      </div>
      <progress value={safe} max="100" aria-label={`${label}: ${safe}%`} />
    </div>
  );
}

export function CourseCard({
  course,
  progress = 0,
}: {
  course: LearningCourse;
  progress?: number;
}) {
  return (
    <article className="learning-course-card">
      <div className="learning-course-cover">
        <img src={assets.unitOne} alt="" loading="lazy" />
        <span>مسار معاينة</span>
      </div>
      <div className="learning-course-body">
        <div className="learning-tags">
          <span>{course.stage}</span>
          <span>{course.term}</span>
        </div>
        <h2>{course.title}</h2>
        <p>{course.description}</p>
        <ProgressBar value={progress} />
        <Link
          className="student-primary-action"
          to={`/student/courses/${course.id}/`}
        >
          عرض تفاصيل الكورس
        </Link>
      </div>
    </article>
  );
}

export function ContinueLearningCard({
  lesson,
  progress = 0,
}: {
  lesson: LearningLesson;
  progress?: number;
}) {
  return (
    <article className="learning-continue-card">
      <span className="student-icon">
        <AppIcon name="play" />
      </span>
      <div>
        <small>الخطوة التالية في مسار المعاينة</small>
        <h2>{lesson.title}</h2>
        <p>{lesson.description}</p>
        <ProgressBar value={progress} />
      </div>
      <Link className="student-primary-action" to={`/lesson/${lesson.id}/`}>
        افتح الدرس
      </Link>
    </article>
  );
}

export function LessonCard({
  lesson,
  index,
  progress = 0,
}: {
  lesson: LearningLesson;
  index: number;
  progress?: number;
}) {
  const coming = lesson.status === 'coming';
  return (
    <article className="learning-lesson-card" data-status={lesson.status}>
      <span className="lesson-number">
        {String(index + 1).padStart(2, '0')}
      </span>
      <div>
        <div className="learning-tags">
          <span>{coming ? 'قريبًا' : 'متاح للمعاينة'}</span>
        </div>
        <h3>{lesson.title}</h3>
        <p>{lesson.description}</p>
        {coming ? null : <ProgressBar value={progress} label="تقدم الدرس" />}
      </div>
      {coming ? (
        <button type="button" disabled>
          المحتوى قيد التجهيز
        </button>
      ) : (
        <Link className="student-secondary-action" to={`/lesson/${lesson.id}/`}>
          ابدأ الدرس
        </Link>
      )}
    </article>
  );
}

export function ChapterAccordion({
  chapter,
  progressByLesson,
}: {
  chapter: LearningChapter;
  progressByLesson: Record<string, number>;
}) {
  const available = chapter.status === 'available';
  return (
    <details className="chapter-accordion" open={available}>
      <summary>
        <span>
          <small>{available ? 'وحدة متاحة' : 'قريبًا'}</small>
          <strong>{chapter.title}</strong>
          <em>{chapter.subtitle}</em>
        </span>
        <span>
          {chapter.lessons.length
            ? `${chapter.lessons.length} دروس`
            : 'لم يُضف محتوى'}
        </span>
      </summary>
      {chapter.lessons.length ? (
        <div className="chapter-lessons">
          {chapter.lessons.map((lesson, index) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              index={index}
              progress={progressByLesson[lesson.id] ?? 0}
            />
          ))}
        </div>
      ) : (
        <LearningEmptyState
          title="الوحدة قيد التجهيز"
          description="ستظهر الدروس هنا عند إضافة المحتوى المعتمد."
        />
      )}
    </details>
  );
}

export function VideoPlayerLayout({
  lesson,
  progress,
  onProgressChange,
}: {
  lesson: LearningLesson;
  progress: number;
  onProgressChange: (value: number) => void;
}) {
  const session = useSession();
  return (
    <section className="video-player-layout" aria-label="مشغل الدرس">
      <div className="learning-video-frame">
        <div className="learning-watermark">
          <span>
            حساب الطالب: {session.user?.displayName ?? 'جارٍ تحميل الحساب'}
          </span>
          <span>جلسة موثقة</span>
        </div>
        <div className="learning-video-placeholder">
          <button type="button" aria-label="تشغيل الفيديو" disabled>
            <AppIcon name="play" />
          </button>
          <h2>{lesson.title}</h2>
          <p>مصدر الفيديو غير مربوط حاليًا.</p>
        </div>
      </div>
      <div className="learning-player-controls">
        <label>
          سرعة التشغيل
          <select defaultValue="1x" aria-label="سرعة التشغيل">
            {playbackSpeeds.map((speed) => (
              <option key={speed}>{speed}</option>
            ))}
          </select>
        </label>
        <label>
          الجودة
          <select defaultValue="Auto" aria-label="جودة الفيديو">
            {qualityOptions.map((quality) => (
              <option key={quality}>{quality}</option>
            ))}
          </select>
        </label>
        <label className="learning-player-progress">
          موضع المعاينة
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={(event) => onProgressChange(Number(event.target.value))}
          />
        </label>
      </div>
      <p className="learning-boundary-note">
        اختيار الجودة جاهز للربط، لكنه يحتاج مصادر HLS/DASH أو ملفات محوّلة
        فعلية. التقدم محفوظ محليًا على هذا الجهاز فقط.
      </p>
      <div className="video-sections" aria-label="أجزاء الشرح">
        {videoSections.map((section) => (
          <button
            type="button"
            key={section.id}
            onClick={() =>
              onProgressChange(Math.min(95, Math.round(section.time / 22)))
            }
          >
            <span lang="en" dir="ltr">
              {section.label}
            </span>
            <small>
              {Math.floor(section.time / 60)}:
              {String(section.time % 60).padStart(2, '0')}
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}

export function LessonSidebar({
  lessonId,
  active,
}: {
  lessonId: string;
  active: 'lesson' | 'resources' | 'notes' | 'homework';
}) {
  const links = [
    {
      key: 'lesson',
      label: 'الشرح والفيديو',
      href: `/lesson/${lessonId}/`,
      icon: 'play' as const,
    },
    {
      key: 'resources',
      label: 'الملفات',
      href: `/lesson/${lessonId}/resources/`,
      icon: 'assignments' as const,
    },
    {
      key: 'notes',
      label: 'ملاحظاتي',
      href: `/lesson/${lessonId}/notes/`,
      icon: 'homework' as const,
    },
    {
      key: 'homework',
      label: 'الواجب',
      href: `/lesson/${lessonId}/homework/`,
      icon: 'exams' as const,
    },
  ];
  return (
    <aside className="lesson-sidebar">
      <p>مكونات الدرس</p>
      <nav aria-label="مكونات الدرس">
        {links.map((item) => (
          <Link
            key={item.key}
            to={item.href}
            aria-current={active === item.key ? 'page' : undefined}
          >
            <AppIcon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export function ResourceCard({
  title,
  description,
  available = false,
}: {
  title: string;
  description: string;
  available?: boolean;
}) {
  return (
    <article className="resource-card">
      <span className="student-icon">
        <AppIcon name="assignments" />
      </span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <button type="button" disabled={!available}>
        {available ? 'تحميل الملف' : 'غير متاح حاليًا'}
      </button>
    </article>
  );
}

export function HomeworkCard({
  status,
  onSubmit,
}: {
  status: 'not-opened' | 'in-progress' | 'submitted';
  onSubmit: (answer: string) => void;
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const answer = String(
      new FormData(event.currentTarget).get('homework-answer') ?? '',
    ).trim();
    if (answer) onSubmit(answer);
  };
  return (
    <article className="lesson-homework-card">
      <header>
        <div>
          <small>حالة الواجب</small>
          <h2>تطبيق Lesson 1.2</h2>
        </div>
        <span data-status={status}>
          {status === 'submitted'
            ? 'تم التسليم محليًا'
            : status === 'in-progress'
              ? 'قيد الحل'
              : 'لم يبدأ'}
        </span>
      </header>
      <p>
        اكتب إجابتك أو اختر ملفًا. لا يوجد رفع أو تصحيح فعلي قبل ربط قاعدة
        البيانات.
      </p>
      <form onSubmit={submit}>
        <label htmlFor="homework-answer">إجابتك</label>
        <textarea id="homework-answer" name="homework-answer" required />
        <label htmlFor="homework-file">ملف الإجابة — واجهة فقط</label>
        <input id="homework-file" type="file" />
        <button className="student-primary-action" type="submit">
          حفظ التسليم محليًا
        </button>
      </form>
    </article>
  );
}

export function LearningEmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="learning-empty">
      <span>
        <AppIcon name="courses" />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}

export function LearningLoadingSkeleton() {
  return (
    <div
      className="learning-skeleton"
      role="status"
      aria-label="جارٍ تحميل محتوى التعلم"
    >
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}
