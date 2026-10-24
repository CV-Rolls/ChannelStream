import { useState, useEffect } from "react";

/**
 * Returns true when the device is a mobile phone in portrait orientation.
 * Used to prompt the user to rotate for a better video-watching experience.
 *
 * Future React Native equivalent:
 *   import { useWindowDimensions } from 'react-native';
 *   const { width, height } = useWindowDimensions();
 *   const isPortrait = height > width;
 */
export function usePortraitMobile() {
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const isMobile  = window.matchMedia("(max-width: 768px)").matches;
      const isPortrait = window.matchMedia("(orientation: portrait)").matches;
      setIsPortraitMobile(isMobile && isPortrait);
    };
    check();
    window.addEventListener("resize", check);
    const mql = window.matchMedia("(orientation: portrait)");
    mql.addEventListener("change", check);
    return () => {
      window.removeEventListener("resize", check);
      mql.removeEventListener("change", check);
    };
  }, []);

  return isPortraitMobile;
}
