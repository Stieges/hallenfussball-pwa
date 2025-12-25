import {
  fontFamilies,
  fontSizes as typographyFontSizes,
  lineHeights,
  typography,
} from './typography';

export const theme = {
  colors: {
    background: '#0A1628',
    surface: 'rgba(255,255,255,0.05)',
    surfaceHover: 'rgba(255,255,255,0.08)',
    surfaceDark: 'rgba(0,0,0,0.3)', // For score containers, input backgrounds
    primary: '#00E676',
    primaryDark: '#00C853',
    secondary: '#00B0FF',
    accent: '#FFD700',
    warning: '#FF9100',
    error: '#FF5252',
    success: '#4CAF50',
    text: {
      primary: '#FFFFFF',
      secondary: '#A3B8D4', // WCAG AA 5.1:1 on surface (was #8BA3C7 ~3.8:1)
      muted: 'rgba(255,255,255,0.5)',
      placeholder: '#9DB2CC', // WCAG AA 4.7:1 on surface (was #9575CD)
    },
    border: 'rgba(255,255,255,0.1)',
    borderActive: 'rgba(0,230,118,0.3)',
    // Status colors for tournament badges
    status: {
      live: '#00B0FF',
      liveBg: 'rgba(0,176,255,0.15)',
      liveRowBg: 'rgba(0,176,255,0.08)', // Subtle row highlight for running matches
      upcoming: '#4CAF50',
      upcomingBg: 'rgba(76,175,80,0.15)',
      finished: '#9E9E9E',
      finishedBg: 'rgba(158,158,158,0.15)',
      draft: '#FF9100',
      draftBg: 'rgba(255,145,0,0.15)',
      external: '#9575CD',
      externalBg: 'rgba(149,117,205,0.15)',
    },
    // Correction/Warning banner (dark theme compatible)
    correction: {
      bg: 'rgba(255,145,0,0.12)',
      border: 'rgba(255,145,0,0.4)',
      text: '#FFB74D',
      icon: '#FF9100',
    },
    // Medal colors (for rankings)
    medal: {
      gold: '#FFD700',
      silver: '#C0C0C0',
      bronze: '#CD7F32',
    },
  },

  gradients: {
    primary: 'linear-gradient(135deg, #00E676, #00B0FF)',
    surface: 'linear-gradient(135deg, rgba(0,230,118,0.1), rgba(0,176,255,0.1))',
    card: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.05))',
  },

  shadows: {
    sm: '0 2px 4px rgba(0,0,0,0.2)',
    md: '0 4px 12px rgba(0,0,0,0.3)',
    lg: '0 8px 24px rgba(0,0,0,0.4)',
  },

  // 8pt Grid System - All values are multiples of 8px (or 4px half-unit)
  borderRadius: {
    sm: '4px',   // 0.5x (half-unit for subtle rounding)
    md: '8px',   // 1x
    lg: '16px',  // 2x
    xl: '24px',  // 3x
  },

  // 8pt Grid Spacing Scale
  spacing: {
    xs: '4px',   // 0.5x (half-unit for tight spacing)
    sm: '8px',   // 1x
    md: '16px',  // 2x (was 12px - primary change for 8pt compliance)
    lg: '24px',  // 3x (was 16px)
    xl: '32px',  // 4x (was 24px)
    xxl: '48px', // 6x (was 32px)
  },

  // Typography - MD3 Type Scale (from typography.ts)
  typography,
  fontFamilies,
  lineHeights,

  // Legacy fontSizes (mapped to typography tokens for backward compatibility)
  fontSizes: {
    xs: typographyFontSizes.labelSmall,    // 11px
    sm: typographyFontSizes.labelMedium,   // 12px
    md: typographyFontSizes.bodyMedium,    // 14px
    lg: typographyFontSizes.bodyLarge,     // 16px
    xl: typographyFontSizes.titleLarge,    // 18px
    xxl: typographyFontSizes.headlineLarge, // 24px
    xxxl: typographyFontSizes.displaySmall, // 28px
  },

  fontWeights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  fonts: {
    display: fontFamilies.display,
    heading: fontFamilies.heading,
    body: fontFamilies.body,
    mono: fontFamilies.mono,
  },

  // Responsive breakpoints
  breakpoints: {
    mobile: '480px',   // Small phones
    tablet: '768px',   // Tablets and large phones
    desktop: '1024px', // Desktops
    wide: '1280px',    // Wide screens
  },

  // Media query helpers (for use in CSS modules)
  media: {
    mobile: '@media (max-width: 480px)',
    tablet: '@media (min-width: 481px) and (max-width: 768px)',
    tabletUp: '@media (min-width: 481px)',
    desktop: '@media (min-width: 769px)',
    wide: '@media (min-width: 1024px)',
  },
} as const;

export type Theme = typeof theme;
