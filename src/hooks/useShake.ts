import { useState, useCallback, useEffect } from 'react';
import { durationsMs } from '../styles/motion';

interface UseShakeOptions {
  /** Duration of shake animation in ms (default: 300) */
  duration?: number;
  /** Whether to respect prefers-reduced-motion (default: true) */
  respectReducedMotion?: boolean;
}

interface UseShakeReturn {
  /** Trigger the shake animation */
  shake: () => void;
  /** Whether currently shaking */
  isShaking: boolean;
  /** CSS class to apply when shaking */
  shakeClass: string;
  /** Inline style object for shake animation */
  shakeStyle: React.CSSProperties;
}

/**
 * Hook to trigger shake animation for error feedback.
 *
 * Respects `prefers-reduced-motion` by default.
 *
 * @example
 * function FormInput() {
 *   const { shake, shakeStyle } = useShake();
 *
 *   const handleError = () => {
 *     shake();
 *     // Show error message...
 *   };
 *
 *   return <input style={shakeStyle} onError={handleError} />;
 * }
 */
export function useShake(options: UseShakeOptions = {}): UseShakeReturn {
  const { duration = durationsMs.slow, respectReducedMotion = true } = options;

  const [isShaking, setIsShaking] = useState(false);
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

  const shake = useCallback(() => {
    // Skip animation if reduced motion is preferred
    if (prefersReducedMotion) {
      return;
    }

    setIsShaking(true);
    setTimeout(() => setIsShaking(false), duration);
  }, [duration, prefersReducedMotion]);

  const shakeStyle: React.CSSProperties = isShaking
    ? {
        animation: `shake ${duration}ms cubic-bezier(0.2, 0, 0, 1)`,
      }
    : {};

  return {
    shake,
    isShaking,
    shakeClass: isShaking ? 'shaking' : '',
    shakeStyle,
  };
}

export default useShake;
