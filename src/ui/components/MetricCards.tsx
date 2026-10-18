import { Card, CardContent } from '@/components/ui/card';
import { formatDuration } from '@/shared/format';
import { strings } from '@/ui/strings';

/** Metric card: an 11 px label in uppercase and a monospace value. */
function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          {label}
        </span>
        <span className="font-mono text-2xl leading-none">{value}</span>
        {hint !== undefined ? (
          <span className="font-mono text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Four cards of the period: the total time with the comparison against
 * the previous period, the average per day, the number of sites with new
 * ones, and the number of days with data.
 */
export function MetricCards({
  total,
  previousTotal,
  avgPerDay,
  sites,
  newSites,
  daysTracked,
}: {
  total: number;
  previousTotal: number;
  avgPerDay: number;
  sites: number;
  newSites: number;
  daysTracked: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <MetricCard
        label={strings.totalTime}
        value={formatDuration(total)}
        hint={strings.previousComparison(total - previousTotal)}
      />
      <MetricCard label={strings.avgPerDay} value={formatDuration(avgPerDay)} />
      <MetricCard
        label={strings.sitesVisited}
        value={String(sites)}
        hint={strings.newSites(newSites)}
      />
      <MetricCard label={strings.daysTracked} value={String(daysTracked)} />
    </div>
  );
}
