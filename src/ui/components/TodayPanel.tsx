import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatDuration } from '@/shared/format';
import type { DomainRow } from '@/shared/period';
import { SiteIcon } from '@/ui/components/SiteIcon';
import { StatLine } from '@/ui/components/StatLine';
import { strings } from '@/ui/strings';

/** How many sites the panel shows. The rest are visible in the table. */
const TOP_LIMIT = 5;

/**
 * Today panel: the top 5 sites of the current day and the counter of the
 * domains over the limit. The data is always for today, regardless of
 * the selected period. The limit is daily, and the table below shows the
 * period.
 */
export function TodayPanel({
  rows,
  overLimit,
  pageUrls,
  onOpenLimit,
}: {
  rows: DomainRow[];
  overLimit: number;
  pageUrls: Map<string, string>;
  onOpenLimit(domain: string): void;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          {strings.today}
        </h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col gap-1">
          {rows.slice(0, TOP_LIMIT).map((row) => (
            <li key={row.domain}>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-left outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label={strings.openLimitSettings(row.domain, row.seconds)}
                onClick={() => onOpenLimit(row.domain)}
              >
                <SiteIcon domain={row.domain} pageUrl={pageUrls.get(row.domain)} />
                <span className="min-w-0 flex-1 truncate text-sm">{row.domain}</span>
                <span className="shrink-0 font-mono text-sm text-muted-foreground">
                  {formatDuration(row.seconds)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <StatLine label={strings.overLimit} value={overLimit} />
      </CardContent>
    </Card>
  );
}
