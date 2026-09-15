import { ButtonLink, ErrorState } from '@/components/ui';
export function RouteErrorPage() {
  return (
    <main className="ui-container ui-main">
      <ErrorState />
      <ButtonLink to="/">العودة للرئيسية</ButtonLink>
    </main>
  );
}
