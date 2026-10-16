/**
 * NoMatchDisplay - Anzeige ohne laufendes Spiel (aus LiveMatchDisplay ausgelagert, B-44a2)
 * B-44a3: Maße aus den Tokens (displayNoMatch), Texte über i18n.
 */

import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayNoMatch } from '../../design-tokens';
import type { MonitorTheme } from '../../types/monitor';
import { useMonitorTheme } from '../../hooks';

export interface NoMatchDisplayProps {
  /** Überschrift; ohne Angabe der übersetzte Standardtext */
  message?: string;
  size?: 'md' | 'lg' | 'xl';
  fullscreen?: boolean;
  theme?: MonitorTheme;
}

export const NoMatchDisplay: React.FC<NoMatchDisplayProps> = ({
  message,
  size = 'xl',
  fullscreen = false,
  theme = 'dark',
}) => {
  const { t } = useTranslation('monitor');
  const { themeColors } = useMonitorTheme(theme);
  const sizes = size === 'xl' ? displayNoMatch.xl : displayNoMatch.lg;

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: fullscreen ? sizes.padding : size === 'xl' ? sizes.padding : cssVars.spacing.xxl,
    background: themeColors.backgroundGradient,
    borderRadius: fullscreen ? 0 : cssVars.borderRadius.xl,
    border: fullscreen ? 'none' : `${displayNoMatch.borderWidth} solid ${themeColors.border}`,
    minHeight: fullscreen ? '100%' : size === 'xl' ? displayNoMatch.minHeightXl : displayNoMatch.minHeightLg,
    height: fullscreen ? '100%' : 'auto',
    width: '100%',
    maxWidth: fullscreen ? 'none' : displayNoMatch.maxWidth,
    margin: '0 auto',
    boxShadow: fullscreen ? 'none' : cssVars.shadows.lg,
  };

  return (
    <div style={containerStyle}>
      <div data-testid="no-match-icon" style={{ fontSize: sizes.icon, marginBottom: cssVars.spacing.xl, opacity: 0.6 }}>
        ⏸️
      </div>
      <div
        data-testid="no-match-title"
        style={{
          fontSize: sizes.title,
          fontWeight: 600,
          color: themeColors.text,
          textAlign: 'center',
          textShadow: themeColors.textShadowLight,
        }}
      >
        {message ?? t('liveMatch.noRunningMatch')}
      </div>
      <div
        data-testid="no-match-text"
        style={{
          fontSize: sizes.text,
          color: themeColors.textSecondary,
          marginTop: cssVars.spacing.lg,
          textAlign: 'center',
        }}
      >
        {t('liveMatch.tablesShownMessage')}
      </div>
    </div>
  );
};
