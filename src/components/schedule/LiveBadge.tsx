/**
 * LiveBadge - MON-LIVE-INDICATOR-01
 *
 * Visual indicator for matches that are currently running.
 * Shows a pulsing "LIVE" badge with animation.
 */

import { CSSProperties } from 'react';
import { borderRadius, colors, fontSizes, fontSizesMd3, fontWeights, letterSpacing } from '../../design-tokens';
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
  const badgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: compact ? '3px' : '5px',
    padding: compact ? '2px 6px' : '3px 8px',
    background: colors.statusLiveBg,
    border: `1px solid ${colors.statusLive}`,
    borderRadius: borderRadius.sm,
    fontSize: compact ? fontSizesMd3.statLabel : fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.statusLive,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.wide,
    animation: 'livePulse 2s ease-in-out infinite',
    ...style,
  };

  const dotStyle: CSSProperties = {
    width: compact ? '5px' : '6px',
    height: compact ? '5px' : '6px',
    borderRadius: '50%',
    background: colors.statusLive,
    animation: 'liveDot 1s ease-in-out infinite',
  };

  return (
    <>
      <span style={badgeStyle} role="status" aria-label="Spiel läuft gerade">
        <span style={dotStyle} aria-hidden="true" />
        <span>Live</span>
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
