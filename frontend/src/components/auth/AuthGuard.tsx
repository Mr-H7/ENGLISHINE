import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { RouteLoadingPage } from '@/pages/RouteLoadingPage';
import { useSession } from '@/hooks/useSession';
import type { StudentIdentity } from '@/services/contracts';

type Role = StudentIdentity['roles'][number];

export function AuthGuard({
  roles,
  children,
}: {
  roles: readonly Role[];
  children: ReactNode;
}) {
  const session = useSession();
  const location = useLocation();

  if (session.status === 'loading' || session.status === 'unconfigured') {
    return <RouteLoadingPage />;
  }
  if (session.status !== 'authenticated' || !session.user) {
    return (
      <Navigate
        to="/login/"
        replace
        state={{
          returnTo: `${location.pathname}${location.search}${location.hash}`,
        }}
      />
    );
  }
  if (!roles.some((role) => session.user.roles.includes(role))) {
    return <Navigate to="/" replace />;
  }
  return children;
}
