import { ButtonLink, EmptyState } from '@/components/ui';
export function NotFoundPage() {
  return (
    <main className="ui-container ui-main">
      <EmptyState title="الصفحة غير موجودة">
        <ButtonLink to="/">العودة للرئيسية</ButtonLink>
      </EmptyState>
    </main>
  );
}
