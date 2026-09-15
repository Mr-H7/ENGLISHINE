import type { ReactNode } from 'react';
import { Footer, Navbar } from '@/components/shell/ShellNavigation';
import { ScrollManager } from '@/components/ScrollManager';
import { platformNavigation } from '@/router/manifest';
import foundationStyles from '@/styles/index.css?inline';
import shellStyles from '@/styles/shell.css?inline';

export function ShellFrame({
  children,
  footer = true,
  layout,
}: {
  children: ReactNode;
  footer?: boolean;
  layout: string;
}) {
  return (
    <>
      <style>{foundationStyles}</style>
      <style>{shellStyles}</style>
      <div className="ui-app-shell" data-layout={layout}>
        <a className="ui-skip" href="#main-content">
          انتقل للمحتوى
        </a>
        <ScrollManager />
        <Navbar items={platformNavigation} />
        {children}
        {footer ? <Footer items={platformNavigation} /> : null}
      </div>
    </>
  );
}
