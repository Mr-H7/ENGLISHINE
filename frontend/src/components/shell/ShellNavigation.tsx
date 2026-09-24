import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { assets } from '@/assets/registry';
import { Button } from '@/components/ui';
import { Drawer } from '@/components/overlays/Drawer';
import { Container } from '@/components/layout/Container';
import { useSession } from '@/hooks/useSession';
import type { NavigationItem } from '@/types/platform';

export function ShellBrand({ homeTo }: { homeTo?: string } = {}) {
  const session = useSession();
  const href =
    homeTo ??
    (session.status === 'authenticated'
      ? session.user.roles.some((role) => role !== 'STUDENT')
        ? '/admin/'
        : '/student/'
      : '/');
  return (
    <Link to={href} className="ui-brand">
      <img src={assets.logo} width="44" height="44" alt="" />
      <span>
        <strong lang="en" dir="ltr">
          Englishine
        </strong>
        <small>MR AHMED ABO MAZEN</small>
      </span>
    </Link>
  );
}

function NavItems({
  items,
  onNavigate,
}: {
  items: NavigationItem[];
  onNavigate?: () => void;
}) {
  return (
    <>
      {items.map((item) => (
        <NavLink key={item.href} to={item.href} end onClick={onNavigate}>
          {item.label}
        </NavLink>
      ))}
    </>
  );
}

export function Navbar({
  items,
  actions,
  brandTo,
}: {
  items: NavigationItem[];
  actions?: ReactNode;
  brandTo?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="ui-navbar">
      <Container className="ui-nav-row">
        <ShellBrand homeTo={brandTo} />
        <nav className="ui-nav-links" aria-label="التنقل الرئيسي">
          <NavItems items={items} />
        </nav>
        {actions}
        <Button
          className="ui-menu-toggle"
          variant="secondary"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          القائمة
        </Button>
      </Container>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="القائمة الرئيسية"
      >
        <nav className="ui-mobile-nav" aria-label="التنقل الرئيسي للهاتف">
          <NavItems items={items} onNavigate={() => setOpen(false)} />
          {actions}
        </nav>
      </Drawer>
    </header>
  );
}

export function Sidebar({
  items,
  label = 'التنقل الجانبي',
}: {
  items: NavigationItem[];
  label?: string;
}) {
  return (
    <aside className="ui-sidebar">
      <nav aria-label={label}>
        <NavItems items={items} />
      </nav>
    </aside>
  );
}

export function Footer({ items }: { items: NavigationItem[] }) {
  return (
    <footer className="ui-footer">
      <Container className="ui-stack">
        <ShellBrand />
        <nav aria-label="روابط التذييل" className="ui-footer-links">
          {items.map((item) => (
            <Link key={item.href} to={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </Container>
    </footer>
  );
}
