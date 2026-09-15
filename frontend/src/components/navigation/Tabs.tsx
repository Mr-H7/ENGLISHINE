import { useId } from 'react';
import type { KeyboardEvent } from 'react';

export interface TabItem {
  id: string;
  label: string;
}

function moveFocus(event: KeyboardEvent<HTMLButtonElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = Array.from(
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]',
    ) ?? [],
  );
  const currentIndex = tabs.indexOf(event.currentTarget);
  if (currentIndex < 0) return;
  const isRtl = getComputedStyle(event.currentTarget).direction === 'rtl';
  const step = event.key === 'ArrowRight' ? (isRtl ? -1 : 1) : isRtl ? 1 : -1;
  const nextIndex =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (currentIndex + step + tabs.length) % tabs.length;
  event.preventDefault();
  tabs[nextIndex]?.focus();
}

export function Tabs({
  items,
  activeId,
  onChange,
  label = 'أقسام المحتوى',
}: {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const baseId = useId();
  return (
    <div className="ui-tabs" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          type="button"
          role="tab"
          id={`${baseId}-${item.id}`}
          aria-selected={item.id === activeId}
          tabIndex={item.id === activeId ? 0 : -1}
          key={item.id}
          onKeyDown={moveFocus}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
