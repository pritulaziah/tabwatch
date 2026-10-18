import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { cn } from 'cn';

import { formatDuration } from '@/shared/format';
import type { DailyTotal, HourlyTotal } from '@/shared/period';
import { buildStackSeries, chartDayLabel, chartHourLabel } from '@/ui/display';
import { strings } from '@/ui/strings';

/**
 * Chart granularity: the hours of the last day of the period or the days
 * of the whole period.
 */
export type Granularity = 'hour' | 'day';

/** Order of the granularity switch: hours, then days. */
const GRANULARITIES: readonly Granularity[] = ['hour', 'day'];

/** Series colors: theme tokens chart-1 to chart-5. Other domains are muted. */
const SERIES_COLORS: readonly string[] = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

/** Axes: the muted theme color instead of the recharts defaults. */
const AXIS_TICK = { fill: 'var(--muted-foreground)' };
const AXIS_LINE = { stroke: 'var(--muted-foreground)' };

/** Tooltip: the surfaces and the text take the theme tokens. */
const TOOLTIP_CONTENT = {
  backgroundColor: 'var(--popover)',
  borderColor: 'var(--border)',
  color: 'var(--popover-foreground)',
};
const TOOLTIP_TEXT = { color: 'var(--popover-foreground)' };

/**
 * Activity chart panel: the columns stack by the top 5 domains of the
 * period and 'Other'. The granularity switch is in a labelled group.
 * A zero series is replaced with text, so an empty chart does not draw
 * only zeros.
 */
export function ActivityChart({
  granularity,
  daily,
  hourly,
  topDomains,
  onGranularityChange,
}: {
  granularity: Granularity;
  daily: DailyTotal[];
  hourly: HourlyTotal[];
  topDomains: string[];
  onGranularityChange(granularity: Granularity): void;
}) {
  const buckets =
    granularity === 'hour'
      ? hourly.map((bucket) => ({
          label: chartHourLabel(bucket.hour),
          seconds: bucket.seconds,
          perDomain: bucket.perDomain,
        }))
      : daily.map((bucket) => ({
          label: chartDayLabel(bucket.day),
          seconds: bucket.seconds,
          perDomain: bucket.perDomain,
        }));

  // The 'Other' label is an interface string. The tooltip shows it as the
  // series name.
  const data = buildStackSeries(buckets, topDomains).map((point) => ({
    label: point.label,
    ...point.values,
    [strings.otherSeries]: point.other,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div
        role="group"
        aria-label={strings.granularityLabel}
        className="flex gap-1 self-end rounded-lg bg-muted p-1"
      >
        {GRANULARITIES.map((value) => {
          const active = value === granularity;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => onGranularityChange(value)}
              className={cn(
                'cursor-pointer rounded-md px-2.5 py-1 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {strings.granularity[value]}
            </button>
          );
        })}
      </div>

      {buckets.every((bucket) => bucket.seconds === 0) ? (
        <p className="text-sm text-muted-foreground">{strings.noActivity}</p>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={AXIS_LINE} />
              <YAxis
                tickFormatter={formatDuration}
                tick={AXIS_TICK}
                axisLine={AXIS_LINE}
                tickLine={AXIS_LINE}
              />
              <Tooltip
                formatter={(value) => formatDuration(Number(value))}
                contentStyle={TOOLTIP_CONTENT}
                labelStyle={TOOLTIP_TEXT}
                itemStyle={TOOLTIP_TEXT}
              />
              {topDomains.map((domain, index) => (
                <Bar
                  key={domain}
                  dataKey={domain}
                  stackId="activity"
                  fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                />
              ))}
              <Bar
                dataKey={strings.otherSeries}
                stackId="activity"
                fill="var(--muted-foreground)"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
