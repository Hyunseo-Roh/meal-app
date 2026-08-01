import { useEffect, useState } from 'react';

/**
 * Returns true only once `active` has stayed true continuously for `delayMs`.
 *
 * Used to suppress loader flashes: gate a loader on this instead of on the raw
 * loading boolean, and a fast fetch that resolves before the timer fires never
 * shows the loader at all, while a genuinely slow one still shows it after the
 * delay. With `delayMs = 0` it returns `active` synchronously (no delay, no
 * extra render) — the default, so existing callers are unchanged.
 */
export function useDelayedFlag(active: boolean, delayMs = 0): boolean {
  // Seed to the immediate answer so delayMs=0 renders identically to no hook.
  const [shown, setShown] = useState(active && delayMs === 0);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    if (delayMs === 0) {
      setShown(true);
      return;
    }
    setShown(false); // restart the wait each time `active` (re)engages
    const t = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(t);
  }, [active, delayMs]);
  return shown;
}
