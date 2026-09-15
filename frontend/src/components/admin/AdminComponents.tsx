import { useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Dialog, EmptyState } from '@/components/ui';
import { Drawer } from '@/components/overlays/Drawer';
import { LoadingSkeleton } from '@/components/feedback/LoadingSkeleton';
import { classes } from '@/utils/classes';

export type AdminStatus =
  'draft' | 'published' | 'archived' | 'pending' | 'reviewed' | 'inactive';

const statusLabels: Record<AdminStatus, string> = {
  draft: 'مسودة',
  published: 'منشور',
  archived: 'مؤرشف',
  pending: 'قيد المراجعة',
  reviewed: 'تمت المراجعة',
  inactive: 'غير مفعّل',
};

export function AdminCard({ className, ...props }: ComponentProps<'article'>) {
  return <article className={classes('admin-card', className)} {...props} />;
}

export function StatusBadge({ status }: { status: AdminStatus }) {
  return (
    <span className="admin-status" data-status={status}>
      {statusLabels[status]}
    </span>
  );
}

export function MetricCard({
  label,
  value = null,
  note,
}: {
  label: string;
  value?: string | number | null;
  note: string;
}) {
  return (
    <AdminCard className="admin-metric">
      <span>{label}</span>
      <strong>{value ?? '—'}</strong>
      <small>{note}</small>
    </AdminCard>
  );
}

export function AnalyticsCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <AdminCard className="admin-analytics-card">
      <h2>{title}</h2>
      {children}
    </AdminCard>
  );
}

export function ChartCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <AnalyticsCard title={title}>
      <div
        className="admin-chart-placeholder"
        role="img"
        aria-label={description}
      >
        {[38, 55, 45, 72, 63, 84, 68].map((height, index) => (
          <span key={index} style={{ blockSize: `${height}%` }} />
        ))}
      </div>
      <p>{description}</p>
      <small>يظهر الرسم الفعلي بعد ربط مصدر البيانات.</small>
    </AnalyticsCard>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'ابحث…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <label className="admin-search" htmlFor={id}>
      <span>بحث</span>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function FilterBar({
  search,
  onSearchChange,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  children?: ReactNode;
}) {
  return (
    <div className="admin-filter-bar">
      <SearchBar value={search} onChange={onSearchChange} />
      {children}
      <button
        type="button"
        className="admin-filter-reset"
        onClick={() => onSearchChange('')}
      >
        مسح البحث
      </button>
    </div>
  );
}

export interface AdminColumn<T> {
  key: string;
  title: string;
  render: (row: T) => ReactNode;
}

export function AdminTable<T>({
  caption,
  columns,
  rows,
  rowKey,
}: {
  caption: string;
  columns: AdminColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}) {
  if (!rows.length)
    return (
      <EmptyState
        title="لا توجد بيانات بعد"
        description="ستظهر السجلات هنا بعد ربط النظام بقاعدة البيانات. لا توجد بيانات تجريبية وهمية."
      />
    );
  return (
    <div
      className="admin-table-scroll"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ActionMenu({ children }: { children?: ReactNode }) {
  return (
    <details className="admin-action-menu">
      <summary>الإجراءات</summary>
      <div>
        {children ?? (
          <button type="button" disabled>
            لا توجد إجراءات متاحة
          </button>
        )}
      </div>
    </details>
  );
}

export function ConfirmationDialog({
  open,
  title,
  description,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p>{description}</p>
      <button className="ui-button" type="button" onClick={onConfirm}>
        تأكيد
      </button>
    </Dialog>
  );
}

export function UploadDialog({
  open,
  onClose,
  title = 'رفع ملف',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <label className="admin-upload-field">
        اختر ملفًا
        <input type="file" />
      </label>
      <p className="admin-boundary-note">
        واجهة تجهيز فقط؛ لا يتم رفع الملف بدون خدمة تخزين وخادم.
      </p>
      <button className="ui-button" type="button" disabled>
        رفع الملف
      </button>
    </Dialog>
  );
}

export function AdminDrawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Drawer open={open} onClose={onClose} title={title}>
      {children}
    </Drawer>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="admin-form-section">
      <legend>{title}</legend>
      <p>{description}</p>
      {children}
    </fieldset>
  );
}

export function AdminLoadingState() {
  return (
    <AdminCard className="admin-state-card">
      <LoadingSkeleton lines={6} />
    </AdminCard>
  );
}

export function AdminErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <AdminCard className="admin-state-card" role="alert">
      <h2>تعذر تحميل البيانات</h2>
      <p>لم يتم ربط مصدر البيانات بعد، أو حدث خطأ أثناء المعاينة.</p>
      <button className="ui-button" type="button" onClick={onRetry}>
        إعادة المحاولة
      </button>
    </AdminCard>
  );
}

export function AdminPagination({
  page = 1,
  totalPages = 1,
  onChange,
}: {
  page?: number;
  totalPages?: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav className="admin-pagination" aria-label="صفحات النتائج">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        السابق
      </button>
      <span aria-live="polite">
        صفحة {page} من {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        التالي
      </button>
    </nav>
  );
}
