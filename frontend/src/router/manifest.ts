export type LayoutKind = 'marketing' | 'student' | 'admin' | 'auth';
export interface LegacyRoute {
  path: string;
  source: string;
  title: string;
  layout: LayoutKind;
}
export const routes: LegacyRoute[] = [
  { path: '/', source: 'index.html', title: 'الرئيسية', layout: 'marketing' },
  {
    path: '/courses.html',
    source: 'courses.html',
    title: 'البرامج',
    layout: 'marketing',
  },
  {
    path: '/videos.html',
    source: 'videos.html',
    title: 'مكتبة الفيديو',
    layout: 'marketing',
  },
  {
    path: '/pricing.html',
    source: 'pricing.html',
    title: 'الاشتراكات',
    layout: 'marketing',
  },
  {
    path: '/about.html',
    source: 'about.html',
    title: 'عن مستر أحمد',
    layout: 'marketing',
  },
  {
    path: '/certifications.html',
    source: 'certifications.html',
    title: 'الشهادات',
    layout: 'marketing',
  },
  {
    path: '/contact.html',
    source: 'contact.html',
    title: 'تواصل معنا',
    layout: 'marketing',
  },
  {
    path: '/testimonials.html',
    source: 'testimonials.html',
    title: 'آراء الطلاب',
    layout: 'marketing',
  },
  {
    path: '/scholarships.html',
    source: 'scholarships.html',
    title: 'الدعم التعليمي',
    layout: 'marketing',
  },
  {
    path: '/login/',
    source: 'login/index.html',
    title: 'تسجيل الدخول',
    layout: 'auth',
  },
  {
    path: '/signup/',
    source: 'signup/index.html',
    title: 'إنشاء حساب',
    layout: 'auth',
  },
  {
    path: '/payment/',
    source: 'payment/index.html',
    title: 'الدفع',
    layout: 'student',
  },
  {
    path: '/checkout/',
    source: 'checkout/index.html',
    title: 'ملخص الاشتراك',
    layout: 'student',
  },
  {
    path: '/activation/',
    source: 'activation/index.html',
    title: 'تفعيل الكود',
    layout: 'student',
  },
  {
    path: '/account/activation/',
    source: 'account/activation/index.html',
    title: 'تفعيل الكود',
    layout: 'student',
  },
  {
    path: '/account/devices/',
    source: 'account/devices/index.html',
    title: 'الأجهزة',
    layout: 'student',
  },
  {
    path: '/private-booking/',
    source: 'private-booking/index.html',
    title: 'حجز خاص أو مجموعة صغيرة',
    layout: 'student',
  },
  {
    path: '/level-test/',
    source: 'level-test/index.html',
    title: 'اختبار تحديد المستوى',
    layout: 'student',
  },
  {
    path: '/live/',
    source: 'live/index.html',
    title: 'الجلسات المباشرة',
    layout: 'student',
  },
  {
    path: '/lesson/',
    source: 'lesson/index.html',
    title: 'الدرس',
    layout: 'student',
  },
  {
    path: '/admin/',
    source: 'admin/index.html',
    title: 'نظرة عامة',
    layout: 'admin',
  },
  {
    path: '/admin/courses/',
    source: 'admin/courses/index.html',
    title: 'إدارة البرامج',
    layout: 'admin',
  },
  {
    path: '/admin/videos/',
    source: 'admin/videos/index.html',
    title: 'إدارة الفيديو',
    layout: 'admin',
  },
  {
    path: '/admin/homework/',
    source: 'admin/homework/index.html',
    title: 'مراجعة الواجبات',
    layout: 'admin',
  },
  {
    path: '/admin/students/',
    source: 'admin/students/index.html',
    title: 'الطلاب',
    layout: 'admin',
  },
  {
    path: '/admin/analytics/',
    source: 'admin/analytics/index.html',
    title: 'التحليلات',
    layout: 'admin',
  },
  {
    path: '/admin/codes/',
    source: 'admin/codes/index.html',
    title: 'الأكواد',
    layout: 'admin',
  },
  {
    path: '/admin/notifications/',
    source: 'admin/notifications/index.html',
    title: 'الإشعارات',
    layout: 'admin',
  },
  {
    path: '/admin/comments/',
    source: 'admin/comments/index.html',
    title: 'التعليقات',
    layout: 'admin',
  },
  {
    path: '/admin/leaderboard/',
    source: 'admin/leaderboard/index.html',
    title: 'الطلاب المتميزون',
    layout: 'admin',
  },
];
export const platformNavigation = [
  { href: '/', label: 'الرئيسية' },
  { href: '/about', label: 'عن مستر أحمد' },
  { href: '/contact', label: 'تواصل معنا' },
  { href: '/login/', label: 'تسجيل الدخول' },
  { href: '/signup/', label: 'إنشاء حساب' },
];
export const adminNavigation = [
  { href: '/admin/', label: 'نظرة عامة' },
  { href: '/admin/students/', label: 'الطلاب' },
  { href: '/admin/teachers/', label: 'المدرسون' },
  { href: '/admin/courses/', label: 'الكورسات' },
  { href: '/admin/units/', label: 'الوحدات' },
  { href: '/admin/lessons/', label: 'الدروس' },
  { href: '/admin/homework/', label: 'الواجبات' },
  { href: '/admin/assignments/', label: 'التكليفات' },
  { href: '/admin/exams/', label: 'الاختبارات' },
  { href: '/admin/announcements/', label: 'الإعلانات' },
  { href: '/admin/notifications/', label: 'الإشعارات' },
  { href: '/admin/codes/', label: 'أكواد التفعيل' },
  { href: '/admin/bookings/', label: 'الحجوزات' },
  { href: '/admin/analytics/', label: 'التحليلات' },
  { href: '/admin/comments/', label: 'التعليقات' },
  { href: '/admin/leaderboard/', label: 'الطلاب المتميزون' },
  { href: '/admin/settings/', label: 'الإعدادات' },
  { href: '/admin/profile/', label: 'الملف الشخصي' },
];
