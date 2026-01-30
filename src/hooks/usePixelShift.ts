/**
 * usePixelShift - Anti-Burn-In protection for OLED/Plasma displays
 *
 * Shifts the entire content by 1-2px every 60s in a random direction.
 * The shift is imperceptible to viewers but prevents static pixel burn-in.
 *
 * @see MONITOR-LIVE-SCORE-REDESIGN.md Section 17
 */

import { useState, useEffect } from 'react';

interface PixelShiftStyle {
  transform: string;
  transition: string;
}

const IDENTITY: PixelShiftStyle = { transform: 'translate(0px, 0px)', transition: 'none' };

export function usePixelShift(
  intervalMs = 60_000,
  maxShiftPx = 2,
  enabled = true,
): PixelShiftStyle {
  const [shift, setShift] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Respect reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const timer = setInterval(() => {
      setShift({
        x: Math.round((Math.random() - 0.5) * maxShiftPx * 2),
        y: Math.round((Math.random() - 0.5) * maxShiftPx * 2),
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs, maxShiftPx, enabled]);

  if (!enabled) {
    return IDENTITY;
  }

  return {
    transform: `translate(${shift.x}px, ${shift.y}px)`,
    transition: 'transform 2s ease-in-out',
  };
}
