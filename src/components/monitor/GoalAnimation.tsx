/**
 * GoalAnimation - Goal celebration overlay for monitor view
 *
 * Features:
 * - Triggered when a new goal event is detected
 * - Shows celebratory animation for 2 seconds
 * - Queue system for multiple rapid goals
 * - Positioned on the scoring team's side (left/right)
 * - Accessible: respects prefers-reduced-motion
 * - Auto-clears after animation completes
 */

import { CSSProperties, useEffect, useState, useRef, useMemo, useCallback } from 'react';
// eslint-disable-next-line local-rules/prefer-css-vars -- confettiColors is an array, not CSS var compatible
import { cssVars, colors } from '../../design-tokens'
import { GoalEventInfo } from '../../hooks/useLiveMatches';

export interface GoalAnimationProps {
  /** Goal event info (null if no goal to show) */
  goalEvent: GoalEventInfo | null;
  /** Callback to clear the goal event after animation */
  onAnimationComplete: () => void;
  /** Animation duration in ms (default: 2000) */
  animationDuration?: number;
}

// Pre-generate confetti data to avoid recalculation
const CONFETTI_COUNT = 12;
const preGeneratedConfetti = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
  id: i,
  leftPercent: (i * 8.3) + (i % 3) * 2, // Distributed evenly
  delay: (i % 4) * 0.1,
  duration: 1.2 + (i % 3) * 0.3,
  colorIndex: i % 4,
  size: 8 + (i % 3) * 4,
  isCircle: i % 2 === 0,
}));

// Use design tokens for confetti colors (array - not CSS variable compatible)
const CONFETTI_COLORS = colors.confettiColors;

export const GoalAnimation: React.FC<GoalAnimationProps> = ({
  goalEvent,
  onAnimationComplete,
  animationDuration = 2000,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<GoalEventInfo | null>(null);
  const [animationKey, setAnimationKey] = useState(0);

  // Queue for multiple goals
  const goalQueue = useRef<GoalEventInfo[]>([]);
  const isAnimating = useRef(false);
  const seenTimestamps = useRef<Set<number>>(new Set());

  // Ref to hold the processNextGoal function for recursive calls
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- Initialized in useCallback below
  const processNextGoalRef = useRef<() => void>(() => {});

  /**
   * Process the next goal in queue
   */
  const processNextGoal = useCallback(() => {
    if (goalQueue.current.length === 0) {
      isAnimating.current = false;
      return;
    }

    isAnimating.current = true;
    const nextGoal = goalQueue.current.shift();
    if (!nextGoal) {return;} // Should never happen due to length check above
    setCurrentEvent(nextGoal);
    setAnimationKey(prev => prev + 1);
    setIsVisible(true);

    // Auto-hide after animation duration
    setTimeout(() => {
      setIsVisible(false);
      // Short delay before processing next
      setTimeout(() => {
        setCurrentEvent(null);
        onAnimationComplete();
        // Use ref for recursive call to avoid stale closure
        processNextGoalRef.current();
      }, 200);
    }, animationDuration);
  }, [animationDuration, onAnimationComplete]);

  // Keep ref in sync with latest callback
  processNextGoalRef.current = processNextGoal;

  /**
   * Handle new goal event - add to queue
   */
  useEffect(() => {
    if (goalEvent && !seenTimestamps.current.has(goalEvent.timestamp)) {
      seenTimestamps.current.add(goalEvent.timestamp);
      goalQueue.current.push(goalEvent);

      // Start processing if not already animating
      if (!isAnimating.current) {
        processNextGoal();
      }
    }
  }, [goalEvent, processNextGoal]);

  // Cleanup old timestamps periodically
  useEffect(() => {
    if (seenTimestamps.current.size > 100) {
      const arr = Array.from(seenTimestamps.current);
      seenTimestamps.current = new Set(arr.slice(-50));
    }
  }, [goalEvent]);

  // Memoize confetti to prevent recalculation
  const confettiElements = useMemo(() => preGeneratedConfetti, []);

  if (!isVisible || !currentEvent) {
    return null;
  }

  const isHomeSide = currentEvent.side === 'home';

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: isHomeSide ? 'flex-start' : 'flex-end',
    padding: '8%',
    pointerEvents: 'none',
    zIndex: 2000,
  };

  const celebrationContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: 'clamp(24px, 4vw, 48px)',
    background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.97) 0%, rgba(0, 180, 90, 0.97) 100%)',
    borderRadius: cssVars.borderRadius.xl,
    boxShadow: '0 0 100px rgba(0, 230, 118, 0.7), 0 20px 60px rgba(0, 0, 0, 0.5)',
    transformOrigin: isHomeSide ? 'left center' : 'right center',
    maxWidth: 'clamp(300px, 30vw, 450px)',
    textAlign: 'center',
  };

  const goalIconStyle: CSSProperties = {
    fontSize: 'clamp(60px, 8vw, 100px)',
  };

  const goalTextStyle: CSSProperties = {
    fontSize: 'clamp(40px, 6vw, 72px)',
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.onPrimary,
    fontFamily: cssVars.fontFamilies.heading,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    textShadow: '2px 2px 4px rgba(255, 255, 255, 0.3)',
  };

  const teamNameStyle: CSSProperties = {
    fontSize: 'clamp(20px, 3vw, 32px)',
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.onPrimary,
    opacity: 0.9,
  };

  const scoreStyle: CSSProperties = {
    fontSize: 'clamp(28px, 4vw, 48px)',
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.onPrimary,
    fontFamily: cssVars.fontFamilies.heading,
    marginTop: cssVars.spacing.xs,
  };

  return (
    <>
      <div style={overlayStyle} key={animationKey}>
        <div
          style={celebrationContainerStyle}
          className="goal-celebration-box"
        >
          <div className="goal-icon" style={goalIconStyle}>⚽</div>
          <div style={goalTextStyle}>TOR!</div>
          <div style={teamNameStyle}>{currentEvent.teamName}</div>
          <div style={scoreStyle}>
            {currentEvent.newScore.home} : {currentEvent.newScore.away}
          </div>
        </div>

        {/* Confetti overlay - simplified */}
        <div
          className="confetti-container"
          style={{
            position: 'absolute',
            top: 0,
            left: isHomeSide ? 0 : 'auto',
            right: isHomeSide ? 'auto' : 0,
            width: '50%',
            height: '100%',
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {confettiElements.map((confetti) => (
            <div
              key={confetti.id}
              className="confetti-piece"
              style={{
                position: 'absolute',
                left: `${confetti.leftPercent}%`,
                top: '-20px',
                width: `${confetti.size}px`,
                height: `${confetti.size}px`,
                backgroundColor: CONFETTI_COLORS[confetti.colorIndex],
                borderRadius: confetti.isCircle ? '50%' : '2px',
                animationDelay: `${confetti.delay}s`,
                animationDuration: `${confetti.duration}s`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        .goal-celebration-box {
          animation: goalPop 2s ease-out forwards;
        }

        .goal-icon {
          animation: goalBounce 0.5s ease-out;
        }

        .confetti-piece {
          animation: confettiFall 1.5s ease-out forwards;
          will-change: transform, opacity;
        }

        @keyframes goalPop {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          12% {
            transform: scale(1.1);
            opacity: 1;
          }
          20% {
            transform: scale(1);
          }
          80% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(0.95);
            opacity: 0;
          }
        }

        @keyframes goalBounce {
          0% {
            transform: translateY(0) scale(1);
          }
          30% {
            transform: translateY(-25px) scale(1.1);
          }
          60% {
            transform: translateY(0) scale(1);
          }
          80% {
            transform: translateY(-10px) scale(1.03);
          }
          100% {
            transform: translateY(0) scale(1);
          }
        }

        @keyframes confettiFall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(80vh) rotate(540deg);
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .goal-celebration-box {
            animation: goalFadeSimple 2s ease-out forwards;
          }

          .goal-icon {
            animation: none;
          }

          .confetti-piece {
            animation: none;
            opacity: 0;
          }

          @keyframes goalFadeSimple {
            0% { opacity: 0; }
            15% { opacity: 1; }
            85% { opacity: 1; }
            100% { opacity: 0; }
          }
        }
      `}</style>
    </>
  );
};

/**
 * Simple goal flash overlay (alternative for performance-constrained devices)
 */
export interface GoalFlashProps {
  /** Whether to show the flash */
  show: boolean;
  /** Which side scored */
  side: 'home' | 'away';
}

export const GoalFlash: React.FC<GoalFlashProps> = ({ show, side }) => {
  if (!show) {return null;}

  const isHome = side === 'home';

  const flashStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: isHome ? 0 : '50%',
    right: isHome ? '50%' : 0,
    background: `linear-gradient(${isHome ? '90deg' : '270deg'}, rgba(0, 230, 118, 0.4) 0%, transparent 100%)`,
    animation: 'goalFlash 0.5s ease-out forwards',
    pointerEvents: 'none',
    zIndex: 1500,
  };

  return (
    <>
      <div style={flashStyle} />
      <style>{`
        @keyframes goalFlash {
          0% { opacity: 0; }
          30% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </>
  );
};
