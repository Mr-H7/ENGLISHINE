import type { AppIconName } from '@/components/icons/AppIcon';

export const studentNavigation: {
  href: string;
  label: string;
  icon: AppIconName;
}[] = [
  { href: '/student/', label: 'الرئيسية', icon: 'dashboard' },
  { href: '/student/courses/', label: 'كورساتي', icon: 'courses' },
  { href: '/student/explore/', label: 'استكشف الكورسات', icon: 'courses' },
  { href: '/student/free/', label: 'محتوى مجاني', icon: 'courses' },
  { href: '/student/homework/', label: 'الواجب', icon: 'homework' },
  { href: '/student/exams/', label: 'الاختبارات', icon: 'exams' },
  { href: '/student/progress/', label: 'التقدم', icon: 'progress' },
  { href: '/student/account/', label: 'الحساب', icon: 'profile' },
];
