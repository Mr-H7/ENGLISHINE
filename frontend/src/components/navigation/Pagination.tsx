import { Button } from '@/components/ui';

export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav className="ui-pagination" aria-label="التنقل بين الصفحات">
      <Button
        variant="secondary"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        السابق
      </Button>
      <span aria-live="polite">
        صفحة {page} من {pageCount}
      </span>
      <Button
        variant="secondary"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        التالي
      </Button>
    </nav>
  );
}
