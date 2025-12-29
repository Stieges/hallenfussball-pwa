/**
 * useBreakpoint - Responsive Breakpoint Hook
 *
 * Provides granular device detection for responsive layouts:
 * - Mobile: < 768px
 * - Tablet: 768px - 1023px
 * - Desktop: >= 1024px
 *
 * Based on usehooks.io patterns with SSR safety.
 */

import { useState, useEffect } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export interface BreakpointConfig {
  mobile: number;
  tablet: number;
  desktop: number;
}

const DEFAULT_BREAKPOINTS: BreakpointConfig = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
};

export interface UseBreakpointReturn {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isMobileOrTablet: boolean;
  isTabletOrDesktop: boolean;
  width: number;
  isLoading: boolean;
}

export function useBreakpoint(
  breakpoints: BreakpointConfig = DEFAULT_BREAKPOINTS
): UseBreakpointReturn {
  const [width, setWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
    };

    // Initial measurement
    handleResize();
    setIsLoading(false);

    // Listen for resize with passive listener for performance
    window.addEventListener('resize', handleResize, { passive: true });

    // Also listen for orientation change on mobile
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const getBreakpoint = (w: number): Breakpoint => {
    if (w >= breakpoints.desktop) {
      return 'desktop';
    }
    if (w >= breakpoints.tablet) {
      return 'tablet';
    }
    return 'mobile';
  };

  const breakpoint = getBreakpoint(width);

  return {
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    isMobileOrTablet: breakpoint === 'mobile' || breakpoint === 'tablet',
    isTabletOrDesktop: breakpoint === 'tablet' || breakpoint === 'desktop',
    width,
    isLoading,
  };
}

export default useBreakpoint;
