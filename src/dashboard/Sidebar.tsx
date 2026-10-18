import { ChartColumn, Settings as SettingsIcon, Timer } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from 'cn';

import { settingsHash, statsHash } from '@/dashboard/router';
import { strings } from '@/ui/strings';

/**
 * Navigation item: the active item has the accent fill and the
 * `aria-current="page"` mark.
 */
function SidebarItem({
  screen,
  active,
  hash,
  icon,
  label,
}: {
  screen: 'stats' | 'settings';
  active: 'stats' | 'settings';
  hash: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-current={screen === active ? 'page' : undefined}
      onClick={() => {
        window.location.hash = hash;
      }}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/50',
        screen === active
          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * Page sidebar: the logo and two items, statistics and settings. A click on
 * an item sets the hash route. The active item is highlighted.
 */
export function Sidebar({ active }: { active: 'stats' | 'settings' }) {
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar px-3 py-5 text-sidebar-foreground">
      <div className="flex items-center gap-2 px-3">
        <Timer className="size-5" aria-hidden="true" />
        <span className="font-heading text-base font-medium">{strings.appName}</span>
      </div>
      <nav className="flex flex-col gap-1">
        <SidebarItem
          screen="stats"
          active={active}
          hash={statsHash()}
          icon={<ChartColumn className="size-4" aria-hidden="true" />}
          label={strings.overview}
        />
        <SidebarItem
          screen="settings"
          active={active}
          hash={settingsHash()}
          icon={<SettingsIcon className="size-4" aria-hidden="true" />}
          label={strings.settings}
        />
      </nav>
    </aside>
  );
}
