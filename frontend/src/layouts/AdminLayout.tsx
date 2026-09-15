import { Outlet } from 'react-router';
import adminStyles from '@/styles/admin-app.css?inline';
import { Container, ContentWrapper } from '@/components/layout/Container';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { PageTransition } from '@/components/PageTransition';
import { ScrollManager } from '@/components/ScrollManager';
import { Navbar, Sidebar } from '@/components/shell/ShellNavigation';
import { adminNavigation } from '@/router/manifest';

export function Component() {
  const topNavigation = [
    { href: '/admin/', label: 'نظرة عامة' },
    { href: '/admin/profile/', label: 'الملف الشخصي' },
    { href: '/', label: 'عرض الموقع' },
  ];
  return (
    <AuthGuard roles={['SUPER_ADMIN', 'ADMIN', 'TEACHER']}>
      <div className="ui-app-shell" data-layout="admin">
        <style>{adminStyles}</style>
        <a className="ui-skip" href="#main-content">
          انتقل للمحتوى
        </a>
        <ScrollManager />
        <Navbar
          items={topNavigation}
          actions={
            <LogoutButton className="ui-button ui-button-secondary">
              تسجيل الخروج
            </LogoutButton>
          }
        />
        <Container className="ui-workspace">
          <Sidebar items={adminNavigation} label="أقسام الإدارة" />
          <main id="main-content" className="ui-main">
            <ContentWrapper>
              <PageTransition>
                <Outlet />
              </PageTransition>
            </ContentWrapper>
          </main>
        </Container>
      </div>
    </AuthGuard>
  );
}
