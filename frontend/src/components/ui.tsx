import { useEffect, useId, useRef } from 'react';
import type { ReactNode, ComponentProps, InputHTMLAttributes } from 'react';
import { Link } from 'react-router';
import { classes } from '@/utils/classes';

export function Button({
  className,
  variant = 'primary',
  type = 'button',
  ...props
}: ComponentProps<'button'> & { variant?: 'primary' | 'secondary' }) {
  return (
    <button
      type={type}
      className={classes(
        'ui-button',
        variant === 'secondary' && 'ui-button-secondary',
        className,
      )}
      {...props}
    />
  );
}
export function ButtonLink({
  className,
  ...props
}: ComponentProps<typeof Link>) {
  return <Link className={classes('ui-button', className)} {...props} />;
}
export function Card({ className, ...props }: ComponentProps<'article'>) {
  return <article className={classes('ui-card', className)} {...props} />;
}
export function Badge({ className, ...props }: ComponentProps<'span'>) {
  return <span className={classes('ui-badge', className)} {...props} />;
}
export function Input({
  label,
  error,
  hint,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
}) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className="ui-field">
      <label htmlFor={inputId}>{label}</label>
      <input
        {...props}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [
            props['aria-describedby'],
            hint && inputId + '-hint',
            error && inputId + '-error',
          ]
            .filter(Boolean)
            .join(' ') || undefined
        }
      />
      {hint && <small id={inputId + '-hint'}>{hint}</small>}
      {error && (
        <p id={inputId + '-error'} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function Dialog({
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
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="ui-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className="ui-stack">
        <h2 id={titleId}>{title}</h2>
        {children}
        <Button variant="secondary" onClick={onClose}>
          إغلاق
        </Button>
      </div>
    </dialog>
  );
}
export const Modal = Dialog;
export function Avatar({ name, src }: { name: string; src?: string }) {
  return src ? (
    <img className="ui-avatar" src={src} alt={name} width="48" height="48" />
  ) : (
    <span className="ui-avatar" role="img" aria-label={name}>
      {Array.from(name.trim())[0] ?? '—'}
    </span>
  );
}
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="ui-stack">
      <h1>{title}</h1>
      {description && <p className="ui-muted">{description}</p>}
      {children}
    </header>
  );
}
export function Section({
  title,
  children,
  ...props
}: ComponentProps<'section'> & { title: string }) {
  const id = useId();
  return (
    <section
      {...props}
      className={classes('ui-stack', props.className)}
      aria-labelledby={id}
    >
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}
export function EmptyState({
  title = 'لا توجد بيانات بعد',
  description,
  children,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="ui-state ui-stack">
      <h2>{title}</h2>
      {description && <p className="ui-muted">{description}</p>}
      {children}
    </div>
  );
}
export function ErrorState({
  description = 'تعذر تحميل المحتوى.',
  onRetry,
}: {
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert">
      <EmptyState title="حدث خطأ" description={description}>
        {onRetry && <Button onClick={onRetry}>حاول مرة أخرى</Button>}
      </EmptyState>
    </div>
  );
}
export function Loading({ label = 'جارٍ التحميل' }: { label?: string }) {
  return (
    <div role="status" className="ui-state">
      {label}…
    </div>
  );
}
export function StatsCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number | null;
  description?: string;
}) {
  return (
    <Card>
      <p className="ui-muted">{label}</p>
      <p className="ui-stat">{value ?? 'غير متاح'}</p>
      {description && <small>{description}</small>}
    </Card>
  );
}
export function ProgressCard({
  title,
  value,
}: {
  title: string;
  value: number | null;
}) {
  const id = useId();
  const safe =
    value === null || !Number.isFinite(value)
      ? null
      : Math.min(100, Math.max(0, value));
  return (
    <Card>
      <h3 id={id}>{title}</h3>
      {safe === null ? (
        <p className="ui-muted">لا توجد بيانات تقدم بعد</p>
      ) : (
        <>
          <progress aria-labelledby={id} value={safe} max={100} />
          <p>
            {new Intl.NumberFormat('ar-EG', { style: 'percent' }).format(
              safe / 100,
            )}
          </p>
        </>
      )}
    </Card>
  );
}
export interface TableColumn<T> {
  key: string;
  title: string;
  render: (row: T) => ReactNode;
}
export function Table<T>({
  caption,
  columns,
  rows,
  rowKey,
}: {
  caption: string;
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}) {
  if (!rows.length)
    return (
      <EmptyState title={caption} description="لا توجد سجلات لعرضها حاليًا." />
    );
  return (
    <div
      className="ui-table-scroll"
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
