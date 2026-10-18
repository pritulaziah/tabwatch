/**
 * Counter line: a label in uppercase with letter spacing and a monospace
 * value.
 */
export function StatLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      <span className="font-mono text-2xl leading-none">{value}</span>
    </div>
  );
}
