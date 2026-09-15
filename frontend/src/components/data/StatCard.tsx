import { StatsCard } from '@/components/ui';

export function StatCard(props: {
  label: string;
  value: string | number | null;
  description?: string;
}) {
  return <StatsCard {...props} />;
}
