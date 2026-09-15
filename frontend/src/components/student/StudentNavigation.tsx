import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { assets } from '@/assets/registry';
import { AppIcon } from '@/components/icons/AppIcon';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { Drawer } from '@/components/overlays/Drawer';
import { studentNavigation } from '@/router/studentNavigation';
import { useSession } from '@/hooks/useSession';
import { useToast } from '@/hooks/useToast';

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
          end
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
          <img src={assets.logo} alt="" />
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
      <LogoutButton className="student-logout">
        <AppIcon name="logout" />
        <span>تسجيل الخروج</span>
      </LogoutButton>
    </aside>
  );
}

export function StudentTopbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const [query, setQuery] = useState('');
  const toast = useToast();
  const navigate = useNavigate();
  const session = useSession();
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
      <form
        className="student-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          toast.notify(
            query.trim()
              ? 'البحث يحتاج ربط بيانات الطالب أولًا.'
              : 'اكتب كلمة للبحث.',
          );
        }}
      >
        <AppIcon name="search" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="ابحث في دروسك"
          placeholder="ابحث في دروسك"
        />
      </form>
      <button
        className="current-course-chip"
        type="button"
        onClick={() => navigate('/student/courses/')}
      >
        <span>الكورس الحالي</span>
        <strong>غير محدد</strong>
      </button>
      <button
        className="topbar-icon-button"
        type="button"
        onClick={() => navigate('/student/notifications/')}
        aria-label="الإشعارات"
      >
        <AppIcon name="notifications" />
      </button>
      <button
        className="student-avatar-button"
        type="button"
        onClick={() => navigate('/student/account/')}
        aria-label="الملف الشخصي"
      >
        <span>{session.user?.displayName.slice(0, 1) ?? 'ط'}</span>
        <span className="student-avatar-copy">
          <strong>{session.user?.displayName ?? 'حساب الطالب'}</strong>
          <small>{session.user?.email ?? ''}</small>
        </span>
      </button>
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
        <img src={assets.logo} alt="" />
        <strong>Englishine</strong>
      </div>
      <StudentNavLinks onNavigate={onClose} />
      <LogoutButton className="student-logout" onComplete={onClose}>
        <AppIcon name="logout" />
        <span>تسجيل الخروج</span>
      </LogoutButton>
    </Drawer>
  );
}
