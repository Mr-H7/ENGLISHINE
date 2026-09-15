import { Card, PageHeader } from '@/components/ui';
import type { LegacyRoute } from '@/router/manifest';
export function MigrationBoundaryPage({ route }: { route: LegacyRoute }) {
  const base =
    import.meta.env.VITE_LEGACY_SITE_URL || 'https://englishine.vercel.app';
  const legacy = new URL(route.path, base);
  return (
    <Card className="ui-stack">
      <PageHeader
        title={route.title}
        description="هذه الصفحة لم تُنقل إلى React بعد. النسخة الحالية تظل متاحة بدون تغيير."
      />
      <p className="ui-muted">
        هذه بيئة تأسيس للتطوير فقط، وليست بديلًا للمنصة الحالية.
      </p>
      <a className="ui-button" href={legacy.href}>
        افتح الصفحة الحالية
      </a>
    </Card>
  );
}
