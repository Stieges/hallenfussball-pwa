export const theme = {
  colors: {
    background: '#0A1628',
    surface: 'rgba(255,255,255,0.05)',
    surfaceHover: 'rgba(255,255,255,0.08)',
    primary: '#00E676',
    primaryDark: '#00C853',
    secondary: '#00B0FF',
    accent: '#FFD700',
    warning: '#FF9100',
    error: '#FF5252',
    success: '#4CAF50',
    text: {
      primary: '#FFFFFF',
      secondary: '#8BA3C7',
      muted: 'rgba(255,255,255,0.5)',
    },
    border: 'rgba(255,255,255,0.1)',
    borderActive: 'rgba(0,230,118,0.3)',
    // Status colors for tournament badges
    status: {
      live: '#00B0FF',
      liveBg: 'rgba(0,176,255,0.15)',
      upcoming: '#4CAF50',
      upcomingBg: 'rgba(76,175,80,0.15)',
      finished: '#9E9E9E',
      finishedBg: 'rgba(158,158,158,0.15)',
      draft: '#FF9100',
      draftBg: 'rgba(255,145,0,0.15)',
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

  borderRadius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
  },

  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },

  fontSizes: {
    xs: '11px',
    sm: '12px',
    md: '14px',
    lg: '16px',
    xl: '18px',
    xxl: '24px',
    xxxl: '32px',
  },

  fontWeights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  fonts: {
    heading: '"Bebas Neue", sans-serif',
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
} as const;

export type Theme = typeof theme;
