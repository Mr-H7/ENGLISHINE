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
  studentPhone: string | null;
  parentPhone: string | null;
  avatarAssetId: string | null;
  user?: { email: string | null };
  grade: (GradeOption & {
    stage: { id: string; code: string; nameAr: string };
  }) | null;
}

export interface ExploreCourse {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  accessLevel: 'FREE' | 'PREVIEW' | 'ENROLLED' | 'LOCKED' | 'PAID';
  grade: { id: string; nameAr: string } | null;
  teachers: Array<{ teacher: { fullName: string } }>;
  enrollments: Array<{ id: string; status: string; expiresAt: string | null }>;
  units?: Array<{
    id: string;
    title: string;
    position: number;
    accessLevel: string;
    coverAssetId: string | null;
  }>;
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

export interface CourseProgressRecord {
  lastLessonId: string | null;
  status: string;
  completedLessons: number;
  totalLessons: number;
  progressPercent: number | string;
}

export interface MyCourseEnrollment {
  id: string | null;
  status: string | null;
  accessKind?: 'ENROLLMENT' | 'ACTIVATION';
  scope?: { unitIds: string[]; lessonIds: string[]; redeemedAt: string } | null;
  expiresAt: string | null;
  course: {
    id: string;
    title: string;
    shortDescription: string | null;
    grade: { nameAr: string; stage: { nameAr: string } } | null;
    academicTerm?: { nameAr?: string | null; name?: string | null } | null;
    _count: { units: number };
  };
  courseProgress: CourseProgressRecord | null;
}

export interface ActivatedContent {
  id: string;
  redeemedAt: string;
  courseTitle: string;
  unitTitle: string;
  lessons: Array<{ id: string; title: string }>;
}

export interface CourseLesson {
  id: string;
  title: string;
  description: string | null;
  position: number;
  accessLevel: string;
  estimatedMinutes: number | null;
  videos: Array<{
    id: string;
    title: string;
    accessLevel: string;
    durationSeconds?: number | null;
  }>;
  resources: Array<{ id: string; title: string; type: string; originalName?: string; byteSize?: string; createdAt?: string }>;
}

export interface CourseUnit {
  id: string;
  title: string;
  description?: string | null;
  accessLevel: string;
  coverAssetId: string | null;
  position: number;
  lessons: CourseLesson[];
}

export interface StudentCourseEnrollment extends MyCourseEnrollment {
  course: MyCourseEnrollment['course'] & {
    units: CourseUnit[];
  };
  lessonProgress: Array<{
    lessonId: string;
    status: string;
    lastAccessedAt: string | null;
    completedAt: string | null;
  }>;
  videoProgress: Array<{
    videoId: string;
    watchedSeconds: number;
    durationSeconds: number | null;
    progressPercent: number | string;
    completedAt: string | null;
  }>;
}

export interface StudentHomeworkSubmission {
  id: string;
  status: string;
  reviewStatus: string;
  score: number | string | null;
  submittedAt: string | null;
  passed?: boolean | null;
  percentage?: string | number | null;
  attemptNo?: number;
}

export interface StudentHomework {
  id: string;
  title: string;
  instructions: string | null;
  coverAssetId: string | null;
  dueAt: string | null;
  maxScore: number | string | null;
  lesson: {
    id: string;
    title: string;
    unit: { id?: string; title?: string; course: { id: string; title: string } };
  };
  submissions: StudentHomeworkSubmission[];
  maxAttempts?: number;
  attemptsUsed?: number;
  remainingAttempts?: number;
}

export type AssessmentQuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'SHORT_TEXT'
  | 'LONG_TEXT';

export interface AssessmentChoice {
  id: string;
  label: string;
  position: number;
}

export interface HomeworkQuestion {
  id: string;
  type: AssessmentQuestionType;
  prompt: string;
  image?: { url: string } | null;
  position: number;
  points: number | string | null;
  choices: AssessmentChoice[];
}

export interface StudentHomeworkDetail {
  id: string;
  title: string;
  instructions: string | null;
  dueAt: string | null;
  maxScore: number | string | null;
  lessonId: string;
  lesson: {
    id: string;
    title: string;
    unit: { id: string; courseId: string };
  };
  questions: HomeworkQuestion[];
  submission?: StudentHomeworkSubmission | null;
  maxAttempts: number;
  attemptsUsed: number;
  remainingAttempts: number;
}

export interface StudentExam {
  id: string;
  title: string;
  instructions?: string | null;
  unitId: string | null;
  lessonId: string | null;
  durationMinutes: number | null;
  maxAttempts: number;
  opensAt: string | null;
  closesAt: string | null;
  course: { id: string; title: string };
  attempts: Array<{
    id: string;
    attemptNo: number;
    status: string;
    expiresAt: string | null;
    submittedAt: string | null;
    result: {
      score: number | string;
      maxScore: number | string;
      percentage: number | string;
      passed: boolean | null;
      publishedAt?: string | null;
    } | null;
  }>;
}

export interface ExamQuestion extends HomeworkQuestion {
  points: number | string;
}

export interface StudentExamSession {
  attempt: {
    id: string;
    attemptNo: number;
    startedAt: string;
    expiresAt: string | null;
  };
  exam: {
    id: string;
    title: string;
    instructions: string | null;
    durationMinutes: number | null;
    sections: Array<{
      id: string;
      title: string;
      description: string | null;
      position: number;
      questions: ExamQuestion[];
    }>;
  };
}

export interface StudentExamResult {
  id: string;
  score: number | string;
  maxScore: number | string;
  percentage: number | string;
  passed: boolean | null;
  publishedAt: string | null;
}

export interface StudentLesson {
  id: string;
  title: string;
  description: string | null;
  entitled: boolean;
  accessLevel: 'FREE' | 'PREVIEW' | 'ENROLLED' | 'LOCKED' | 'PAID';
  unitId: string;
  unit: {
    id: string;
    title: string;
    coverAssetId?: string | null;
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
  resources: Array<{ id: string; title: string; type: string; originalName?: string; byteSize?: string; createdAt?: string }>;
}

export interface RoadmapRequirement {
  key: string;
  label: string;
  complete: boolean;
  current: boolean;
}

export interface RoadmapLesson {
  lessonId: string;
  entitled: boolean;
  state: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED';
  progressPercent: number;
  requirements: RoadmapRequirement[];
}

export interface RoadmapUnit {
  unitId: string;
  entitled: boolean;
  contextAccessible?: boolean;
  state: 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED';
  progressPercent: number;
  requirements: RoadmapRequirement[];
  lessons: RoadmapLesson[];
}

export interface StudentCourseProgress {
  course: { id: string; title: string };
  units: RoadmapUnit[];
}

export interface HomeworkAnswerInput {
  questionId: string;
  selectedChoiceId?: string;
  selectedChoiceIds?: string[];
  textAnswer?: string;
}

export interface ExamAnswerInput {
  questionId: string;
  choiceIds?: string[];
  textAnswer?: string;
}

const data = <T>(path: string, init?: RequestInit) =>
  apiRequest<{ data: T }>(path, init).then((response) => response.data);

export const studentPlatformApi = {
  grades: () => data<StageOption[]>('/student/grades'),
  profile: () => data<StudentProfile>('/student/profile'),
  updateProfile: (input: {
    fullName?: string;
    studentPhone?: string;
    guardianPhone?: string;
    email?: string | null;
  }) =>
    data<StudentProfile>('/student/profile', {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  activatedContent: () => data<ActivatedContent[]>('/student/activations'),
  explore: () => data<ExploreCourse[]>('/student/explore'),
  freeContent: () => data<FreeContentItem[]>('/student/free-content'),
  myCourses: () => data<MyCourseEnrollment[]>('/student/courses'),
  myCourse: (courseId: string) =>
    data<StudentCourseEnrollment>(`/student/courses/${courseId}`),
  roadmap: (courseId: string) =>
    data<RoadmapUnit[]>(`/student/courses/${courseId}/roadmap`),
  lessonRequirements: (lessonId: string) =>
    data<RoadmapLesson>(`/student/lessons/${lessonId}/requirements`),
  homework: () => data<StudentHomework[]>('/student/homework'),
  homeworkDetail: (homeworkId: string) =>
    data<StudentHomeworkDetail>(`/student/homework/${homeworkId}`),
  startHomework: (homeworkId: string) => data<StudentHomeworkSubmission>(`/student/homework/${homeworkId}/attempts`, { method: 'POST' }),
  submitHomework: (homeworkId: string, answers: HomeworkAnswerInput[], attemptId?: string) =>
    data<StudentHomeworkSubmission>(`/student/homework/${homeworkId}/submissions`, {
      method: 'POST',
      body: JSON.stringify({ answers, attemptId }),
    }),
  exams: () => data<StudentExam[]>('/student/exams'),
  startExam: (examId: string) =>
    data<StudentExamSession>(`/student/exams/${examId}/attempts`, {
      method: 'POST',
    }),
  submitExam: (attemptId: string, answers: ExamAnswerInput[]) =>
    data<StudentExamResult>(`/student/exam-attempts/${attemptId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),
  progress: () => data<StudentCourseProgress[]>('/student/progress'),
  lesson: (lessonId: string) => data<StudentLesson>(`/student/lessons/${lessonId}`),
  reportVideoProgress: (
    videoId: string,
    watchedSeconds: number,
    durationSeconds?: number,
  ) =>
    data(`/student/progress/videos/${videoId}`, {
      method: 'PUT',
      body: JSON.stringify({ watchedSeconds, durationSeconds }),
    }),
};
