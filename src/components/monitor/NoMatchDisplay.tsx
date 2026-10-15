/**
 * NoMatchDisplay - Anzeige ohne laufendes Spiel (aus LiveMatchDisplay ausgelagert, B-44a2)
 */

import { CSSProperties } from 'react';
import { cssVars } from '../../design-tokens';
import type { MonitorTheme } from '../../types/monitor';
import { useMonitorTheme } from '../../hooks';

export interface NoMatchDisplayProps {
  message?: string;
  size?: 'md' | 'lg' | 'xl';
  fullscreen?: boolean;
  theme?: MonitorTheme;
}

export const NoMatchDisplay: React.FC<NoMatchDisplayProps> = ({
  message = 'Kein laufendes Spiel',
  size = 'xl',
  fullscreen = false,
  theme = 'dark',
}) => {
  const { themeColors } = useMonitorTheme(theme);

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: fullscreen ? 'clamp(32px, 4vw, 64px)' : size === 'xl' ? '64px' : cssVars.spacing.xxl,
    background: themeColors.backgroundGradient,
    borderRadius: fullscreen ? 0 : cssVars.borderRadius.xl,
    border: fullscreen ? 'none' : `3px solid ${themeColors.border}`,
    minHeight: fullscreen ? '100%' : size === 'xl' ? '50vh' : '35vh',
    height: fullscreen ? '100%' : 'auto',
    width: '100%',
    maxWidth: fullscreen ? 'none' : '1200px',
    margin: '0 auto',
    boxShadow: fullscreen ? 'none' : cssVars.shadows.lg,
  };

  return (
    <div style={containerStyle}>
      <div style={{ fontSize: size === 'xl' ? '100px' : '72px', marginBottom: cssVars.spacing.xl, opacity: 0.6 }}>
        ⏸️
      </div>
      <div style={{
        fontSize: size === 'xl' ? 'clamp(36px, 4vw, 48px)' : '28px',
        fontWeight: 600,
        color: themeColors.text,
        textAlign: 'center',
        textShadow: themeColors.textShadowLight,
      }}>
        {message}
      </div>
      <div style={{
        fontSize: size === 'xl' ? 'clamp(18px, 2vw, 24px)' : '18px',
        color: themeColors.textSecondary,
        marginTop: cssVars.spacing.lg,
        textAlign: 'center',
      }}>
        Die Tabellen werden angezeigt, bis ein Spiel gestartet wird
      </div>
    </div>
  );
};
