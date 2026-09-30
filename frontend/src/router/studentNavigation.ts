import type { AppIconName } from '@/components/icons/AppIcon';

export const studentNavigation: {
  href: string;
  label: string;
  icon: AppIconName;
}[] = [
  { href: '/student/', label: 'الرئيسية', icon: 'dashboard' },
  { href: '/student/courses/', label: 'كورساتي', icon: 'courses' },
  { href: '/student/explore/', label: 'استكشف', icon: 'search' },
  { href: '/student/homework/', label: 'الواجبات', icon: 'homework' },
  { href: '/student/exams/', label: 'الاختبارات', icon: 'exams' },
  { href: '/student/progress/', label: 'مسار التقدم', icon: 'progress' },
  { href: '/student/account/', label: 'الحساب', icon: 'profile' },
];

export const studentMobileNavigation = [
  { href: '/student/', label: 'الرئيسية', icon: 'dashboard' as const },
  { href: '/student/courses/', label: 'كورساتي', icon: 'courses' as const },
  { href: '/student/homework/', label: 'الواجبات', icon: 'homework' as const },
  { href: '/student/progress/', label: 'تقدمي', icon: 'progress' as const },
];
