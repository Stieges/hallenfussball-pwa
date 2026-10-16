import { cssVars, displayColors, displaySpacing, displayTransitions, zIndex, displayMonitor } from '../../../design-tokens';

interface SlideDotsProps {
  count: number;
  currentIndex: number;
  enableTransitions: boolean;
}

/** Positionsanzeige unten: ein Punkt je Folie, die aktuelle hervorgehoben. */
export function SlideDots({ count, currentIndex, enableTransitions }: SlideDotsProps) {
  return (
    <div style={{
      position: 'fixed',
      bottom: displaySpacing.contentLG,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: displaySpacing.inlineSM,
      zIndex: zIndex.sticky,
    }}>
      {Array.from({ length: count }, (_, idx) => (
        <div
          key={idx}
          style={{
            width: displayMonitor.marker.indicatorSize,
            height: displayMonitor.marker.indicatorSize,
            borderRadius: cssVars.borderRadius.full,
            background: idx === currentIndex
              ? displayColors.primary
              : displayColors.textMuted,
            opacity: idx === currentIndex ? 1 : 0.4,
            transition: enableTransitions ? `all ${displayTransitions.hover.duration} ease` : 'none',
          }}
        />
      ))}
    </div>
  );
}

/** Keyframes der Folien-Animationen und Reduced-Motion-Regel. */
export function MonitorKeyframes() {
  return (
    <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.95); }
        }

        @keyframes liveDotPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.3);
            opacity: 0.8;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
  );
}
