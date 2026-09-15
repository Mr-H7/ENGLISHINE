import { Container } from '@/components/layout/Container';
import { LoadingSkeleton } from '@/components/feedback/LoadingSkeleton';

export function RouteLoadingPage() {
  return (
    <Container>
      <main className="ui-main" aria-label="جارٍ تحميل الصفحة">
        <LoadingSkeleton lines={4} />
      </main>
    </Container>
  );
}
