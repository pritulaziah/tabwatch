import { Sidebar } from '@/dashboard/Sidebar';
import { useHashRoute } from '@/dashboard/useHashRoute';
import { SettingsView } from '@/dashboard/views/SettingsView';
import { StatsView } from '@/dashboard/views/StatsView';
import { useTheme } from '@/ui/hooks/useTheme';

/**
 * Page shell: the sidebar on the left and the screen selected by the hash on
 * the right. The theme applies to <html> and changes on the settings screen.
 */
export function App() {
  useTheme();
  const route = useHashRoute();

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <Sidebar active={route.screen} />
      <main className="min-w-0 flex-1 px-6 py-6">
        {route.screen === 'stats' ? <StatsView /> : null}
        {route.screen === 'settings' ? <SettingsView prefillDomain={route.domain} /> : null}
      </main>
    </div>
  );
}
