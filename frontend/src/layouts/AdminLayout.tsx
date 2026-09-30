import { Outlet } from 'react-router';
import foundationStyles from '@/styles/index.css?inline';
import shellStyles from '@/styles/shell.css?inline';
import adminStyles from '@/styles/admin-app.css?inline';
import { Container, ContentWrapper } from '@/components/layout/Container';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { PageTransition } from '@/components/PageTransition';
import { ScrollManager } from '@/components/ScrollManager';
import { Navbar, Sidebar } from '@/components/shell/ShellNavigation';
import { ButtonLink } from '@/components/ui';
import { adminNavigation } from '@/router/manifest';

export function Component() {
  return (
    <AuthGuard roles={['SUPER_ADMIN', 'ADMIN', 'TEACHER']}>
      <div className="ui-app-shell" data-layout="admin" dir="rtl">
        <style>{foundationStyles}</style>
        <style>{shellStyles}</style>
        <style>{adminStyles}</style>
        <a className="ui-skip" href="#main-content">
          انتقل للمحتوى
        </a>
        <ScrollManager />
        <Navbar
          items={adminNavigation}
          brandTo="/admin/"
          actions={
            <div className="admin-nav-actions">
              <ButtonLink to="/" className="ui-button-secondary">
                عرض الموقع
              </ButtonLink>
              <LogoutButton className="ui-button ui-button-secondary">
                تسجيل الخروج
              </LogoutButton>
            </div>
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
