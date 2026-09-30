import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { studentPlatformApi, type RoadmapLesson, type StudentHomework, type StudentExam } from '@/services/student-platform';
import { HomeworkItem, NextAction, StudentProgressBar } from '@/components/student/StudentExperience';
import { requirementLabel, type LearningNextAction } from '@/features/student/student-learning';

export function LessonLearningContext({ courseId, lessonId, title }: { courseId: string; lessonId: string; title: string }) {
  const [state, setState] = useState<{ lesson: RoadmapLesson | null; homework: StudentHomework[]; exams: StudentExam[]; error: string | null }>({ lesson: null, homework: [], exams: [], error: null });
  const refresh = useCallback(async () => {
    const [lesson, homework, exams] = await Promise.all([
      studentPlatformApi.lessonRequirements(lessonId), studentPlatformApi.homework(), studentPlatformApi.exams(),
    ]);
    return { lesson, homework: homework.filter((item) => item.lesson.id === lessonId), exams: exams.filter((item) => item.lessonId === lessonId), error: null };
  }, [lessonId]);
  useEffect(() => {
    let active = true;
    const load = () => { void refresh().then((value) => { if (active) setState(value); }, () => { if (active) setState((value) => ({ ...value, error: 'تعذر تحديث متطلبات الدرس. حاول مرة أخرى.' })); }); };
    load();
    const timer = window.setInterval(() => { if (!document.hidden) load(); }, 15000);
    window.addEventListener('focus', load);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', load); };
  }, [refresh]);
  const lesson = state.lesson;
  const current = lesson?.requirements.find((item) => !item.complete);
  let action: LearningNextAction | null = null;
  if (current?.key.startsWith('homework-')) {
    const id = current.key.split(':')[1];
    action = { label: current.key.startsWith('homework-review:') ? 'عرض حالة الواجب' : 'ابدأ الواجب', href: `/student/homework/${id}/`, eyebrow: 'الخطوة التالية', description: state.homework.find((item) => item.id === id)?.title ?? requirementLabel(current) };
  } else if (current?.key.startsWith('exam:')) {
    const id = current.key.slice(5);
    action = { label: 'فتح الاختبار', href: `/student/exams/${id}/`, eyebrow: 'الخطوة التالية', description: state.exams.find((item) => item.id === id)?.title ?? 'اختبار الدرس' };
  } else if (lesson?.state === 'COMPLETED') {
    action = { label: 'متابعة المسار', href: `/student/courses/${courseId}/`, eyebrow: 'متطلبات الدرس مكتملة', description: title };
  }
  return <div className="sx-lesson-context">
    {state.error ? <p role="status">{state.error}</p> : null}
    {action ? <NextAction action={action} /> : null}
    {state.homework.length ? <section><h2>واجب الدرس</h2><div className="sx-homework-list">{state.homework.map((item) => <HomeworkItem key={item.id} homework={item} />)}</div></section> : null}
    {state.exams.length ? <section><h2>اختبارات الدرس</h2>{state.exams.map((exam) => <Link key={exam.id} className="sx-button sx-button-secondary" to={`/student/exams/${exam.id}/`}>{exam.title}</Link>)}</section> : null}
    {lesson ? <StudentProgressBar value={lesson.progressPercent} label="تقدم متطلبات الدرس" /> : null}
  </div>;
}
