import { useMemo, useState, useEffect } from 'react';

interface AnimatedItem<T> {
  /** The original item */
  item: T;
  /** Style object with staggered animation */
  style: React.CSSProperties;
  /** Index in the list */
  index: number;
}

interface UseListAnimationOptions {
  /** Delay between each item animation in ms (default: 50) */
  staggerDelay?: number;
  /** Base animation duration in ms (default: 300) */
  duration?: number;
  /** Animation name to use (default: 'fadeInUp') */
  animationName?: string;
  /** Easing function (default: 'ease-out') */
  easing?: string;
  /** Whether animation is enabled (default: true) */
  enabled?: boolean;
  /** Whether to respect prefers-reduced-motion (default: true) */
  respectReducedMotion?: boolean;
}

/**
 * Hook to create staggered animations for list items.
 *
 * Respects `prefers-reduced-motion` by default.
 *
 * @example
 * function TeamList({ teams }) {
 *   const animatedTeams = useListAnimation(teams);
 *
 *   return (
 *     <ul>
 *       {animatedTeams.map(({ item, style, index }) => (
 *         <li key={item.id} style={style}>
 *           {item.name}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 */
export function useListAnimation<T>(
  items: T[],
  options: UseListAnimationOptions = {}
): AnimatedItem<T>[] {
  const {
    staggerDelay = 50,
    duration = 300,
    animationName = 'fadeInUp',
    easing = 'ease-out',
    enabled = true,
    respectReducedMotion = true,
  } = options;

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    if (!respectReducedMotion) {return;}

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [respectReducedMotion]);

  const shouldAnimate = enabled && !prefersReducedMotion;

  return useMemo(() => {
    return items.map((item, index) => ({
      item,
      index,
      style: shouldAnimate
        ? {
            animation: `${animationName} ${duration}ms ${easing} ${index * staggerDelay}ms both`,
          }
        : {},
    }));
  }, [items, shouldAnimate, animationName, duration, easing, staggerDelay]);
}

/**
 * Hook for a simple fade-in effect on mount.
 * Returns style object to apply to the element.
 *
 * @example
 * function Card() {
 *   const fadeStyle = useFadeIn();
 *   return <div style={fadeStyle}>Content</div>;
 * }
 */
export function useFadeIn(
  options: { duration?: number; delay?: number; respectReducedMotion?: boolean } = {}
): React.CSSProperties {
  const { duration = 250, delay = 0, respectReducedMotion = true } = options;

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (!respectReducedMotion) {return;}

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [respectReducedMotion]);

  if (prefersReducedMotion) {
    return {};
  }

  return {
    animation: `fadeIn ${duration}ms ease-out ${delay}ms both`,
  };
}

export default useListAnimation;
