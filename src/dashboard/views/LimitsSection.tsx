import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';

import { cn } from 'cn';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { domainFromUrl } from '@/shared/domain';
import type { Limits } from '@/shared/types';
import { LimitBar } from '@/ui/components/LimitBar';
import { SiteIcon } from '@/ui/components/SiteIcon';
import { limitLevel, parseLimitMinutes } from '@/ui/limits';
import type { LimitLevel } from '@/ui/limits';
import { strings } from '@/ui/strings';

/** Limit status color for each spent share level. */
const LIMIT_STATUS_CLASSES: Record<LimitLevel, string> = {
  normal: 'text-muted-foreground',
  warning: 'text-limit-warning',
  over: 'text-limit-over',
};

/**
 * Limits section: a list of sites with the time spent today, the limit, the
 * progress, and the status, and a form to add or edit a limit. The form
 * suggests the domain from visited domains, or the user types it.
 */
export function LimitsSection({
  limits,
  spent,
  visitedDomains,
  prefillDomain,
  onSave,
  onRemove,
}: {
  limits: Limits | null;
  spent: Map<string, number>;
  visitedDomains: string[];
  prefillDomain: string | null;
  onSave(domain: string, seconds: number): Promise<boolean>;
  onRemove(domain: string): Promise<boolean>;
}) {
  const [domain, setDomain] = useState('');
  const [minutes, setMinutes] = useState('');
  const [editing, setEditing] = useState(false);
  /** The prefill applies one time, when the limits first load. */
  const prefilled = useRef(false);

  useEffect(() => {
    if (prefilled.current || limits === null) {
      return;
    }
    prefilled.current = true;
    if (prefillDomain === null) {
      return;
    }
    // The prefill fills the form once, from data that arrives after the
    // first render. The ref guard keeps the effect from running twice, so
    // the writes cannot cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDomain(prefillDomain);
    const limit = limits[prefillDomain];
    if (limit !== undefined) {
      setMinutes(String(limit / 60));
      setEditing(true);
    }
  }, [limits, prefillDomain]);

  const stored: Limits = limits ?? {};
  const domains = Object.keys(stored).sort();

  const resetForm = (): void => {
    setDomain('');
    setMinutes('');
    setEditing(false);
  };

  const startEdit = (value: string): void => {
    setDomain(value);
    setMinutes(String((stored[value] ?? 0) / 60));
    setEditing(true);
  };

  const removeLimit = (value: string): void => {
    void onRemove(value).then((removed) => {
      // The form resets only if the user edited the removed domain.
      if (removed && editing && domain === value) {
        resetForm();
      }
    });
  };

  const onFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      resetForm();
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const parsedDomain = domainFromUrl('https://' + domain.trim());
    const parsedMinutes = parseLimitMinutes(minutes);
    if (parsedDomain === null || parsedMinutes === null) {
      return;
    }
    void onSave(parsedDomain, parsedMinutes * 60).then((saved) => {
      if (saved) {
        resetForm();
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {domains.length === 0 ? (
        <p className="text-sm text-muted-foreground">{strings.noLimits}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {domains.map((value) => {
            const spentSeconds = spent.get(value) ?? 0;
            const limitSeconds = stored[value] ?? 0;
            const level = limitLevel(spentSeconds, limitSeconds);
            return (
              <li key={value} className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <SiteIcon domain={value} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{value}</span>
                  <span className={cn('text-xs', LIMIT_STATUS_CLASSES[level])}>
                    {strings.limitStatus[level]}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={strings.editLabel(value)}
                    onClick={() => startEdit(value)}
                  >
                    {strings.edit}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    aria-label={strings.deleteLabel(value)}
                    onClick={() => removeLimit(value)}
                  >
                    {strings.delete}
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <LimitBar
                    className="flex-1"
                    domain={value}
                    spentSeconds={spentSeconds}
                    limitSeconds={limitSeconds}
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {strings.limitCaption(spentSeconds, limitSeconds)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="limit-domain"
            className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
          >
            {strings.domainLabel}
          </label>
          <Input
            id="limit-domain"
            list="visited-domains"
            value={domain}
            disabled={editing}
            onChange={(event) => setDomain(event.target.value)}
            onKeyDown={onFieldKeyDown}
          />
          <datalist id="visited-domains">
            {visitedDomains.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="limit-minutes"
            className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase"
          >
            {strings.minutesLabel}
          </label>
          <Input
            id="limit-minutes"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            onKeyDown={onFieldKeyDown}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit">{editing ? strings.save : strings.addLimit}</Button>
          {editing ? (
            <Button type="button" variant="ghost" onClick={resetForm}>
              {strings.cancel}
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
