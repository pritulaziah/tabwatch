import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { settingsHash } from '@/dashboard/router';
import { rangeFor } from '@/shared/period';
import type { Period } from '@/shared/types';
import { ActivityChart } from '@/ui/components/ActivityChart';
import type { Granularity } from '@/ui/components/ActivityChart';
import { DomainTable } from '@/ui/components/DomainTable';
import { MetricCards } from '@/ui/components/MetricCards';
import { PeriodSegments } from '@/ui/components/PeriodSegments';
import { RangeChip } from '@/ui/components/RangeChip';
import { TodayPanel } from '@/ui/components/TodayPanel';
import { filterRows, STACK_TOP_LIMIT } from '@/ui/display';
import { useNow } from '@/ui/hooks/useNow';
import { useStats } from '@/ui/hooks/useStats';
import { useTabUrls } from '@/ui/hooks/useTabUrls';
import { strings } from '@/ui/strings';

/** Default granularity: hours for a day, days for other periods. */
function defaultGranularity(period: Period): Granularity {
  return period === 'today' ? 'hour' : 'day';
}

/** Panel title: 11 px in uppercase with letter spacing. */
function PanelTitle({ children }: { children: string }) {
  return (
    <h2 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
      {children}
    </h2>
  );
}

/**
 * Statistics screen: period segments, metric cards, the Today panel, the
 * activity chart, and the Top sites table. A domain row opens the limit
 * form of that domain.
 */
export function StatsView() {
  const [period, setPeriod] = useState<Period>('today');
  const [granularity, setGranularity] = useState<Granularity>('hour');
  const [query, setQuery] = useState('');
  const now = useNow(1000);
  const stats = useStats(period, now);
  const pageUrls = useTabUrls();
  const rows = filterRows(stats.rows, query);

  const openLimit = (domain: string): void => {
    window.location.hash = settingsHash(domain);
  };

  // When the period changes, the granularity returns to the default value.
  const selectPeriod = (value: Period): void => {
    setPeriod(value);
    setGranularity(defaultGranularity(value));
  };

  if (stats.loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {stats.error ? (
        <div className="rounded-lg border border-destructive/40 px-4 py-2 text-xs text-destructive">
          {strings.storageError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-medium">{strings.statistics}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <RangeChip range={rangeFor(period, now)} />
          <PeriodSegments period={period} onSelect={selectPeriod} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <MetricCards
          total={stats.total}
          previousTotal={stats.previousTotal}
          avgPerDay={stats.avgPerDay}
          sites={stats.sites}
          newSites={stats.newSites}
          daysTracked={stats.daysTracked}
        />
        <TodayPanel
          rows={stats.todayRows}
          overLimit={stats.overLimit}
          pageUrls={pageUrls}
          onOpenLimit={openLimit}
        />
      </div>

      {stats.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{strings.noActivity}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <PanelTitle>{strings.activity}</PanelTitle>
            </CardHeader>
            <CardContent>
              <ActivityChart
                granularity={granularity}
                daily={stats.daily}
                hourly={stats.hourly}
                topDomains={stats.rows.slice(0, STACK_TOP_LIMIT).map((row) => row.domain)}
                onGranularityChange={setGranularity}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <PanelTitle>{strings.topSites}</PanelTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={strings.searchLabel}
                  placeholder={strings.searchLabel}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <Button variant="outline" onClick={() => setQuery('')}>
                  {strings.reset}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <DomainTable
                  rows={rows}
                  total={stats.total}
                  pageUrls={pageUrls}
                  onOpenLimit={openLimit}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
