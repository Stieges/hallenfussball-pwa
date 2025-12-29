/**
 * useFontScale - Dynamic Font Scaling Hook
 *
 * Allows users to increase/decrease font sizes for better readability.
 * Persists preference and applies via CSS custom property.
 *
 * Konzept-Referenz: docs/concepts/LIVE-COCKPIT-KONZEPT.md §4.2
 *
 * Features:
 * - 5 scale levels (0.85, 1.0, 1.15, 1.3, 1.5)
 * - Persists to localStorage
 * - Applies via CSS --font-scale variable
 * - Respects system text size preference
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'fontScale';

// Available font scale levels
export const FONT_SCALES = [0.85, 1.0, 1.15, 1.3, 1.5] as const;
export type FontScale = (typeof FONT_SCALES)[number];

// Labels for UI
export const FONT_SCALE_LABELS: Record<FontScale, string> = {
  0.85: 'Klein',
  1.0: 'Normal',
  1.15: 'Groß',
  1.3: 'Sehr groß',
  1.5: 'Extra groß',
};

interface UseFontScaleReturn {
  /** Current font scale (1.0 = 100%) */
  fontScale: FontScale;
  /** Current scale index (0-4) */
  scaleIndex: number;
  /** Human-readable label */
  scaleLabel: string;
  /** Set font scale directly */
  setFontScale: (scale: FontScale) => void;
  /** Increase font scale by one step */
  increaseFontScale: () => void;
  /** Decrease font scale by one step */
  decreaseFontScale: () => void;
  /** Reset to default (1.0) */
  resetFontScale: () => void;
  /** Whether increase is possible */
  canIncrease: boolean;
  /** Whether decrease is possible */
  canDecrease: boolean;
  /** All available scales */
  availableScales: readonly FontScale[];
}

/**
 * Get saved scale from localStorage
 */
function getSavedScale(): FontScale | null {
  if (typeof window === 'undefined') {return null;}

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) {return null;}

    const parsed = parseFloat(saved);
    if (FONT_SCALES.includes(parsed as FontScale)) {
      return parsed as FontScale;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save scale to localStorage
 */
function saveScale(scale: FontScale): void {
  if (typeof window === 'undefined') {return;}

  try {
    localStorage.setItem(STORAGE_KEY, String(scale));
  } catch {
    // localStorage might be blocked
  }
}

/**
 * Apply font scale via CSS custom property
 */
function applyScale(scale: FontScale): void {
  if (typeof document === 'undefined') {return;}

  document.documentElement.style.setProperty('--font-scale', String(scale));
  document.documentElement.setAttribute('data-font-scale', String(scale));
}

export function useFontScale(): UseFontScaleReturn {
  const [fontScale, setFontScaleState] = useState<FontScale>(() => {
    return getSavedScale() ?? 1.0;
  });

  // Apply scale on mount and changes
  useEffect(() => {
    applyScale(fontScale);
  }, [fontScale]);

  const scaleIndex = useMemo(() => {
    return FONT_SCALES.indexOf(fontScale);
  }, [fontScale]);

  const scaleLabel = useMemo(() => {
    return FONT_SCALE_LABELS[fontScale];
  }, [fontScale]);

  const canIncrease = scaleIndex < FONT_SCALES.length - 1;
  const canDecrease = scaleIndex > 0;

  const setFontScale = useCallback((scale: FontScale) => {
    if (!FONT_SCALES.includes(scale)) {return;}
    setFontScaleState(scale);
    saveScale(scale);
  }, []);

  const increaseFontScale = useCallback(() => {
    if (!canIncrease) {return;}
    const newScale = FONT_SCALES[scaleIndex + 1];
    setFontScale(newScale);
  }, [canIncrease, scaleIndex, setFontScale]);

  const decreaseFontScale = useCallback(() => {
    if (!canDecrease) {return;}
    const newScale = FONT_SCALES[scaleIndex - 1];
    setFontScale(newScale);
  }, [canDecrease, scaleIndex, setFontScale]);

  const resetFontScale = useCallback(() => {
    setFontScale(1.0);
  }, [setFontScale]);

  return {
    fontScale,
    scaleIndex,
    scaleLabel,
    setFontScale,
    increaseFontScale,
    decreaseFontScale,
    resetFontScale,
    canIncrease,
    canDecrease,
    availableScales: FONT_SCALES,
  };
}

export default useFontScale;
