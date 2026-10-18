import { cn } from 'cn';

import { limitLevel, limitPercent } from '@/ui/limits';
import type { LimitLevel } from '@/ui/limits';
import { strings } from '@/ui/strings';

/** Fill color of the limit bar by the level of the share spent. */
const LIMIT_BAR_CLASSES: Record<LimitLevel, string> = {
  normal: 'bg-primary',
  warning: 'bg-limit-warning',
  over: 'bg-limit-over',
};

/**
 * Bar of the daily limit of a domain: the fill follows the share spent
 * of the limit, the color follows the level, and the width is in percent.
 */
export function LimitBar({
  domain,
  spentSeconds,
  limitSeconds,
  className,
}: {
  domain: string;
  spentSeconds: number;
  limitSeconds: number;
  className?: string;
}) {
  const percent = limitPercent(spentSeconds, limitSeconds);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={strings.limitLabel(domain)}
      className={cn('h-1 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div
        className={cn(
          'h-full rounded-full',
          LIMIT_BAR_CLASSES[limitLevel(spentSeconds, limitSeconds)],
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
