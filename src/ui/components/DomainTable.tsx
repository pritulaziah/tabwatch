import { formatDuration } from '@/shared/format';
import type { DomainRow } from '@/shared/period';
import { SiteIcon } from '@/ui/components/SiteIcon';
import { sharePercent } from '@/ui/display';
import { strings } from '@/ui/strings';

/**
 * Domain table of the period: rank, site, time, and share with an inline
 * bar. A domain row opens the settings of its limit.
 */
export function DomainTable({
  rows,
  total,
  pageUrls,
  onOpenLimit,
}: {
  rows: DomainRow[];
  total: number;
  pageUrls: Map<string, string>;
  onOpenLimit(domain: string): void;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          <th className="px-2 py-2 text-left font-medium">{strings.table.rank}</th>
          <th className="px-2 py-2 text-left font-medium">{strings.table.website}</th>
          <th className="px-2 py-2 text-right font-medium">{strings.table.time}</th>
          <th className="px-2 py-2 text-right font-medium">{strings.table.share}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const share = sharePercent(row.seconds, total);
          return (
            <tr key={row.domain} className="border-t border-border">
              <td className="px-2 py-2 font-mono text-muted-foreground">{index + 1}</td>
              <td className="px-2 py-2">
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-2 rounded-sm text-left outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
                  aria-label={strings.openLimitSettings(row.domain, row.seconds)}
                  onClick={() => onOpenLimit(row.domain)}
                >
                  <SiteIcon domain={row.domain} pageUrl={pageUrls.get(row.domain)} />
                  <span className="min-w-0 flex-1 truncate">{row.domain}</span>
                </button>
              </td>
              <td className="px-2 py-2 text-right font-mono">{formatDuration(row.seconds)}</td>
              <td className="px-2 py-2">
                <div className="flex items-center justify-end gap-2">
                  <span className="font-mono text-muted-foreground">{share}</span>
                  <span
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={share}
                    aria-label={strings.shareLabel(row.domain)}
                    className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted"
                  >
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${share}%` }}
                    />
                  </span>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
