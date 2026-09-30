import { useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { Link } from 'react-router';
import { AppIcon } from '@/components/icons/AppIcon';
import { mediaUrl } from '@/services/api';
import { QuestionImage, type QuestionImageInfo } from '@/components/assessment/QuestionImage';
import {
  requirementLabel,
  statusCopy,
  type LearningNextAction,
  type StudentSemanticState,
  type AssessmentState,
} from '@/features/student/student-learning';
import type {
  AssessmentQuestionType,
  CourseUnit,
  MyCourseEnrollment,
  RoadmapUnit,
  StudentHomework,
} from '@/services/student-platform';

export function StudentPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="sx-page-header">
      <div>
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="sx-page-header-action">{action}</div> : null}
    </header>
  );
}

export function StudentLoading({ label = 'جارٍ تحميل المحتوى' }: { label?: string }) {
  return (
    <div className="sx-loading" role="status" aria-label={label}>
      <span />
      <span />
      <span />
    </div>
  );
}

export function StudentEmptyState({
  icon = 'courses',
  title,
  description,
  action,
}: {
  icon?: 'courses' | 'homework' | 'exams' | 'progress' | 'file';
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <section className="sx-empty">
      <span><AppIcon name={icon} /></span>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action}
    </section>
  );
}

export function StudentProgressBar({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className="sx-progress">
      <div>
        <span>{label}</span>
        <strong>{Math.round(safe)}%</strong>
      </div>
      <span
        className="sx-progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safe)}
      >
        <span style={{ inlineSize: `${safe}%` }} />
      </span>
    </div>
  );
}

export function StudentStatusBadge({
  state,
}: {
  state: StudentSemanticState | AssessmentState;
}) {
  const icon =
    state === 'COMPLETED' || state === 'GRADED'
      ? 'check'
      : state === 'LOCKED' || state === 'NOT_ENTITLED'
        ? 'lock'
        : 'activity';
  return (
    <span className="sx-status" data-state={state}>
      <AppIcon name={icon} />
      {statusCopy[state]}
    </span>
  );
}

export function NextAction({
  action,
  compact = false,
}: {
  action: LearningNextAction;
  compact?: boolean;
}) {
  return (
    <section className={`sx-next-action${compact ? ' is-compact' : ''}`}>
      <span className="sx-next-icon"><AppIcon name="homework" /></span>
      <div>
        <small>{action.eyebrow}</small>
        <h2>{action.description}</h2>
      </div>
      <Link className="sx-button sx-button-primary" to={action.href}>
        {action.label}
        <AppIcon name="arrow" />
      </Link>
    </section>
  );
}

export function StudentCourseCard({
  enrollment,
}: {
  enrollment: MyCourseEnrollment;
}) {
  const progress = Number(enrollment.courseProgress?.progressPercent ?? 0);
  return (
    <article className="sx-course-card">
      <div className="sx-course-art" aria-hidden="true">
        <AppIcon name="courses" />
        <span>Englishine</span>
      </div>
      <div className="sx-course-card-body">
        <span className="sx-eyebrow">{enrollment.course.grade?.nameAr ?? 'كورس Englishine'}</span>
        <h2>{enrollment.course.title}</h2>
        {enrollment.accessKind === 'ACTIVATION' ? <small>تفعيل وحدات أو دروس محددة — ليس اشتراكًا في الكورس كاملًا</small> : null}
        {enrollment.course.shortDescription ? <p>{enrollment.course.shortDescription}</p> : null}
        <div className="sx-course-meta">
          <span>{enrollment.course._count.units} وحدات</span>
          <StudentStatusBadge state={progress >= 100 ? 'COMPLETED' : progress > 0 ? 'IN_PROGRESS' : 'AVAILABLE'} />
        </div>
        <StudentProgressBar value={progress} label="تقدم الكورس" />
        <Link className="sx-button sx-button-primary" to={`/student/courses/${enrollment.course.id}/`}>
          {progress > 0 ? 'متابعة الكورس' : 'فتح الكورس'}
          <AppIcon name="arrow" />
        </Link>
      </div>
    </article>
  );
}

export function StudentUnitCard({
  courseId,
  unit,
  roadmap,
}: {
  courseId: string;
  unit: CourseUnit;
  roadmap?: RoadmapUnit;
}) {
  const state: StudentSemanticState = !roadmap?.entitled && !roadmap?.contextAccessible
    ? 'NOT_ENTITLED'
    : roadmap.state;
  const href = `/student/courses/${courseId}/units/${unit.id}/`;
  return (
    <article className="sx-unit-card" data-state={state}>
      <div className="sx-unit-cover">
        {unit.coverAssetId ? (
          <img src={mediaUrl(`/media/covers/unit/${unit.id}`)} alt={`غلاف ${unit.title}`} loading="lazy" />
        ) : (
          <div className="sx-unit-fallback" aria-hidden="true">
            <span>Englishine</span>
            <AppIcon name="courses" />
          </div>
        )}
        <StudentStatusBadge state={state} />
      </div>
      <div className="sx-unit-body">
        <span className="sx-eyebrow">الوحدة {unit.position}</span>
        <h2>{unit.title}</h2>
        {roadmap?.contextAccessible && !roadmap.entitled ? <small>تفعيل درس محدد داخل الوحدة</small> : null}
        {unit.description ? <p>{unit.description}</p> : null}
        <StudentProgressBar value={roadmap?.progressPercent ?? 0} label="تقدم الوحدة" />
        {state === 'NOT_ENTITLED' ? (
          <Link className="sx-button sx-button-secondary" to="/student/explore/">طرق التفعيل</Link>
        ) : state === 'LOCKED' ? (
          <span className="sx-lock-copy">أكمل الوحدة السابقة أولًا</span>
        ) : (
          <Link className="sx-button sx-button-primary" to={href}>
            {state === 'COMPLETED' ? 'مراجعة الوحدة' : 'متابعة الوحدة'}
            <AppIcon name="arrow" />
          </Link>
        )}
      </div>
    </article>
  );
}

export function LessonSequence({
  unit,
  roadmap,
}: {
  unit: CourseUnit;
  roadmap?: RoadmapUnit;
}) {
  return (
    <ol className="sx-lesson-sequence">
      {unit.lessons.map((lesson, index) => {
        const lessonState = roadmap?.lessons.find((item) => item.lessonId === lesson.id);
        const state: StudentSemanticState = !lessonState?.entitled
          ? 'NOT_ENTITLED'
          : (lessonState?.state ?? 'AVAILABLE');
        const available = state !== 'LOCKED' && state !== 'NOT_ENTITLED';
        return (
          <li key={lesson.id} data-state={state}>
            <span className="sx-lesson-index">{state === 'COMPLETED' ? <AppIcon name="check" /> : index + 1}</span>
            <div>
              <small>الدرس {lesson.position}</small>
              <h3>{lesson.title}</h3>
              <StudentProgressBar value={lessonState?.progressPercent ?? 0} label="تقدم الدرس" />
            </div>
            <StudentStatusBadge state={state} />
            {available ? (
              <Link className="sx-button sx-button-secondary" to={`/student/lesson/${lesson.id}/`}>
                {state === 'COMPLETED' ? 'مراجعة' : 'فتح الدرس'}
              </Link>
            ) : (
              <span className="sx-lock-copy">
                {state === 'NOT_ENTITLED' ? 'يحتاج إلى تفعيل' : 'أكمل الخطوة السابقة'}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function MaterialRow({
  id,
  title,
  type,
  originalName,
  byteSize,
  createdAt,
}: {
  id: string;
  title: string;
  type: string;
  originalName?: string;
  byteSize?: string;
  createdAt?: string;
}) {
  return (
    <a className="sx-material-row" href={mediaUrl(`/media/resources/${id}`)} target="_blank" rel="noreferrer">
      <span><AppIcon name="file" /></span>
      <div>
          <strong>{title}</strong>
          {originalName ? <small dir="auto">{originalName}</small> : null}
          {byteSize || createdAt ? <small>{byteSize ? `${Math.ceil(Number(byteSize) / 1024)} KB` : ''}{createdAt ? ` · ${new Date(createdAt).toLocaleDateString('ar-EG')}` : ''}</small> : null}
        <small>{({ PDF: 'PDF', DOCUMENT: 'مستند', IMAGE: 'صورة', LINK: 'رابط' } as Record<string, string>)[type] ?? 'ملف تعليمي'}</small>
      </div>
      <span>فتح الملف</span>
    </a>
  );
}

export function HomeworkItem({ homework }: { homework: StudentHomework }) {
  const submission = homework.submissions[0];
  const state = submission?.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : submission?.passed === true ? 'PASSED' : submission?.passed === false
    ? homework.remainingAttempts === 0 ? 'ATTEMPTS_EXHAUSTED' : 'FAILED' : submission
    ? submission.reviewStatus === 'REVIEWED'
      ? 'GRADED'
      : 'PENDING_REVIEW'
    : 'AVAILABLE';
  return (
    <article className="sx-homework-item">
      <span className="sx-homework-icon"><AppIcon name="homework" /></span>
      <div>
        <small>{[homework.lesson.unit.course.title, homework.lesson.unit.title, homework.lesson.title].filter(Boolean).join(' · ')}</small>
        <h2>{homework.title}</h2>
        {homework.instructions ? <p>{homework.instructions}</p> : null}
        {submission?.submittedAt ? <small>تم التسليم {new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(submission.submittedAt))}</small> : null}
      </div>
      <StudentStatusBadge state={state} />
      {submission?.score != null ? (
        <strong className="sx-score">{String(submission.score)}{homework.maxScore != null ? ` / ${String(homework.maxScore)}` : ''}</strong>
      ) : null}
      <Link className="sx-button sx-button-secondary" to={`/student/homework/${homework.id}/`}>
        {submission ? 'عرض الحالة' : 'ابدأ الواجب'}
      </Link>
    </article>
  );
}

export function Roadmap({
  courseId,
  units,
  courseUnits,
}: {
  courseId: string;
  units: RoadmapUnit[];
  courseUnits: CourseUnit[];
}) {
  return (
    <div className="sx-roadmap">
      {units.map((unitState) => {
        const unit = courseUnits.find((item) => item.id === unitState.unitId);
        if (!unit) return null;
        return (
          <section className="sx-roadmap-unit" key={unitState.unitId}>
            <header>
              <div>
                <small>الوحدة {unit.position}</small>
                <h2>{unit.title}</h2>
              </div>
              <StudentStatusBadge state={!unitState.entitled && !unitState.contextAccessible ? 'NOT_ENTITLED' : unitState.state} />
              <StudentProgressBar value={unitState.progressPercent} label="تقدم الوحدة" />
            </header>
            <ol>
              {unitState.requirements
                .filter((requirement) => requirement.key !== 'previous-unit' || !requirement.complete)
                .map((requirement) => (
                  <li key={requirement.key} data-state={requirement.complete ? 'COMPLETED' : requirement.current ? 'CURRENT' : 'UPCOMING'}>
                    <span>{requirement.complete ? <AppIcon name="check" /> : requirement.current ? <AppIcon name="play" /> : null}</span>
                    <div>
                      <strong>{requirementLabel(requirement)}</strong>
                      <small>{requirement.complete ? 'مكتمل' : requirement.current ? 'الخطوة الحالية' : 'خطوة قادمة'}</small>
                    </div>
                  </li>
                ))}
            </ol>
            {(unitState.entitled || unitState.contextAccessible) && unitState.state !== 'COMPLETED' ? (
              <Link className="sx-button sx-button-primary" to={`/student/courses/${courseId}/units/${unit.id}/`}>
                متابعة المسار
              </Link>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

export interface AssessmentAnswer {
  choiceIds: string[];
  text: string;
}

export function AssessmentFlow({ questions, answers, onChange, onSubmit, busy, error, allowMultiple }: {
  questions: Array<{ id: string; type: AssessmentQuestionType; prompt: string; image?: QuestionImageInfo | null; choices: Array<{ id: string; label: string }> }>;
  answers: Record<string, AssessmentAnswer>;
  onChange: (id: string, answer: AssessmentAnswer) => void;
  onSubmit: (event: FormEvent) => void;
  busy: boolean;
  error: string | null;
  allowMultiple: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const questionRef = useRef<HTMLElement>(null);
  useEffect(() => { questionRef.current?.focus(); }, [index]);
  const question = questions[index];
  if (!question) return <StudentEmptyState title="لا توجد أسئلة منشورة" />;
  const unanswered = questions.filter((item) => !answers[item.id]?.choiceIds.length && !answers[item.id]?.text.trim()).length;
  return <form onSubmit={(event) => { if (!confirm) { event.preventDefault(); setConfirm(true); } else onSubmit(event); }}>
    <fieldset disabled={busy} className="sx-assessment-fieldset">
      <p role="status">السؤال {index + 1} من {questions.length}</p>
      <nav className="sx-question-navigator" aria-label="التنقل بين الأسئلة">{questions.map((item, number) => <button type="button" key={item.id} aria-current={number === index ? 'step' : undefined} aria-label={`السؤال ${number + 1}${!answers[item.id]?.choiceIds.length && !answers[item.id]?.text.trim() ? ' — بدون إجابة' : ' — تمت الإجابة'}`} className="sx-button sx-button-secondary" onClick={() => { setConfirm(false); setIndex(number); }}>{number + 1}</button>)}</nav>
        <section className="sx-question-card" key={question.id} ref={questionRef} tabIndex={-1} aria-label={`السؤال ${index + 1}`}>
          {question.image ? <QuestionImage image={question.image} /> : null}
        <AssessmentQuestion question={question} answer={answers[question.id] ?? { choiceIds: [], text: '' }} allowMultiple={allowMultiple} onChange={(answer) => { setConfirm(false); onChange(question.id, answer); }} />
      </section>
      <div className="sx-assessment-actions">
        <button className="sx-button sx-button-secondary" type="button" disabled={index === 0} onClick={() => { setConfirm(false); setIndex(index - 1); }}>السابق</button>
        {index < questions.length - 1 ? <button className="sx-button sx-button-primary" type="button" onClick={() => { setConfirm(false); setIndex(index + 1); }}>التالي</button> : <button className="sx-button sx-button-primary" type="submit">{busy ? 'جارٍ التسليم…' : confirm ? 'تأكيد التسليم النهائي' : 'مراجعة وتسليم'}</button>}
      </div>
      {confirm ? <div role="status" className="sx-submit-confirm"><strong>هل تريد تسليم الإجابات الآن؟</strong><p>{unanswered ? `يوجد ${unanswered} سؤال بدون إجابة.` : 'أجبت عن جميع الأسئلة.'} بعد التأكيد سيتم حفظ التسليم.</p><button type="button" className="sx-button sx-button-secondary" onClick={() => setConfirm(false)}>العودة للمراجعة</button></div> : null}
    </fieldset>
    {error ? <p className="sx-form-error" role="alert">{error}</p> : null}
  </form>;
}

export function AssessmentQuestion({
  question,
  answer,
  onChange,
  allowMultiple,
}: {
  question: {
    id: string;
    type: AssessmentQuestionType;
    prompt: string;
    choices: Array<{ id: string; label: string }>;
  };
  answer: AssessmentAnswer;
  onChange: (answer: AssessmentAnswer) => void;
  allowMultiple: boolean;
}) {
  const textQuestion = question.type === 'SHORT_TEXT' || question.type === 'LONG_TEXT';
  if (textQuestion) {
    return (
      <label className="sx-assessment-text">
        <span dir="auto">{question.prompt}</span>
        <textarea
          dir="auto"
          rows={question.type === 'LONG_TEXT' ? 7 : 3}
          value={answer.text}
          onChange={(event) => onChange({ ...answer, text: event.target.value })}
        />
      </label>
    );
  }
  const multiple = allowMultiple && question.type === 'MULTIPLE_CHOICE';
  return (
    <fieldset className="sx-assessment-options">
      <legend dir="auto">{question.prompt}</legend>
      {question.choices.map((choice) => {
        const selected = answer.choiceIds.includes(choice.id);
        return (
          <label key={choice.id} data-selected={selected}>
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={question.id}
              checked={selected}
              onChange={() => {
                const choiceIds = multiple
                  ? selected
                    ? answer.choiceIds.filter((id) => id !== choice.id)
                    : [...answer.choiceIds, choice.id]
                  : [choice.id];
                onChange({ ...answer, choiceIds });
              }}
            />
            <span dir="auto">{choice.label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
