/**
 * LiveBadge - MON-LIVE-INDICATOR-01
 *
 * Visual indicator for matches that are currently running.
 * Shows a pulsing "LIVE" badge with animation.
 */

import { CSSProperties } from 'react';
import { theme } from '../../styles/theme';

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
    background: theme.colors.status.liveBg,
    border: `1px solid ${theme.colors.status.live}`,
    borderRadius: theme.borderRadius.sm,
    fontSize: compact ? '10px' : '11px',
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.status.live,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    animation: 'livePulse 2s ease-in-out infinite',
    ...style,
  };

  const dotStyle: CSSProperties = {
    width: compact ? '5px' : '6px',
    height: compact ? '5px' : '6px',
    borderRadius: '50%',
    background: theme.colors.status.live,
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
