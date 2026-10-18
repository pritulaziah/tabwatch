import type { DayRange } from '@/shared/period';
import { rangeLabel } from '@/ui/display';

/**
 * Date range chip: read-only, monospace, and muted. The selected period
 * shows the dates, and there are no arrows to go to past periods.
 */
export function RangeChip({ range }: { range: DayRange }) {
  return (
    <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground">
      {rangeLabel(range)}
    </span>
  );
}
