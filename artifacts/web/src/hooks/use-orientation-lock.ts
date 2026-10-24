import { useEffect } from "react";

/**
 * Locks the screen to landscape when the browser enters fullscreen,
 * and unlocks it when fullscreen exits.
 *
 * - Android Chrome: screen.orientation.lock() is supported — works fully.
 * - iOS Safari: lock() is not implemented; the try/catch silently ignores it.
 *
 * Future React Native equivalent: `expo-screen-orientation`
 *   import * as ScreenOrientation from 'expo-screen-orientation';
 *   await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
 */

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
};

export function useFullscreenOrientationLock() {
  useEffect(() => {
    const onFullscreenChange = async () => {
      const orientation = screen.orientation as LockableOrientation;
      if (document.fullscreenElement) {
        if (typeof orientation?.lock === "function") {
          try { await orientation.lock("landscape-primary"); } catch { /* iOS Safari – ignore */ }
        }
      } else {
        if (typeof orientation?.unlock === "function") {
          try { orientation.unlock(); } catch { /* ignore */ }
        }
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);
}
