/**
 * Color Palette - Raw Color Values
 *
 * This file contains the raw color primitives used across the application.
 * These are the "source of truth" colors that semantic tokens reference.
 *
 * IMPORTANT: Do not use these directly in components!
 * Use semantic tokens from ./semantic.ts or ./semantic-light.ts instead.
 *
 * Naming convention: color-scale (e.g., green-400)
 * Scales go from 50 (lightest) to 950 (darkest)
 */

export const palette = {
  // ---------------------------------------------------------------------------
  // Brand Colors - Primary Green
  // ---------------------------------------------------------------------------
  green: {
    50: '#E8FFF0',
    100: '#C6FFD9',
    200: '#8FFDB8',
    300: '#4DF997',
    400: '#00E676', // Primary brand color
    500: '#00B862',
    600: '#008F4C',
    700: '#006637',
    800: '#003D21',
    900: '#00140B',
  },

  // ---------------------------------------------------------------------------
  // Secondary - Blue
  // ---------------------------------------------------------------------------
  blue: {
    50: '#E6F7FF',
    100: '#BAE7FF',
    200: '#91D5FF',
    300: '#69C0FF',
    400: '#40A9FF',
    500: '#00B0FF', // Secondary accent
    600: '#0096E6',
    700: '#007ACC',
    800: '#005EB3',
    900: '#004299',
  },

  // ---------------------------------------------------------------------------
  // Neutral - Grays
  // ---------------------------------------------------------------------------
  neutral: {
    0: '#FFFFFF',
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#0A1628',
  },

  // ---------------------------------------------------------------------------
  // Status Colors
  // ---------------------------------------------------------------------------
  red: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#FF5252', // Error
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
  },

  orange: {
    50: '#FFF7ED',
    100: '#FFEDD5',
    200: '#FED7AA',
    300: '#FDBA74',
    400: '#FF9100', // Warning
    500: '#F97316',
    600: '#EA580C',
    700: '#C2410C',
    800: '#9A3412',
    900: '#7C2D12',
  },

  amber: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706', // Light mode warning
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },

  yellow: {
    400: '#FACC15',
    500: '#EAB308',
    600: '#CA8A04', // Gold
  },

  // ---------------------------------------------------------------------------
  // Success - Emerald (darker green for Light Mode)
  // ---------------------------------------------------------------------------
  emerald: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981',
    600: '#059669', // Light mode primary
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
  },

  // ---------------------------------------------------------------------------
  // Info/Accent - Purple
  // ---------------------------------------------------------------------------
  purple: {
    400: '#A78BFA',
    500: '#8B5CF6',
    600: '#7C3AED',
  },

  // ---------------------------------------------------------------------------
  // Special Colors
  // ---------------------------------------------------------------------------
  special: {
    gold: '#FFD700',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
    live: '#DC2626', // Pulse red for LIVE indicator
  },
} as const;

// Type exports
export type PaletteColor = keyof typeof palette;
export type Palette = typeof palette;
