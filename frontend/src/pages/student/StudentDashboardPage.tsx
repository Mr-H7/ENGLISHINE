import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  NextAction,
  StudentEmptyState,
  StudentLoading,
  StudentProgressBar,
} from '@/components/student/StudentExperience';
import { deriveNextAction } from '@/features/student/student-learning';
import { useDocumentMetadata } from '@/hooks/useDocumentMetadata';
import { useSession } from '@/hooks/useSession';
import { useStudentPlatform } from '@/hooks/useStudentPlatform';
import {
  studentPlatformApi,
  type MyCourseEnrollment,
  type RoadmapUnit,
  type StudentCourseEnrollment,
  type StudentExam,
  type StudentHomework,
} from '@/services/student-platform';
import { mediaUrl } from '@/services/api';

interface DashboardState {
  loading: boolean;
  error: string | null;
  courses: MyCourseEnrollment[];
  course: StudentCourseEnrollment | null;
  roadmap: RoadmapUnit[];
  homework: StudentHomework[];
  exams: StudentExam[];
}

const emptyState: DashboardState = {
  loading: true,
  error: null,
  courses: [],
  course: null,
  roadmap: [],
  homework: [],
  exams: [],
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'صباح الخير';
  if (hour < 18) return 'مساء الخير';
  return 'أهلًا بك';
}

export function Component() {
  const session = useSession();
  const { profile } = useStudentPlatform();
  const [state, setState] = useState<DashboardState>(emptyState);

  useDocumentMetadata({
    title: 'الرئيسية — Englishine',
    description: 'خطوتك التعليمية التالية في Englishine.',
    openGraph: [],
    structuredData: [],
  });

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [courses, homework, exams] = await Promise.all([
          studentPlatformApi.myCourses(),
          studentPlatformApi.homework(),
          studentPlatformApi.exams(),
        ]);
        const ordered = [...courses.filter((item) => item.courseProgress?.lastLessonId), ...courses.filter((item) => !item.courseProgress?.lastLessonId)];
        let course: StudentCourseEnrollment | null = null;
        let roadmap: RoadmapUnit[] = [];
        for (const candidate of ordered) {
          const [nextCourse, nextRoadmap] = await Promise.all([
            studentPlatformApi.myCourse(candidate.course.id), studentPlatformApi.roadmap(candidate.course.id),
          ]);
          const actionable = nextRoadmap.some((unit) => unit.state !== 'LOCKED' && unit.state !== 'COMPLETED' && (unit.entitled || unit.contextAccessible));
          if (!course || actionable) { course = nextCourse; roadmap = nextRoadmap; }
          if (actionable) break;
        }
        if (active) {
          setState({
            loading: false,
            error: null,
            courses,
            course,
            roadmap,
            homework,
            exams,
          });
        }
      } catch (reason) {
        if (active) {
          setState((current) => ({
            ...current,
            loading: false,
            error:
              reason instanceof Error
                ? reason.message
                : 'تعذر تحميل مساحة التعلم.',
          }));
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const action = useMemo(
    () =>
      state.course
        ? deriveNextAction(
            state.course,
            state.roadmap,
            state.homework,
            state.exams,
          )
        : null,
    [state.course, state.roadmap, state.homework, state.exams],
  );

  const currentUnitState = state.roadmap.find(
    (unit) => unit.state !== 'COMPLETED',
  );
  const currentUnit = state.course?.course.units.find(
    (unit) => unit.id === currentUnitState?.unitId,
  );
  const completedRequirements = state.roadmap.reduce(
    (total, unit) =>
      total + unit.requirements.filter((requirement) => requirement.complete).length,
    0,
  );
  const allRequirements = state.roadmap.reduce(
    (total, unit) => total + unit.requirements.length,
    0,
  );
  const progressPercent = allRequirements
    ? Math.round((completedRequirements / allRequirements) * 100)
    : Number(state.course?.courseProgress?.progressPercent ?? 0);
  const studentName =
    profile?.fullName ??
    (session.status === 'authenticated' ? session.user.displayName : 'طالب Englishine');

  if (state.loading) return <StudentLoading label="جارٍ تجهيز خطوتك التالية" />;

  return (
    <div className="sx-page sx-home">
      <header className="sx-home-heading">
        <span>{profile?.grade?.nameAr ?? 'مساحة التعلم'}</span>
        <h1>{greeting()}، {studentName}</h1>
        <p>خطوتك الأكاديمية التالية جاهزة للمتابعة.</p>
      </header>

      {state.error ? (
        <StudentEmptyState
          title="تعذر تحميل مساحة التعلم"
          description={state.error}
        />
      ) : state.course && action ? (
        <>
          <section className="sx-continue" aria-labelledby="continue-title">
            <div className="sx-continue-copy">
              <span className="sx-eyebrow">أكمل من حيث توقفت</span>
              <small>{state.course.course.title}</small>
              {state.course.accessKind === 'ACTIVATION' ? <small>تفعيل وحدات أو دروس محددة</small> : null}
              <h2 id="continue-title">
                {currentUnit?.title ?? action.description}
              </h2>
              <p>{action.description}</p>
              <StudentProgressBar
                value={currentUnitState?.progressPercent ?? progressPercent}
                label={currentUnit ? 'إنجاز الوحدة' : 'تقدم الكورس'}
              />
              <NextAction action={action} compact />
            </div>
            <div className="sx-continue-cover">
              {currentUnit?.coverAssetId ? (
                <img
                  src={mediaUrl(`/media/covers/unit/${currentUnit.id}`)}
                  alt={`غلاف ${currentUnit.title}`}
                />
              ) : (
                <div className="sx-unit-fallback" aria-hidden="true">
                  <span>Englishine</span>
                  <AppIcon name="courses" />
                </div>
              )}
            </div>
          </section>

          <section className="sx-progress-snapshot">
            <div>
              <span className="sx-eyebrow">خريطة تقدمك</span>
              <h2>
                {completedRequirements} من {allRequirements} خطوات مكتملة
              </h2>
            </div>
            <StudentProgressBar value={progressPercent} label="إجمالي التقدم" />
            <Link to="/student/progress/">
              عرض التقدم
              <AppIcon name="arrow" />
            </Link>
          </section>
        </>
      ) : (
        <StudentEmptyState
          title="لم يتم تفعيل كورسات بعد"
          description="يمكنك البدء بالمحتوى المجاني أو استكشاف الكورسات المناسبة لصفك."
          action={
            <div className="sx-empty-actions">
              <Link className="sx-button sx-button-primary" to="/student/free/">
                المحتوى المجاني
              </Link>
              <Link className="sx-button sx-button-secondary" to="/student/explore/">
                استكشف الكورسات
              </Link>
            </div>
          }
        />
      )}
    </div>
  );
}
