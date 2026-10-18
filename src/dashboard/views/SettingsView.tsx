import { useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LimitsSection } from '@/dashboard/views/LimitsSection';
import type { ImportMode } from '@/shared/transfer';
import type { Settings } from '@/shared/types';
import { useLimits } from '@/ui/hooks/useLimits';
import { useNow } from '@/ui/hooks/useNow';
import { useSettings } from '@/ui/hooks/useSettings';
import { useStats } from '@/ui/hooks/useStats';
import { useTransfer } from '@/ui/hooks/useTransfer';
import { strings } from '@/ui/strings';

/** Theme choice order: system, light, dark. */
const THEMES: readonly Settings['theme'][] = ['system', 'light', 'dark'];

/** Import mode order: merge and replace. */
const MODES: readonly ImportMode[] = ['merge', 'replace'];

/** Screen section: a card with an 11 px uppercase block title. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          {title}
        </h2>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}

/**
 * Settings screen: the theme, the limit editor, and the data transfer. One
 * screen serves both surfaces. The limit form is prefilled with the domain
 * from the route.
 */
export function SettingsView({ prefillDomain }: { prefillDomain: string | null }) {
  const { settings, error: settingsError, setTheme } = useSettings();
  const now = useNow(1000);
  const stats = useStats('today', now);
  const { limits, error: limitsError, save, remove } = useLimits();
  const {
    exporting,
    importing,
    error: transferError,
    importError,
    report,
    runExport,
    runImport,
    clearData,
  } = useTransfer();
  const [mode, setMode] = useState<ImportMode>('merge');
  const [confirmingClear, setConfirmingClear] = useState(false);

  const readError = settingsError || limitsError || stats.error;
  const spent = new Map(stats.rows.map((row) => [row.domain, row.seconds]));

  const onFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    // The field clears at once, so the same file can be selected again.
    event.target.value = '';
    if (file !== undefined) {
      void runImport(file, mode);
    }
  };

  const onClearData = (): void => {
    void clearData().then((cleared) => {
      // On error, the confirmation stays open and the banner is visible.
      if (cleared) {
        setConfirmingClear(false);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {readError || transferError ? (
        <div className="rounded-lg border border-destructive/40 px-4 py-2 text-xs text-destructive">
          {readError ? strings.storageError : strings.transferError}
        </div>
      ) : null}

      <Section title={strings.appearanceSection}>
        <div className="flex items-center gap-1">
          {THEMES.map((value) => {
            const active = settings?.theme === value;
            return (
              <Button
                key={value}
                variant={active ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={active}
                onClick={() => void setTheme(value)}
              >
                {strings.themes[value]}
              </Button>
            );
          })}
        </div>
      </Section>

      <Section title={strings.limitsSection}>
        <LimitsSection
          limits={limits}
          spent={spent}
          visitedDomains={stats.visitedDomains}
          prefillDomain={prefillDomain}
          onSave={save}
          onRemove={remove}
        />
      </Section>

      <Section title={strings.dataSection}>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={exporting} onClick={() => void runExport()}>
            {strings.exportData}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span id="import-mode-label" className="text-xs text-muted-foreground">
            {strings.importModeLabel}
          </span>
          <div role="group" aria-labelledby="import-mode-label" className="flex items-center gap-1">
            {MODES.map((value) => {
              const active = value === mode;
              return (
                <Button
                  key={value}
                  variant={active ? 'secondary' : 'ghost'}
                  size="sm"
                  aria-pressed={active}
                  disabled={importing}
                  onClick={() => setMode(value)}
                >
                  {strings.importModes[value]}
                </Button>
              );
            })}
          </div>
        </div>

        <Input
          type="file"
          accept=".json,application/json"
          aria-label={strings.importFileLabel}
          disabled={importing}
          onChange={onFileChange}
        />

        {mode === 'merge' ? (
          <p className="text-xs text-limit-warning">{strings.mergeWarning}</p>
        ) : null}

        {importError !== null ? (
          <p className="text-xs text-destructive">
            {importError === 'newerVersion' ? strings.importNewerVersion : strings.importDamaged}
          </p>
        ) : null}

        {report !== null ? (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">{strings.reportTitle}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {strings.reportDays(report.affectedDays)}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {strings.reportDomains(report.domains)}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {strings.reportTime(report.seconds)}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {strings.reportDropped(report.droppedRecords)}
            </p>
          </div>
        ) : null}

        {confirmingClear ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">{strings.clearConfirm}</p>
            <div className="flex items-center gap-2">
              <Button variant="destructive" size="sm" onClick={onClearData}>
                {strings.clearData}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingClear(false)}>
                {strings.cancel}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => setConfirmingClear(true)}
            >
              {strings.clearData}
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">{strings.dataNote}</p>
        <p className="text-xs text-muted-foreground">{strings.exportPrivacyNote}</p>
        <p className="text-xs text-muted-foreground">{strings.permissionsNote}</p>
      </Section>
    </div>
  );
}
