import type { ReactNode } from 'react';
import { Table } from '@/components/ui';

export interface DataColumn<T> {
  key: string;
  title: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T>(props: {
  caption: string;
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}) {
  return <Table {...props} />;
}
