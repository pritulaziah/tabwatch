import { Timer } from 'lucide-react';
import type { ReactNode } from 'react';

import { strings } from '@/ui/strings';

/**
 * Header of the surface: the icon with the name on the left, the actions
 * of the caller on the right.
 */
export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
      <span className="flex items-center gap-2 font-heading text-sm font-semibold">
        <Timer className="size-4" aria-hidden="true" />
        {strings.appName}
      </span>
      {children}
    </header>
  );
}
