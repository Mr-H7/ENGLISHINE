export type LessonStatus = 'available' | 'coming';
export type LessonComponentKind = 'video' | 'resources' | 'notes' | 'homework';

export interface LearningLesson {
  id: string;
  title: string;
  description: string;
  status: LessonStatus;
  duration: string | null;
}

export interface LearningChapter {
  id: string;
  title: string;
  subtitle: string;
  status: LessonStatus;
  lessons: LearningLesson[];
}

export interface LearningCourse {
  id: string;
  title: string;
  stage: string;
  term: string;
  description: string;
  access: 'preview';
  chapters: LearningChapter[];
}

const unitOneLessons: LearningLesson[] = [
  {
    id: 'lesson-1-2',
    title: 'Lesson 1.2',
    description: 'شرح الدرسين الأول والثاني معًا كما تم تسجيلهما.',
    status: 'available',
    duration: null,
  },
  {
    id: 'lesson-3',
    title: 'Lesson 3',
    description: 'شرح منفصل وتدريب على أسئلة الدرس.',
    status: 'available',
    duration: null,
  },
  {
    id: 'lesson-4-story',
    title: 'Lesson 4 — Story',
    description: 'قصة تعليمية مرئية ستُضاف بعد تجهيز المحتوى.',
    status: 'coming',
    duration: null,
  },
  {
    id: 'lesson-5-6',
    title: 'Lesson 5.6',
    description: 'شرح الدرسين الخامس والسادس معًا كما تم تسجيلهما.',
    status: 'available',
    duration: null,
  },
];

export const previewCourse: LearningCourse = {
  id: 'prep1-term1',
  title: 'English — الصف الأول الإعدادي',
  stage: 'المرحلة الإعدادية',
  term: 'الترم الأول',
  description: 'مسار منظم لشرح المنهج والتدريب والواجب والمتابعة.',
  access: 'preview',
  chapters: [
    {
      id: 'prep1-t1-u1',
      title: 'Unit 1',
      subtitle: 'بداية منظمة للمنهج',
      status: 'available',
      lessons: unitOneLessons,
    },
    ...Array.from({ length: 5 }, (_, index) => ({
      id: `prep1-t1-u${index + 2}`,
      title: `Unit ${index + 2}`,
      subtitle: 'المحتوى قيد التجهيز',
      status: 'coming' as const,
      lessons: [],
    })),
  ],
};

export const videoSections = [
  { id: 'vocabulary', label: 'Vocabulary', time: 0 },
  { id: 'reading', label: 'Reading', time: 420 },
  { id: 'listening', label: 'Listening', time: 780 },
  { id: 'grammar', label: 'Grammar', time: 1080 },
  { id: 'exercises', label: 'Exercises', time: 1560 },
  { id: 'revision', label: 'Revision', time: 1980 },
] as const;

export const playbackSpeeds = [
  '0.5x',
  '0.75x',
  '1x',
  '1.25x',
  '1.5x',
  '1.75x',
  '2x',
  '3x',
  '4x',
];
export const qualityOptions = [
  'Auto',
  '140p',
  '240p',
  '360p',
  '480p',
  '720p',
  '1080p',
];

export function getLesson(lessonId?: string) {
  return (
    unitOneLessons.find((lesson) => lesson.id === lessonId) ??
    unitOneLessons[0]!
  );
}
