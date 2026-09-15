import { Link } from 'react-router';
import type { NavigationItem } from '@/types/platform';

export function Breadcrumb({ items }: { items: NavigationItem[] }) {
  return (
    <nav aria-label="مسار الصفحة">
      <ol className="ui-breadcrumb">
        {items.map((item, index) => (
          <li key={item.href}>
            {index === items.length - 1 ? (
              <span aria-current="page">{item.label}</span>
            ) : (
              <Link to={item.href}>{item.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
