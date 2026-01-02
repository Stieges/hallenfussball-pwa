/**
 * useScrollDirection Hook
 *
 * Detects scroll direction for smart sticky behavior.
 * Returns whether element should be visible based on scroll direction.
 *
 * - Scrolling down: hide (returns isVisible: false)
 * - Scrolling up: show (returns isVisible: true)
 * - At top of page: always show
 *
 * @see docs/concepts/SPIELPLAN-FILTER-KONZEPT.md Section 7
 */

import { useState, useEffect, useRef } from 'react';

export type ScrollDirection = 'up' | 'down' | null;

export interface UseScrollDirectionOptions {
  /** Minimum scroll distance before direction changes (default: 10) */
  threshold?: number;
  /** Initial visibility state (default: true) */
  initialVisible?: boolean;
}

export interface UseScrollDirectionReturn {
  /** Current scroll direction */
  scrollDirection: ScrollDirection;
  /** Whether element should be visible */
  isVisible: boolean;
}

/**
 * Hook to detect scroll direction
 *
 * @param options - Configuration options
 * @returns Scroll direction and visibility state
 *
 * @example
 * ```tsx
 * const { isVisible } = useScrollDirection({ threshold: 10 });
 *
 * return (
 *   <div style={{
 *     transform: isVisible ? 'translateY(0)' : 'translateY(-100%)',
 *     transition: 'transform 200ms ease-out',
 *   }}>
 *     Content
 *   </div>
 * );
 * ```
 */
export function useScrollDirection(
  options: UseScrollDirectionOptions = {}
): UseScrollDirectionReturn {
  const { threshold = 10, initialVisible = true } = options;

  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>(null);
  const [isVisible, setIsVisible] = useState(initialVisible);

  const lastScrollY = useRef(0);
  const lastDirection = useRef<ScrollDirection>(null);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const difference = currentScrollY - lastScrollY.current;

      // At top of page → always visible
      if (currentScrollY < threshold) {
        setIsVisible(true);
        setScrollDirection(null);
        lastScrollY.current = currentScrollY;
        return;
      }

      // Determine direction
      if (Math.abs(difference) > threshold) {
        const newDirection: ScrollDirection = difference > 0 ? 'down' : 'up';

        if (newDirection !== lastDirection.current) {
          setScrollDirection(newDirection);
          setIsVisible(newDirection === 'up');
          lastDirection.current = newDirection;
        }

        lastScrollY.current = currentScrollY;
      }
    };

    // Passive listener for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return { scrollDirection, isVisible };
}

export default useScrollDirection;
