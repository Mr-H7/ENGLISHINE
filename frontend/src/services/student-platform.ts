import { apiRequest } from '@/services/api';

export interface GradeOption {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
}

export interface StageOption {
  id: string;
  code: string;
  nameAr: string;
  grades: GradeOption[];
}

export interface StudentProfile {
  id: string;
  fullName: string;
  parentName: string | null;
  parentPhone: string | null;
  grade: (GradeOption & {
    stage: { id: string; code: string; nameAr: string };
  }) | null;
}

export interface ExploreCourse {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  accessLevel: 'FREE' | 'PREVIEW' | 'ENROLLED' | 'LOCKED';
  grade: { id: string; nameAr: string } | null;
  teachers: Array<{ teacher: { fullName: string } }>;
  enrollments: Array<{ id: string; status: string; expiresAt: string | null }>;
}

export interface FreeContentItem {
  id: string;
  title: string;
  type: string;
  contentKind: 'VIDEO' | 'LESSON';
  accessLevel: 'FREE' | 'PREVIEW';
  durationSeconds: number | null;
  streamPath: string | null;
  lesson: {
    id: string;
    title: string;
    unit: {
      title: string;
      course: {
        id: string;
        title: string;
        grade: { nameAr: string } | null;
      };
    };
  };
}

export interface MyCourseEnrollment {
  id: string;
  status: string;
  expiresAt: string | null;
  course: {
    id: string;
    title: string;
    shortDescription: string | null;
    grade: { nameAr: string; stage: { nameAr: string } } | null;
    _count: { units: number };
  };
  courseProgress: { progressPercent: number } | null;
}

export interface StudentCourseEnrollment extends MyCourseEnrollment {
  course: MyCourseEnrollment['course'] & {
    units: Array<{
      id: string;
      title: string;
      position: number;
      lessons: Array<{
        id: string;
        title: string;
        description: string | null;
        position: number;
        estimatedMinutes: number | null;
        videos: Array<{ id: string; title: string; accessLevel: string }>;
        resources: Array<{ id: string; title: string; type: string }>;
      }>;
    }>;
  };
}

export interface StudentHomework {
  id: string;
  title: string;
  dueAt: string | null;
  maxScore: number | string | null;
  lesson: {
    id: string;
    title: string;
    unit: { course: { id: string; title: string } };
  };
  submissions: Array<{
    id: string;
    status: string;
    reviewStatus: string;
    score: number | string | null;
    submittedAt: string | null;
  }>;
}

export interface StudentExam {
  id: string;
  title: string;
  durationMinutes: number | null;
  maxAttempts: number;
  opensAt: string | null;
  closesAt: string | null;
  course: { id: string; title: string };
  attempts: Array<{
    id: string;
    attemptNo: number;
    status: string;
    submittedAt: string | null;
    result: {
      score: number | string;
      maxScore: number | string;
      percentage: number | string;
      passed: boolean | null;
    } | null;
  }>;
}

export interface StudentLesson {
  id: string;
  title: string;
  description: string | null;
  entitled: boolean;
  accessLevel: 'FREE' | 'PREVIEW' | 'ENROLLED' | 'LOCKED';
  unit: {
    title: string;
    course: { id: string; title: string; accessLevel: string };
  };
  videos: Array<{
    id: string;
    title: string;
    type: string;
    accessLevel: string;
    durationSeconds: number | null;
    streamPath: string;
  }>;
  resources: Array<{ id: string; title: string; type: string }>;
}

export interface StudentCourseProgress {
  id: string;
  course: { id: string; title: string };
  courseProgress: {
    status: string;
    completedLessons: number;
    totalLessons: number;
    progressPercent: number | string;
    completedAt: string | null;
  } | null;
}

const data = <T>(path: string, init?: RequestInit) =>
  apiRequest<{ data: T }>(path, init).then((response) => response.data);

export const studentPlatformApi = {
  grades: () => data<StageOption[]>('/student/grades'),
  profile: () => data<StudentProfile>('/student/profile'),
  updateGrade: (gradeId: string) =>
    data<StudentProfile>('/student/profile/grade', {
      method: 'PATCH',
      body: JSON.stringify({ gradeId }),
    }),
  explore: () => data<ExploreCourse[]>('/student/explore'),
  freeContent: () => data<FreeContentItem[]>('/student/free-content'),
  myCourses: () => data<MyCourseEnrollment[]>('/student/courses'),
  myCourse: (courseId: string) =>
    data<StudentCourseEnrollment>(`/student/courses/${courseId}`),
  homework: () => data<StudentHomework[]>('/student/homework'),
  exams: () => data<StudentExam[]>('/student/exams'),
  progress: () => data<StudentCourseProgress[]>('/student/progress'),
  lesson: (lessonId: string) => data<StudentLesson>(`/student/lessons/${lessonId}`),
};
