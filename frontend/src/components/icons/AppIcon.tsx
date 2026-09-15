import type { SVGProps } from 'react';

export type AppIconName =
  | 'dashboard'
  | 'courses'
  | 'homework'
  | 'assignments'
  | 'exams'
  | 'certificates'
  | 'progress'
  | 'notifications'
  | 'profile'
  | 'support'
  | 'logout'
  | 'search'
  | 'menu'
  | 'play'
  | 'calendar'
  | 'activity'
  | 'subscription'
  | 'arrow';

const paths: Record<AppIconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  courses: (
    <>
      <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v18H7.5A3.5 3.5 0 0 0 4 23.5z" />
      <path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v18h3.5a3.5 3.5 0 0 1 3.5 3.5z" />
    </>
  ),
  homework: (
    <>
      <path d="M9 5h10v16H5V9z" />
      <path d="M9 5v4H5M9 13h6M9 17h6" />
    </>
  ),
  assignments: (
    <>
      <rect x="4" y="4" width="16" height="17" rx="2" />
      <path d="M9 3h6v4H9zM8 12h8M8 16h6" />
    </>
  ),
  exams: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  certificates: (
    <>
      <path d="M6 3h12v14H6zM9 8h6M9 12h6" />
      <path d="m9 17-1 5 4-2 4 2-1-5" />
    </>
  ),
  progress: (
    <>
      <path d="M4 19V9M10 19V5M16 19v-8M22 19H2" />
    </>
  ),
  notifications: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9zM10 21h4" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  support: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.2.9-1.2 1.8M12 17h.01" />
    </>
  ),
  logout: (
    <>
      <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </>
  ),
  play: <path d="m9 7 8 5-8 5z" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  activity: <path d="M3 12h4l2-6 4 12 2-6h6" />,
  subscription: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  arrow: <path d="m9 6 6 6-6 6" />,
};

export function AppIcon({
  name,
  ...props
}: { name: AppIconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
