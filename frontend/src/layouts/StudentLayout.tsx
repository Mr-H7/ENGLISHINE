import { useState } from 'react';
import { Outlet } from 'react-router';
import foundationStyles from '@/styles/index.css?inline';
import shellStyles from '@/styles/shell.css?inline';
import applicationStyles from '@/styles/student-app.css?inline';
import { ScrollManager } from '@/components/ScrollManager';
import { AuthGuard } from '@/components/auth/AuthGuard';
import {
  StudentMobileDrawer,
  StudentSidebar,
  StudentTopbar,
} from '@/components/student/StudentNavigation';
import { GradeOnboarding } from '@/components/student/GradeOnboarding';
import { StudentPlatformProvider } from '@/providers/StudentPlatformProvider';

export function Component() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <AuthGuard roles={['STUDENT']}>
      <StudentPlatformProvider>
      <>
        <style>{foundationStyles}</style>
        <style>{shellStyles}</style>
        <style>{applicationStyles}</style>
        <ScrollManager />
        <div className="student-app" data-sidebar-collapsed={collapsed}>
          <a className="ui-skip" href="#student-main">
            انتقل للمحتوى
          </a>
          <StudentSidebar
            collapsed={collapsed}
            onToggle={() => setCollapsed((current) => !current)}
          />
          <div className="student-app-column">
            <StudentTopbar onOpenMenu={() => setMobileOpen(true)} />
            <main id="student-main" className="student-main">
              <GradeOnboarding>
                <Outlet />
              </GradeOnboarding>
            </main>
          </div>
          <StudentMobileDrawer
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
          />
        </div>
      </>
      </StudentPlatformProvider>
    </AuthGuard>
  );
}
