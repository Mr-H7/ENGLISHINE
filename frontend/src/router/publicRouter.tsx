import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { routes } from '@/router/manifest';
import { RouteErrorPage } from '@/pages/RouteErrorPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RouteLoadingPage } from '@/pages/RouteLoadingPage';
import { LessonCanonicalRedirect } from '@/router/canonicalRedirects';

const MigrationBoundaryPage = lazy(() =>
  import('@/pages/MigrationBoundaryPage').then((module) => ({
    default: module.MigrationBoundaryPage,
  })),
);

const migrated = [
  { path: '/', lazy: () => import('@/pages/public/HomePage') },
  { path: '/about.html', lazy: () => import('@/pages/public/AboutPage') },
  { path: '/about', lazy: () => import('@/pages/public/AboutPage') },
  { path: '/contact', lazy: () => import('@/pages/public/ContactPage') },
  { path: '/courses.html', element: <Navigate to="/student/explore/" replace /> },
  { path: '/contact.html', lazy: () => import('@/pages/public/ContactPage') },
  {
    path: '/certifications.html',
    lazy: () => import('@/pages/public/CertificationsPage'),
  },
  { path: '/videos.html', element: <Navigate to="/student/free/" replace /> },
  { path: '/pricing.html', element: <Navigate to="/student/explore/" replace /> },
  {
    path: '/testimonials.html',
    lazy: () => import('@/pages/public/TestimonialsPage'),
  },
  {
    path: '/scholarships.html',
    lazy: () => import('@/pages/public/ScholarshipsPage'),
  },
  {
    path: '/private-booking/',
    lazy: () => import('@/pages/public/PrivateBookingPage'),
  },
  { path: '/payment/', element: <Navigate to="/student/account/" replace /> },
  { path: '/checkout/', element: <Navigate to="/student/account/" replace /> },
  { path: '/level-test/', element: <Navigate to="/contact" replace /> },
  { path: '/live/', element: <Navigate to="/student/" replace /> },
] as const;

const authRoutes = [
  { path: '/login/', lazy: () => import('@/pages/auth/LoginPage') },
  { path: '/signup/', lazy: () => import('@/pages/auth/SignupPage') },
  {
    path: '/forgot-password/',
    lazy: () => import('@/pages/auth/ForgotPasswordPage'),
  },
  {
    path: '/reset-password/',
    lazy: () => import('@/pages/auth/ResetPasswordPage'),
  },
  { path: '/activation/', lazy: () => import('@/pages/auth/ActivationPage') },
  {
    path: '/account/activation/',
    lazy: () => import('@/pages/auth/ActivationPage'),
  },
];

const studentSections = [
  'assignments',
  'certificates',
  'notifications',
  'support',
] as const;
const studentRoutes = [
  {
    path: '/student/',
    lazy: () => import('@/pages/student/StudentDashboardPage'),
  },
  {
    path: '/student/courses/',
    lazy: async () => {
      const module = await import('@/pages/student/StudentCatalogPages');
      return { Component: module.MyCoursesConnectedPage };
    },
  },
  {
    path: '/student/courses/:courseId/',
    lazy: async () => {
      const module = await import('@/pages/student/StudentCatalogPages');
      return { Component: module.StudentCourseDetailsPage };
    },
  },
  {
    path: '/student/homework/',
    lazy: async () => {
      const module = await import('@/pages/student/StudentCatalogPages');
      return { Component: module.StudentHomeworkPage };
    },
  },
  {
    path: '/student/progress/',
    lazy: async () => {
      const module = await import('@/pages/student/StudentCatalogPages');
      return { Component: module.StudentProgressPage };
    },
  },
  {
    path: '/student/exams/',
    lazy: async () => {
      const module = await import('@/pages/student/StudentCatalogPages');
      return { Component: module.StudentExamsPage };
    },
  },
  {
    path: '/student/explore/',
    lazy: async () => {
      const module = await import('@/pages/student/StudentCatalogPages');
      return { Component: module.ExploreCoursesPage };
    },
  },
  {
    path: '/student/free/',
    lazy: async () => {
      const module = await import('@/pages/student/StudentCatalogPages');
      return { Component: module.FreeContentPage };
    },
  },
  {
    path: '/student/account/',
    lazy: async () => {
      const module = await import('@/pages/student/StudentCatalogPages');
      return { Component: module.StudentAccountPage };
    },
  },
  {
    path: '/student/lesson/:lessonId/',
    lazy: async () => {
      const module = await import('@/pages/student/StudentCatalogPages');
      return { Component: module.StudentLessonAccessPage };
    },
  },
  {
    path: '/student/lesson/:lessonId',
    lazy: async () => {
      const module = await import('@/pages/student/StudentCatalogPages');
      return { Component: module.StudentLessonAccessPage };
    },
  },
  ...studentSections.map((page) => ({
    path: `/student/${page}/`,
    lazy: () => import('@/pages/student/StudentPlaceholderPage'),
  })),
];
const adminRouteSpecs = [
  { path: '/admin/', page: 'AdminDashboardPage' },
  { path: '/admin/students/', page: 'AdminStudentsPage' },
  { path: '/admin/teachers/', page: 'AdminTeachersPage' },
  { path: '/admin/courses/', page: 'AdminCoursesPage' },
  { path: '/admin/units/', page: 'AdminUnitsPage' },
  { path: '/admin/lessons/', page: 'AdminLessonsPage' },
  { path: '/admin/videos/', page: 'AdminLessonsPage' },
  { path: '/admin/homework/', page: 'AdminHomeworkPage' },
  { path: '/admin/assignments/', page: 'AdminAssignmentsPage' },
  { path: '/admin/exams/', page: 'AdminExamsPage' },
  { path: '/admin/announcements/', page: 'AdminAnnouncementsPage' },
  { path: '/admin/notifications/', page: 'AdminNotificationsPage' },
  { path: '/admin/codes/', page: 'AdminCodesPage' },
  { path: '/admin/bookings/', page: 'AdminBookingsPage' },
  { path: '/admin/analytics/', page: 'AdminAnalyticsPage' },
  { path: '/admin/comments/', page: 'AdminCommentsPage' },
  { path: '/admin/leaderboard/', page: 'AdminLeaderboardPage' },
  { path: '/admin/settings/', page: 'AdminSettingsPage' },
  { path: '/admin/profile/', page: 'AdminProfilePage' },
] as const;

const adminRoutes = adminRouteSpecs.map(({ path, page }) => ({
  path,
  lazy: async () => {
    const module = await import('@/pages/admin/AdminPages');
    return { Component: module[page] };
  },
}));

const studentRouteAliases = [
  { path: '/login', to: '/login/' },
  { path: '/signup', to: '/signup/' },
  { path: '/contact/', to: '/contact' },
  { path: '/about/', to: '/about' },
  { path: '/student', to: '/student/' },
  { path: '/student/courses', to: '/student/courses/' },
  { path: '/student/explore', to: '/student/explore/' },
  { path: '/student/free', to: '/student/free/' },
  { path: '/student/homework', to: '/student/homework/' },
  { path: '/student/exams', to: '/student/exams/' },
  { path: '/student/progress', to: '/student/progress/' },
  { path: '/student/account', to: '/student/account/' },
  { path: '/dashboard', to: '/student/' },
  { path: '/dashboard/', to: '/student/' },
  { path: '/Dashboard', to: '/student/' },
  { path: '/Dashboard/', to: '/student/' },
  { path: '/courses', to: '/student/courses/' },
  { path: '/courses/', to: '/student/courses/' },
  { path: '/lessons', to: '/student/courses/' },
  { path: '/lessons/', to: '/student/courses/' },
  { path: '/homework', to: '/student/homework/' },
  { path: '/homework/', to: '/student/homework/' },
  { path: '/exams', to: '/student/exams/' },
  { path: '/exams/', to: '/student/exams/' },
  { path: '/student/profile/', to: '/student/account/' },
] as const;

const migratedPaths = new Set<string>([
  ...migrated.map((route) => route.path),
  ...authRoutes.map((route) => route.path),
  ...studentRoutes.map((route) => route.path),
  ...adminRoutes.map((route) => route.path),
]);

const remainingLayouts = {
  student: () => import('@/layouts/StudentLayout'),
  marketing: () => import('@/layouts/MarketingLayout'),
};

export const router = createBrowserRouter([
  ...migrated.map((route) => ({ ...route, errorElement: <RouteErrorPage /> })),
  { path: '/index.html', element: <Navigate to="/" replace /> },
  ...studentRouteAliases.map(({ path, to }) => ({
    path,
    element: <Navigate to={to} replace />,
  })),
  { path: '/lesson/:lessonId', element: <LessonCanonicalRedirect /> },
  { path: '/lesson/:lessonId/', element: <LessonCanonicalRedirect /> },
  {
    lazy: () => import('@/layouts/AuthLayout'),
    errorElement: <RouteErrorPage />,
    children: authRoutes,
  },
  {
    lazy: () => import('@/layouts/StudentLayout'),
    errorElement: <RouteErrorPage />,
    children: studentRoutes,
  },
  {
    lazy: () => import('@/layouts/AdminLayout'),
    errorElement: <RouteErrorPage />,
    children: adminRoutes,
  },
  ...Object.entries(remainingLayouts).map(([kind, loadLayout]) => ({
    lazy: loadLayout,
    errorElement: <RouteErrorPage />,
    children: routes
      .filter(
        (route) => route.layout === kind && !migratedPaths.has(route.path),
      )
      .map((route) => ({
        path: route.path,
        element: (
          <Suspense fallback={<RouteLoadingPage />}>
            <MigrationBoundaryPage route={route} />
          </Suspense>
        ),
      })),
  })),
  { path: '*', element: <NotFoundPage /> },
]);
