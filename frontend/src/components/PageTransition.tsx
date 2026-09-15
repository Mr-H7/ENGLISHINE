import type { ReactNode } from 'react';
import { useLocation } from 'react-router';

export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <div className="ui-page-transition" key={location.pathname}>
      {children}
    </div>
  );
}
