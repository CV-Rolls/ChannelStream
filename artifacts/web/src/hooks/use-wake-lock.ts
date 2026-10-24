import { useEffect, useCallback, useRef } from "react";

/**
 * Prevents the device screen from sleeping while `active` is true.
 *
 * Uses the Screen Wake Lock API (supported in Chrome/Edge/Firefox on Android
 * and desktop). Silently no-ops on iOS Safari which does not support it.
 *
 * Future React Native equivalent: `expo-keep-awake`
 *   import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
 */
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  const acquire = useCallback(async () => {
    if (!("wakeLock" in navigator)) return;
    try {
      lockRef.current = await (
        navigator as Navigator & {
          wakeLock: { request: (type: string) => Promise<WakeLockSentinel> };
        }
      ).wakeLock.request("screen");
    } catch { /* permission denied or unsupported */ }
  }, []);

  const release = useCallback(() => {
    lockRef.current?.release().catch(() => {});
    lockRef.current = null;
  }, []);

  useEffect(() => {
    if (!active) {
      release();
      return;
    }
    acquire();
    // The OS automatically releases the lock when the tab goes to background;
    // re-acquire it when the user returns.
    const onVisibility = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      release();
    };
  }, [active, acquire, release]);
}
