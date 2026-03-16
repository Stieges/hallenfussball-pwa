/**
 * LiveBadge - MON-LIVE-INDICATOR-01
 *
 * Visual indicator for matches that are currently running.
 * Shows a pulsing "LIVE" badge with animation.
 */

import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, fontSizesMd3, letterSpacing } from '../../design-tokens'
interface LiveBadgeProps {
  /** Optional compact mode for smaller displays */
  compact?: boolean;
  /** Optional custom style override */
  style?: CSSProperties;
}

export const LiveBadge: React.FC<LiveBadgeProps> = ({
  compact = false,
  style,
}) => {
  const { t } = useTranslation('tournament');
  const badgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: compact ? '3px' : '5px',
    padding: compact ? '2px 6px' : '3px 8px',
    background: cssVars.colors.statusLiveBg,
    border: `1px solid ${cssVars.colors.statusLive}`,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: compact ? fontSizesMd3.statLabel : cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.statusLive,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.wide,
    animation: 'livePulse 2s ease-in-out infinite',
    ...style,
  };

  const dotStyle: CSSProperties = {
    width: compact ? '5px' : '6px',
    height: compact ? '5px' : '6px',
    borderRadius: '50%',
    background: cssVars.colors.statusLive,
    animation: 'liveDot 1s ease-in-out infinite',
  };

  return (
    <>
      <span style={badgeStyle} role="status" aria-label={t('liveBadge.ariaLabel')}>
        <span style={dotStyle} aria-hidden="true" />
        <span>{t('liveBadge.live')}</span>
      </span>

      <style>{`
        @keyframes livePulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        @keyframes liveDot {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.3);
            opacity: 0.8;
          }
        }
      `}</style>
    </>
  );
};

export default LiveBadge;
