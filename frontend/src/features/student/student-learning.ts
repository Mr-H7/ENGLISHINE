import type {
  CourseUnit,
  RoadmapRequirement,
  RoadmapUnit,
  StudentCourseEnrollment,
  StudentExam,
  StudentHomework,
} from '@/services/student-platform';

export type StudentSemanticState =
  | 'AVAILABLE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'LOCKED'
  | 'SUBMITTED'
  | 'GRADED'
  | 'NOT_ENTITLED';

export interface LearningNextAction {
  label: string;
  href: string;
  eyebrow: string;
  description: string;
}

export type AssessmentState = 'PASSED' | 'FAILED' | 'PENDING_REVIEW' | 'ATTEMPTS_EXHAUSTED';
export function assessmentState(input: { inProgress?: boolean; passed?: boolean | null; pending?: boolean; remainingAttempts?: number }): AssessmentState | 'AVAILABLE' | 'IN_PROGRESS' {
  if (input.inProgress) return 'IN_PROGRESS';
  if (input.passed === true) return 'PASSED';
  if (input.pending) return 'PENDING_REVIEW';
  if (input.remainingAttempts === 0) return 'ATTEMPTS_EXHAUSTED';
  return input.passed === false ? 'FAILED' : 'AVAILABLE';
}
export const statusCopy: Record<StudentSemanticState | AssessmentState, string> = {
  AVAILABLE: 'متاح',
  IN_PROGRESS: 'قيد التقدم',
  COMPLETED: 'مكتمل',
  LOCKED: 'مغلق مؤقتًا',
  SUBMITTED: 'تم التسليم',
  GRADED: 'تم التصحيح',
  NOT_ENTITLED: 'يحتاج إلى تفعيل',
  PASSED: 'تم الاجتياز',
  FAILED: 'لم يتم الاجتياز',
  PENDING_REVIEW: 'قيد المراجعة',
  ATTEMPTS_EXHAUSTED: 'نفدت المحاولات',
};

export function requirementLabel(requirement: RoadmapRequirement): string {
  if (requirement.key === 'previous-unit') return 'إكمال الوحدة السابقة';
  if (requirement.key.startsWith('video:')) return 'مشاهدة الشرح';
  if (requirement.key.startsWith('homework-submit:')) return 'تسليم الواجب';
  if (requirement.key.startsWith('homework-review:')) return 'مراجعة حالة الواجب';
  if (requirement.key.startsWith('exam:')) return 'إكمال الاختبار';
  return requirement.label;
}

function findLessonTitle(course: StudentCourseEnrollment, lessonId: string) {
  for (const unit of course.course.units) {
    const lesson = unit.lessons.find((item) => item.id === lessonId);
    if (lesson) return { lesson, unit };
  }
  return null;
}

export function deriveNextAction(
  course: StudentCourseEnrollment,
  roadmap: RoadmapUnit[],
  homework: StudentHomework[],
  exams: StudentExam[],
): LearningNextAction | null {
  if (!roadmap.length) return null;
  const scope = roadmap.filter((unit) => (unit.entitled || unit.contextAccessible) && course.course.units.some((item) => item.id === unit.unitId));
  const ordered = [...scope.filter((unit) => unit.state !== 'LOCKED'), ...scope.filter((unit) => unit.state === 'LOCKED')];
  for (const unitState of ordered) {
    if (unitState.state === 'COMPLETED') continue;
    const unit = course.course.units.find((item) => item.id === unitState.unitId);
    if (!unit) continue;
    if (!unitState.entitled && !unitState.contextAccessible) {
      return {
        label: 'عرض طرق التفعيل',
        href: '/student/explore/',
        eyebrow: 'الوحدة تحتاج إلى تفعيل',
        description: unit.title,
      };
    }
    if (unitState.state === 'LOCKED') {
      return {
        label: 'عرض مسار التقدم',
        href: '/student/progress/',
        eyebrow: 'أكمل الخطوة السابقة أولًا',
        description: unit.title,
      };
    }
    for (const lessonState of unitState.lessons) {
      if (lessonState.state === 'COMPLETED') continue;
      if (!lessonState.entitled || lessonState.state === 'LOCKED') continue;
      const found = findLessonTitle(course, lessonState.lessonId);
      if (!found) continue;
      const current =
        lessonState.requirements.find((item) => item.current) ??
        lessonState.requirements.find((item) => !item.complete);
      if (!current || current.key.startsWith('video:')) {
        return {
          label: 'متابعة الدرس',
          href: `/student/lesson/${lessonState.lessonId}/`,
          eyebrow: unit.title,
          description: found.lesson.title,
        };
      }
      if (current.key.startsWith('homework-')) {
        const homeworkId = current.key.split(':')[1];
        const item = homework.find((entry) => entry.id === homeworkId);
        return {
          label: current.key.startsWith('homework-review:')
            ? 'عرض حالة الواجب'
            : 'ابدأ الواجب',
          href: homeworkId
            ? `/student/homework/${homeworkId}/`
            : '/student/homework/',
          eyebrow: found.lesson.title,
          description: item?.title ?? requirementLabel(current),
        };
      }
      if (current.key.startsWith('exam:')) {
        const examId = current.key.split(':')[1];
        const item = exams.find((entry) => entry.id === examId);
        return {
          label: item?.attempts[0]?.result ? 'عرض النتيجة' : 'ابدأ الاختبار',
          href: examId ? `/student/exams/${examId}/` : '/student/exams/',
          eyebrow: found.lesson.title,
          description: item?.title ?? requirementLabel(current),
        };
      }
      return {
        label: 'متابعة الوحدة',
        href: `/student/courses/${course.course.id}/units/${unit.id}/`,
        eyebrow: course.course.title,
        description: requirementLabel(current),
      };
    }
    const pendingExam = unitState.requirements.find((item) => !item.complete && item.key.startsWith('exam:'));
    if (pendingExam) {
      const examId = pendingExam.key.slice(5);
      return { label: 'فتح الاختبار', href: `/student/exams/${examId}/`, eyebrow: unit.title, description: exams.find((item) => item.id === examId)?.title ?? 'اختبار الوحدة' };
    }
    return {
      label: 'متابعة الوحدة',
      href: `/student/courses/${course.course.id}/units/${unit.id}/`,
      eyebrow: course.course.title,
      description: unit.title,
    };
  }
  if (!scope.length) return null;
  return {
    label: 'عرض مسار التقدم',
    href: '/student/progress/',
    eyebrow: course.accessKind === 'ACTIVATION' ? 'تم إكمال متطلبات المحتوى المفعّل' : 'تم إكمال متطلبات الكورس',
    description: course.course.title,
  };
}

export function semanticState(row: { entitled: boolean; state: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' }): StudentSemanticState {
  return row.entitled ? row.state : 'NOT_ENTITLED';
}

export function unitStateFor(
  unit: CourseUnit,
  roadmap: RoadmapUnit[],
): RoadmapUnit | undefined {
  return roadmap.find((item) => item.unitId === unit.id);
}
