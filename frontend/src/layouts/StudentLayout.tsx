import { useState } from 'react';
import { Outlet } from 'react-router';
import foundationStyles from '@/styles/index.css?inline';
import shellStyles from '@/styles/shell.css?inline';
import applicationStyles from '@/styles/student-app.css?inline';
import experienceStyles from '@/styles/student-experience.css?inline';
import { ScrollManager } from '@/components/ScrollManager';
import { AuthGuard } from '@/components/auth/AuthGuard';
import {
  StudentMobileDrawer,
  StudentMobileNav,
  StudentSidebar,
  StudentTopbar,
} from '@/components/student/StudentNavigation';
import { GradeOnboarding } from '@/components/student/GradeOnboarding';
import { StudentPlatformProvider } from '@/providers/StudentPlatformProvider';

export function Component() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem('englishine-student-theme') === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem('englishine-student-theme', next); } catch { /* In-memory preference still works when storage is unavailable. */ }
  }
  return (
    <AuthGuard roles={['STUDENT']}>
      <StudentPlatformProvider>
      <>
        <style>{foundationStyles}</style>
        <style>{shellStyles}</style>
        <style>{applicationStyles}</style>
        <style>{experienceStyles}</style>
        <ScrollManager />
        <div className="student-app student-experience" data-student-theme={theme} data-sidebar-collapsed={collapsed}>
          <a className="ui-skip" href="#student-main">
            انتقل للمحتوى
          </a>
          <StudentSidebar
            collapsed={collapsed}
            onToggle={() => setCollapsed((current) => !current)}
          />
          <div className="student-app-column">
            <StudentTopbar onOpenMenu={() => setMobileOpen(true)} theme={theme} onToggleTheme={toggleTheme} />
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
          <StudentMobileNav onOpenMenu={() => setMobileOpen(true)} />
        </div>
      </>
      </StudentPlatformProvider>
    </AuthGuard>
  );
}
