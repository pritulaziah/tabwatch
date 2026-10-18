import { ArrowDown, ArrowUp, ChartColumn, Moon, Settings as SettingsIcon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from 'cn';
import { settingsHash, statsHash } from '@/dashboard/router';
import { formatDurationWithSeconds } from '@/shared/format';
import { AppHeader } from '@/ui/components/AppHeader';
import { Hourglass } from '@/ui/components/Hourglass';
import { SiteIcon } from '@/ui/components/SiteIcon';
import { sharePercent } from '@/ui/display';
import { useNow } from '@/ui/hooks/useNow';
import { usePopupPresence } from '@/ui/hooks/usePopupPresence';
import { useSettings } from '@/ui/hooks/useSettings';
import { useStats } from '@/ui/hooks/useStats';
import { useTheme } from '@/ui/hooks/useTheme';
import { strings } from '@/ui/strings';

/** The number of sites that the popup shows, the same as in the mockup. */
const POPUP_SITES = 5;

/** Opens the dashboard page at the given route. */
export function openDashboard(hash: string): void {
  void chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') + hash });
}

/**
 * Popup: the total for today with an hourglass and a comparison with
 * yesterday, the top sites with shares, and a link to the statistics page.
 * The current segment only animates the hourglass. The popup has no
 * separate site counter.
 */
export function Popup() {
  const resolved = useTheme();
  const { error: settingsError, setTheme } = useSettings();
  const now = useNow(1000);
  const stats = useStats('today', now);
  usePopupPresence();

  const error = settingsError || stats.error;
  const rows = stats.rows.slice(0, POPUP_SITES);
  // The delta is calculated relative to yesterday. Without yesterday's
  // total there is nothing to compare.
  const delta = stats.total - stats.previousTotal;
  const percent = stats.previousTotal > 0 ? Math.round((delta / stats.previousTotal) * 100) : 0;
  const growing = delta >= 0;

  return (
    <div className="flex max-h-[560px] w-[300px] flex-col">
      <AppHeader>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={strings.toggleTheme}
            onClick={() => void setTheme(resolved === 'dark' ? 'light' : 'dark')}
          >
            {resolved === 'dark' ? <Moon /> : <Sun />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={strings.statistics}
            onClick={() => openDashboard(statsHash())}
          >
            <ChartColumn />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={strings.settings}
            onClick={() => openDashboard(settingsHash())}
          >
            <SettingsIcon />
          </Button>
        </div>
      </AppHeader>

      {error ? (
        <div className="shrink-0 border-b border-destructive/40 px-4 py-2 text-xs text-destructive">
          {strings.storageError}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            {strings.today}
          </span>
          {stats.previousTotal > 0 ? (
            <span
              className={cn(
                'flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs',
                growing ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
              )}
            >
              {growing ? (
                <ArrowUp className="size-3" aria-hidden="true" />
              ) : (
                <ArrowDown className="size-3" aria-hidden="true" />
              )}
              {strings.percent(Math.abs(percent))}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Hourglass
            running={stats.tracking !== null}
            className="size-5 shrink-0 text-muted-foreground"
          />
          <p className="font-mono text-3xl leading-none">
            {formatDurationWithSeconds(stats.total)}
          </p>
        </div>

        {rows.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => {
              const share = sharePercent(row.seconds, stats.total);
              return (
                <li key={row.domain} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <SiteIcon domain={row.domain} className="size-5" />
                    <span className="min-w-0 flex-1 truncate">{row.domain}</span>
                    <span className="font-mono text-xs">
                      {formatDurationWithSeconds(row.seconds)}
                    </span>
                    <span className="w-8 text-right font-mono text-xs text-muted-foreground">
                      {strings.percent(share)}
                    </span>
                  </div>
                  <span
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={share}
                    aria-label={strings.shareLabel(row.domain)}
                    className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  >
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${share}%` }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{strings.noActivity}</p>
        )}

        <Button variant="outline" size="sm" onClick={() => openDashboard(statsHash())}>
          {strings.viewAllSites}
        </Button>
      </div>
    </div>
  );
}
