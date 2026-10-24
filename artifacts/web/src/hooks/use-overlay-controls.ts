import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Manages a tap-to-toggle overlay that auto-hides after `hideAfterMs`.
 *
 * Used for video player controls: tap anywhere to reveal, auto-hide after
 * inactivity, tap again to dismiss instantly.
 *
 * This is a pure timing/state hook with no browser-specific APIs — it
 * translates directly to React Native with zero changes.
 */
export function useOverlayControls(hideAfterMs = 3500) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleHide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), hideAfterMs);
  }, [hideAfterMs]);

  /** Show the overlay and reset the auto-hide timer. */
  const show = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  /** Toggle: if visible, hide immediately; if hidden, show + reset timer. */
  const toggle = useCallback(() => {
    setVisible((v) => {
      if (v) {
        if (timerRef.current) clearTimeout(timerRef.current);
        return false;
      }
      scheduleHide();
      return true;
    });
  }, [scheduleHide]);

  /** Start the initial auto-hide on mount. */
  useEffect(() => {
    scheduleHide();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return { visible, show, toggle, scheduleHide };
}
