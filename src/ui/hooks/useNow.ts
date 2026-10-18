import { useEffect, useState } from 'react';

/**
 * The current Date.now(), updated every intervalMs milliseconds.
 * The live counters tick from this value and do not read the storage
 * again.
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
