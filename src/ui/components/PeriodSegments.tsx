import { cn } from 'cn';

import type { Period } from '@/shared/types';
import { strings } from '@/ui/strings';

/**
 * Order of the period segments: from the current day to the last 365
 * days.
 */
const PERIODS: readonly Period[] = ['today', 'week', 'month', 'year'];

/**
 * Segments of the four periods: the selected segment is filled with the
 * accent, the rest are muted. The group has a label, so a screen reader
 * reads the purpose of the switch.
 */
export function PeriodSegments({
  period,
  onSelect,
}: {
  period: Period;
  onSelect(period: Period): void;
}) {
  return (
    <div
      role="group"
      aria-label={strings.periodSegmentsLabel}
      className="flex gap-1 rounded-lg bg-muted p-1"
    >
      {PERIODS.map((value) => {
        const active = value === period;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(value)}
            className={cn(
              'cursor-pointer rounded-md px-3 py-1 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {strings.periods[value]}
          </button>
        );
      })}
    </div>
  );
}
