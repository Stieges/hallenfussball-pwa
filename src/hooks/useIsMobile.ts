/**
 * useIsMobile Hook
 *
 * BUG-MOD-001 FIX: Reactive mobile detection using resize listener
 * instead of static window.innerWidth check at component mount.
 *
 * This ensures layout updates correctly when:
 * - Device is rotated (portrait <-> landscape)
 * - Browser window is resized
 * - DevTools responsive mode is used
 */

import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

/**
 * Returns true if viewport width is below mobile breakpoint (768px)
 * Updates reactively on window resize
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Use matchMedia for better performance (only fires at breakpoint)
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    // Handler for media query changes
    const handleMediaChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);

    // Modern browsers use addEventListener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    } else {
      // Fallback for older browsers
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  return isMobile;
}

/**
 * Returns true if viewport width is below tablet breakpoint (1024px)
 */
export function useIsTablet(): boolean {
  const [isTablet, setIsTablet] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < TABLET_BREAKPOINT : false
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${TABLET_BREAKPOINT - 1}px)`);

    const handler = (e: MediaQueryListEvent) => setIsTablet(e.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handler);
      }
    };
  }, []);

  return isTablet;
}

/**
 * Returns current device type based on viewport width
 */
export function useDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  if (isMobile) {return 'mobile';}
  if (isTablet) {return 'tablet';}
  return 'desktop';
}
