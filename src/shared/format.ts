const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_DAY = 86_400;

/**
 * Duration format: `30s` for seconds, `45m` for minutes, `1h 05m` for hours,
 * and `1d 01h` for days.
 */
export function formatDuration(seconds: number): string {
  if (seconds < SECONDS_PER_MINUTE) {
    return `${seconds}s`;
  }
  if (seconds < SECONDS_PER_HOUR) {
    return `${Math.floor(seconds / SECONDS_PER_MINUTE)}m`;
  }
  if (seconds < SECONDS_PER_DAY) {
    const hours = Math.floor(seconds / SECONDS_PER_HOUR);
    const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  const days = Math.floor(seconds / SECONDS_PER_DAY);
  const hours = Math.floor((seconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  return `${days}d ${String(hours).padStart(2, '0')}h`;
}

/**
 * Duration format with seconds: `09s`, `45m 05s`, `1h 24m 05s`. Seconds are
 * always present. Minutes and hours are present when the value has them.
 */
export function formatDurationWithSeconds(seconds: number): string {
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const rest = Math.floor(seconds % SECONDS_PER_MINUTE);
  const secondsPart = `${String(rest).padStart(2, '0')}s`;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${secondsPart}`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secondsPart}`;
  }
  return secondsPart;
}
