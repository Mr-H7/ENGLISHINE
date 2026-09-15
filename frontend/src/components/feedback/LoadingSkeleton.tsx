export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="ui-skeleton" role="status" aria-label="جارٍ تحميل المحتوى">
      {Array.from({ length: Math.max(1, lines) }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}
