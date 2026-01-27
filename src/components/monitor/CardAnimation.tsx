/**
 * CardAnimation - Card event overlay for monitor view
 *
 * Features:
 * - Triggered when a new yellow/red card event is detected
 * - Shows animation for 3 seconds (cards need attention)
 * - Queue system for multiple rapid cards
 * - Positioned on the penalized team's side (left/right)
 * - Yellow cards: warning styling
 * - Red cards: danger styling with stronger effect
 * - Accessible: respects prefers-reduced-motion
 * - Auto-clears after animation completes
 */

import { CSSProperties, useEffect, useState, useRef, useCallback } from 'react';
import { cssVars } from '../../design-tokens';

export interface CardEventInfo {
  matchId: string;
  teamId: string;
  teamName: string;
  side: 'home' | 'away';
  cardType: 'YELLOW' | 'RED';
  playerNumber?: number;
  timestamp: number;
}

export interface CardAnimationProps {
  /** Card event info (null if no card to show) */
  cardEvent: CardEventInfo | null;
  /** Callback to clear the card event after animation */
  onAnimationComplete: () => void;
  /** Animation duration in ms (default: 3000) */
  animationDuration?: number;
}

// Card-specific colors
const CARD_COLORS = {
  YELLOW: {
    primary: '#FFEB3B',
    secondary: '#FFC107',
    text: '#000000',
    glow: 'rgba(255, 235, 59, 0.6)',
    shadow: 'rgba(255, 193, 7, 0.5)',
  },
  RED: {
    primary: '#F44336',
    secondary: '#D32F2F',
    text: '#FFFFFF',
    glow: 'rgba(244, 67, 54, 0.6)',
    shadow: 'rgba(211, 47, 47, 0.5)',
  },
};

export const CardAnimation: React.FC<CardAnimationProps> = ({
  cardEvent,
  onAnimationComplete,
  animationDuration = 3000,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<CardEventInfo | null>(null);
  const [animationKey, setAnimationKey] = useState(0);

  // Queue for multiple cards
  const cardQueue = useRef<CardEventInfo[]>([]);
  const isAnimating = useRef(false);
  const seenTimestamps = useRef<Set<number>>(new Set());

  // Ref to hold the processNextCard function for recursive calls
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- Initialized in useCallback below
  const processNextCardRef = useRef<() => void>(() => {});

  /**
   * Process the next card in queue
   */
  const processNextCard = useCallback(() => {
    if (cardQueue.current.length === 0) {
      isAnimating.current = false;
      return;
    }

    isAnimating.current = true;
    const nextCard = cardQueue.current.shift();
    if (!nextCard) {return;}
    setCurrentEvent(nextCard);
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
        processNextCardRef.current();
      }, 200);
    }, animationDuration);
  }, [animationDuration, onAnimationComplete]);

  // Keep ref in sync with latest callback
  processNextCardRef.current = processNextCard;

  /**
   * Handle new card event - add to queue
   */
  useEffect(() => {
    if (cardEvent && !seenTimestamps.current.has(cardEvent.timestamp)) {
      seenTimestamps.current.add(cardEvent.timestamp);
      cardQueue.current.push(cardEvent);

      // Start processing if not already animating
      if (!isAnimating.current) {
        processNextCard();
      }
    }
  }, [cardEvent, processNextCard]);

  // Cleanup old timestamps periodically
  useEffect(() => {
    if (seenTimestamps.current.size > 100) {
      const arr = Array.from(seenTimestamps.current);
      seenTimestamps.current = new Set(arr.slice(-50));
    }
  }, [cardEvent]);

  if (!isVisible || !currentEvent) {
    return null;
  }

  const isHomeSide = currentEvent.side === 'home';
  const colors = CARD_COLORS[currentEvent.cardType];
  const isRed = currentEvent.cardType === 'RED';

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

  const cardContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: 'clamp(24px, 4vw, 48px)',
    background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
    borderRadius: cssVars.borderRadius.xl,
    boxShadow: `0 0 80px ${colors.glow}, 0 20px 60px ${colors.shadow}`,
    transformOrigin: isHomeSide ? 'left center' : 'right center',
    maxWidth: 'clamp(280px, 28vw, 400px)',
    textAlign: 'center',
  };

  const cardIconStyle: CSSProperties = {
    width: 'clamp(80px, 10vw, 140px)',
    height: 'clamp(110px, 14vw, 190px)',
    background: colors.primary,
    borderRadius: '12px',
    boxShadow: `
      0 4px 20px ${colors.shadow},
      inset 0 2px 4px rgba(255, 255, 255, 0.3),
      inset 0 -2px 4px rgba(0, 0, 0, 0.2)
    `,
    border: `4px solid ${colors.secondary}`,
  };

  const cardTextStyle: CSSProperties = {
    fontSize: 'clamp(32px, 5vw, 56px)',
    fontWeight: cssVars.fontWeights.bold,
    color: colors.text,
    fontFamily: cssVars.fontFamilies.heading,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    textShadow: isRed
      ? '2px 2px 4px rgba(0, 0, 0, 0.3)'
      : '1px 1px 2px rgba(0, 0, 0, 0.2)',
  };

  const teamNameStyle: CSSProperties = {
    fontSize: 'clamp(18px, 2.5vw, 28px)',
    fontWeight: cssVars.fontWeights.bold,
    color: colors.text,
    opacity: 0.9,
  };

  const playerNumberStyle: CSSProperties = {
    fontSize: 'clamp(24px, 3.5vw, 40px)',
    fontWeight: cssVars.fontWeights.bold,
    color: colors.text,
    fontFamily: cssVars.fontFamilies.heading,
    marginTop: cssVars.spacing.xs,
  };

  return (
    <>
      <div style={overlayStyle} key={animationKey}>
        <div
          style={cardContainerStyle}
          className={`card-animation-box ${isRed ? 'card-red' : 'card-yellow'}`}
        >
          <div className="card-icon" style={cardIconStyle} />
          <div style={cardTextStyle}>
            {isRed ? 'ROTE KARTE' : 'GELBE KARTE'}
          </div>
          <div style={teamNameStyle}>{currentEvent.teamName}</div>
          {currentEvent.playerNumber && (
            <div style={playerNumberStyle}>#{currentEvent.playerNumber}</div>
          )}
        </div>

        {/* Flash effect overlay */}
        <div
          className={`card-flash ${isRed ? 'flash-red' : 'flash-yellow'}`}
          style={{
            position: 'absolute',
            top: 0,
            left: isHomeSide ? 0 : 'auto',
            right: isHomeSide ? 'auto' : 0,
            width: '50%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />
      </div>

      <style>{`
        .card-animation-box {
          animation: cardPop 3s ease-out forwards;
        }

        .card-icon {
          animation: cardShake 0.6s ease-out;
        }

        .card-red .card-icon {
          animation: cardShakeIntense 0.8s ease-out;
        }

        .card-flash {
          opacity: 0;
        }

        .flash-yellow {
          background: linear-gradient(${isHomeSide ? '90deg' : '270deg'}, rgba(255, 235, 59, 0.3) 0%, transparent 100%);
          animation: cardFlash 0.4s ease-out forwards;
        }

        .flash-red {
          background: linear-gradient(${isHomeSide ? '90deg' : '270deg'}, rgba(244, 67, 54, 0.4) 0%, transparent 100%);
          animation: cardFlashIntense 0.5s ease-out forwards;
        }

        @keyframes cardPop {
          0% {
            transform: scale(0) rotate(-10deg);
            opacity: 0;
          }
          10% {
            transform: scale(1.15) rotate(2deg);
            opacity: 1;
          }
          20% {
            transform: scale(1) rotate(0deg);
          }
          80% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: scale(0.95) rotate(-2deg);
            opacity: 0;
          }
        }

        @keyframes cardShake {
          0%, 100% {
            transform: rotate(0deg);
          }
          20% {
            transform: rotate(-8deg);
          }
          40% {
            transform: rotate(8deg);
          }
          60% {
            transform: rotate(-4deg);
          }
          80% {
            transform: rotate(4deg);
          }
        }

        @keyframes cardShakeIntense {
          0%, 100% {
            transform: rotate(0deg) scale(1);
          }
          15% {
            transform: rotate(-12deg) scale(1.05);
          }
          30% {
            transform: rotate(12deg) scale(1.05);
          }
          45% {
            transform: rotate(-8deg) scale(1.02);
          }
          60% {
            transform: rotate(8deg) scale(1.02);
          }
          75% {
            transform: rotate(-4deg) scale(1);
          }
        }

        @keyframes cardFlash {
          0% {
            opacity: 0;
          }
          30% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes cardFlashIntense {
          0% {
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          40% {
            opacity: 0.7;
          }
          60% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .card-animation-box {
            animation: cardFadeSimple 3s ease-out forwards;
          }

          .card-icon {
            animation: none;
          }

          .card-flash {
            animation: none;
            opacity: 0;
          }

          @keyframes cardFadeSimple {
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
 * Simple card flash overlay (alternative for performance-constrained devices)
 */
export interface CardFlashProps {
  /** Whether to show the flash */
  show: boolean;
  /** Which side received the card */
  side: 'home' | 'away';
  /** Card type */
  cardType: 'YELLOW' | 'RED';
}

export const CardFlash: React.FC<CardFlashProps> = ({ show, side, cardType }) => {
  if (!show) {return null;}

  const isHome = side === 'home';
  const isRed = cardType === 'RED';

  const flashStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: isHome ? 0 : '50%',
    right: isHome ? '50%' : 0,
    background: `linear-gradient(${isHome ? '90deg' : '270deg'}, ${
      isRed ? 'rgba(244, 67, 54, 0.4)' : 'rgba(255, 235, 59, 0.4)'
    } 0%, transparent 100%)`,
    animation: 'cardFlashSimple 0.6s ease-out forwards',
    pointerEvents: 'none',
    zIndex: 1500,
  };

  return (
    <>
      <div style={flashStyle} />
      <style>{`
        @keyframes cardFlashSimple {
          0% { opacity: 0; }
          30% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </>
  );
};
