/**
 * Color Utilities for WCAG Contrast Validation and Theme Management
 *
 * Provides functions for:
 * - WCAG 2.1 contrast ratio calculation
 * - Accessibility validation (AA/AAA levels)
 * - Color manipulation (darken, lighten)
 * - Optimal text color detection
 */

// ============================================================================
// Types
// ============================================================================

export type WcagLevel = 'AAA' | 'AA' | 'AA-Large' | 'Fail'

export interface ColorValidation {
  isValid: boolean
  contrastRatio: number
  wcagLevel: WcagLevel
  suggestion?: string
}

export interface HslColor {
  h: number // 0-360
  s: number // 0-100
  l: number // 0-100
}

export interface RgbColor {
  r: number // 0-255
  g: number // 0-255
  b: number // 0-255
}

// ============================================================================
// Color Conversion
// ============================================================================

/**
 * Converts hex color to RGB tuple
 * @param hex - Hex color string (with or without #)
 * @returns RGB object
 * @throws Error if hex format is invalid
 */
export function hexToRgb(hex: string): RgbColor {
  // Remove # if present
  const cleanHex = hex.replace(/^#/, '')

  // Handle shorthand hex (e.g., #FFF)
  const fullHex =
    cleanHex.length === 3
      ? cleanHex
          .split('')
          .map((c) => c + c)
          .join('')
      : cleanHex

  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex)

  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`)
  }

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}

/**
 * Converts RGB to hex color
 */
export function rgbToHex(rgb: RgbColor): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')

  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase()
}

/**
 * Converts hex color to HSL
 */
export function hexToHsl(hex: string): HslColor {
  const { r, g, b } = hexToRgb(hex)

  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255

  const max = Math.max(rNorm, gNorm, bNorm)
  const min = Math.min(rNorm, gNorm, bNorm)
  const l = (max + min) / 2

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 }
  }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h = 0
  switch (max) {
    case rNorm:
      h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6
      break
    case gNorm:
      h = ((bNorm - rNorm) / d + 2) / 6
      break
    case bNorm:
      h = ((rNorm - gNorm) / d + 4) / 6
      break
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

/**
 * Converts HSL to hex color
 */
export function hslToHex(hsl: HslColor): string {
  const h = hsl.h / 360
  const s = hsl.s / 100
  const l = hsl.l / 100

  let r: number, g: number, b: number

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) {t += 1}
      if (t > 1) {t -= 1}
      if (t < 1 / 6) {return p + (q - p) * 6 * t}
      if (t < 1 / 2) {return q}
      if (t < 2 / 3) {return p + (q - p) * (2 / 3 - t) * 6}
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return rgbToHex({
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  })
}

// ============================================================================
// WCAG Contrast Calculation
// ============================================================================

/**
 * Calculates relative luminance per WCAG 2.1
 * @see https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function getLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)

  const toLinear = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

/**
 * Calculates contrast ratio between two colors
 * @returns Contrast ratio (1:1 to 21:1)
 */
export function getContrastRatio(foreground: string, background: string): number {
  const l1 = getLuminance(foreground)
  const l2 = getLuminance(background)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Checks if color combination meets WCAG AA for normal text (4.5:1)
 */
export function meetsWcagAA(foreground: string, background: string): boolean {
  return getContrastRatio(foreground, background) >= 4.5
}

/**
 * Checks if color combination meets WCAG AA for large text (3:1)
 * Large text: 18pt or 14pt bold
 */
export function meetsWcagAALarge(foreground: string, background: string): boolean {
  return getContrastRatio(foreground, background) >= 3.0
}

/**
 * Checks if color combination meets WCAG AAA (7:1)
 */
export function meetsWcagAAA(foreground: string, background: string): boolean {
  return getContrastRatio(foreground, background) >= 7.0
}

/**
 * Gets WCAG compliance level for color combination
 */
export function getWcagLevel(foreground: string, background: string): WcagLevel {
  const ratio = getContrastRatio(foreground, background)
  if (ratio >= 7.0) {return 'AAA'}
  if (ratio >= 4.5) {return 'AA'}
  if (ratio >= 3.0) {return 'AA-Large'}
  return 'Fail'
}

// ============================================================================
// Color Manipulation
// ============================================================================

/**
 * Darkens a color by a percentage
 * @param hex - Input hex color
 * @param percent - Percentage to darken (0-100)
 */
export function darken(hex: string, percent: number): string {
  const hsl = hexToHsl(hex)
  hsl.l = Math.max(0, hsl.l - percent)
  return hslToHex(hsl)
}

/**
 * Lightens a color by a percentage
 * @param hex - Input hex color
 * @param percent - Percentage to lighten (0-100)
 */
export function lighten(hex: string, percent: number): string {
  const hsl = hexToHsl(hex)
  hsl.l = Math.min(100, hsl.l + percent)
  return hslToHex(hsl)
}

/**
 * Adjusts color saturation
 * @param hex - Input hex color
 * @param percent - Positive to saturate, negative to desaturate
 */
export function saturate(hex: string, percent: number): string {
  const hsl = hexToHsl(hex)
  hsl.s = Math.max(0, Math.min(100, hsl.s + percent))
  return hslToHex(hsl)
}

/**
 * Creates a semi-transparent version of a color
 * @param hex - Input hex color
 * @param alpha - Opacity (0-1)
 */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ============================================================================
// Text Color Detection
// ============================================================================

/**
 * Determines optimal text color (black or white) for given background
 * Uses WCAG contrast ratio to determine readability
 */
export function getOptimalTextColor(background: string): '#FFFFFF' | '#000000' {
  const whiteContrast = getContrastRatio('#FFFFFF', background)
  const blackContrast = getContrastRatio('#000000', background)
  return whiteContrast > blackContrast ? '#FFFFFF' : '#000000'
}

/**
 * Checks if a color is considered "light" (lightness > 50%)
 */
export function isLightColor(hex: string): boolean {
  const hsl = hexToHsl(hex)
  return hsl.l > 50
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validates a corporate/theme color for accessibility
 * Checks contrast against app background (#0A1628)
 */
export function validateCorporateColor(
  color: string,
  background: string = '#0A1628'
): ColorValidation {
  try {
    const ratio = getContrastRatio(color, background)
    const level = getWcagLevel(color, background)
    const isValid = level !== 'Fail'

    let suggestion: string | undefined
    if (!isValid) {
      suggestion = `Kontrast ${ratio.toFixed(1)}:1 ist zu niedrig. Mindestens 3:1 erforderlich.`
    }

    return { isValid, contrastRatio: ratio, wcagLevel: level, suggestion }
  } catch (error) {
    return {
      isValid: false,
      contrastRatio: 0,
      wcagLevel: 'Fail',
      suggestion: 'Ungültiges Farbformat. Bitte Hex-Farbe verwenden (#RRGGBB).',
    }
  }
}

/**
 * Validates that text on a colored background is readable
 */
export function validateTextOnColor(
  textColor: string,
  backgroundColor: string,
  isLargeText: boolean = false
): ColorValidation {
  try {
    const ratio = getContrastRatio(textColor, backgroundColor)
    const requiredRatio = isLargeText ? 3.0 : 4.5
    const isValid = ratio >= requiredRatio

    return {
      isValid,
      contrastRatio: ratio,
      wcagLevel: getWcagLevel(textColor, backgroundColor),
      suggestion: isValid
        ? undefined
        : `Kontrast ${ratio.toFixed(1)}:1 zu niedrig. Mindestens ${requiredRatio}:1 für ${isLargeText ? 'großen' : 'normalen'} Text erforderlich.`,
    }
  } catch {
    return {
      isValid: false,
      contrastRatio: 0,
      wcagLevel: 'Fail',
      suggestion: 'Ungültiges Farbformat.',
    }
  }
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Default app colors for reference
 */
export const APP_COLORS = {
  background: '#0A1628',
  surface: '#1E293B',
  primary: '#00E676',
  secondary: '#00B0FF',
  textPrimary: '#FFFFFF',
  textSecondary: '#A3B8D4',
} as const
