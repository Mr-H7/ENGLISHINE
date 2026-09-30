import { Link, NavLink } from 'react-router';
import { assets } from '@/assets/registry';
import { AppIcon } from '@/components/icons/AppIcon';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { Drawer } from '@/components/overlays/Drawer';
import {
  studentMobileNavigation,
  studentNavigation,
} from '@/router/studentNavigation';
import { useSession } from '@/hooks/useSession';
import { useStudentPlatform } from '@/hooks/useStudentPlatform';

function StudentNavLinks({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="التنقل داخل مساحة الطالب" className="student-nav-links">
      {studentNavigation.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end={item.href === '/student/'}
          onClick={onNavigate}
          title={collapsed ? item.label : undefined}
        >
          <AppIcon name={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function StudentIdentity({ compact = false }: { compact?: boolean }) {
  const session = useSession();
  const { profile } = useStudentPlatform();
  const name = profile?.fullName ?? session.user?.displayName ?? 'حساب الطالب';
  return (
    <Link className="student-identity" to="/student/account/" aria-label="فتح حساب الطالب">
      <span className="student-avatar-fallback" aria-hidden="true">
        {name.slice(0, 1)}
      </span>
      {compact ? null : (
        <span>
          <strong>{name}</strong>
          <small>{profile?.grade?.nameAr ?? 'الصف غير محدد'}</small>
        </span>
      )}
    </Link>
  );
}

export function StudentSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside className="student-sidebar" data-collapsed={collapsed}>
      <div className="student-sidebar-brand">
        <Link to="/student/" aria-label="Englishine — مساحة الطالب">
          <img src={assets.logo} alt="Englishine" />
        </Link>
        <button
          type="button"
          className="sidebar-collapse"
          onClick={onToggle}
          aria-label={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
          aria-expanded={!collapsed}
        >
          <AppIcon name="arrow" />
        </button>
      </div>
      <StudentNavLinks collapsed={collapsed} />
      <div className="student-sidebar-footer">
        <StudentIdentity compact={collapsed} />
        <LogoutButton className="student-logout">
          <AppIcon name="logout" />
          <span>تسجيل الخروج</span>
        </LogoutButton>
      </div>
    </aside>
  );
}

export function StudentTopbar({ onOpenMenu, theme, onToggleTheme }: { onOpenMenu: () => void; theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  const session = useSession();
  const { profile } = useStudentPlatform();
  const name = profile?.fullName ?? session.user?.displayName ?? 'طالب Englishine';
  return (
    <header className="student-topbar">
      <button
        className="student-mobile-menu"
        type="button"
        onClick={onOpenMenu}
        aria-label="فتح قائمة الطالب"
      >
        <AppIcon name="menu" />
      </button>
      <Link className="student-mobile-brand" to="/student/" aria-label="الرئيسية">
        <img src={assets.logo} alt="Englishine" />
      </Link>
      <div className="student-topbar-greeting">
        <strong>مرحبًا، {name}</strong>
        <small>{profile?.grade?.nameAr ?? 'اختر صفك الدراسي للبدء'}</small>
      </div>
      <button type="button" className="sx-theme-toggle" onClick={onToggleTheme} aria-pressed={theme === 'dark'} aria-label="الوضع الداكن">
        {theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
      </button>
      <StudentIdentity compact />
    </header>
  );
}

export function StudentMobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer open={open} onClose={onClose} title="مساحة الطالب">
      <div className="student-drawer-brand">
        <img src={assets.logo} alt="Englishine" />
      </div>
      <StudentNavLinks onNavigate={onClose} />
      <Link className="student-free-shortcut" to="/student/free/" onClick={onClose}>
        <AppIcon name="play" />
        <span>
          <strong>المحتوى المجاني</strong>
          <small>فيديوهات وعينات متاحة لحسابك</small>
        </span>
      </Link>
      <LogoutButton className="student-logout" onComplete={onClose}>
        <AppIcon name="logout" />
        <span>تسجيل الخروج</span>
      </LogoutButton>
    </Drawer>
  );
}

export function StudentMobileNav({
  onOpenMenu,
}: {
  onOpenMenu: () => void;
}) {
  return (
    <nav className="student-mobile-nav" aria-label="التنقل السريع">
      {studentMobileNavigation.map((item) => (
        <NavLink key={item.href} to={item.href} end={item.href === '/student/'}>
          <AppIcon name={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      ))}
      <button type="button" onClick={onOpenMenu} aria-label="عرض المزيد">
        <AppIcon name="more" />
        <span>المزيد</span>
      </button>
    </nav>
  );
}
