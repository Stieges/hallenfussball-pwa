/**
 * PenaltyIndicators - Running Time Penalties Display
 *
 * Shows active time penalties with countdown timers.
 * Displayed in the score area of the Live Cockpit.
 *
 * Konzept-Referenz: docs/concepts/LIVE-COCKPIT-KONZEPT.md §3.3, §4.3
 *
 * Example display:
 * 🟨 #7 (Heim) 01:32    ⏱️ #12 (Gast) 00:45
 */

import { useEffect, useState, useCallback } from 'react';
import { colors, spacing, fontSizes, borderRadius } from '../../../../design-tokens';
import type { ActivePenalty } from '../../../../types/tournament';

interface Team {
  id: string;
  name: string;
}

interface PenaltyIndicatorsProps {
  activePenalties: ActivePenalty[];
  homeTeam: Team;
  awayTeam: Team;
  /** Callback when penalty expires */
  onPenaltyExpire?: (eventId: string) => void;
  /** Match is running (for countdown) */
  isMatchRunning?: boolean;
}

export function PenaltyIndicators({
  activePenalties,
  homeTeam,
  awayTeam: _awayTeam,
  onPenaltyExpire,
  isMatchRunning = true,
}: PenaltyIndicatorsProps) {
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});

  // Initialize countdowns from activePenalties
  useEffect(() => {
    const newCountdowns: Record<string, number> = {};
    activePenalties.forEach((penalty) => {
      newCountdowns[penalty.eventId] = penalty.remainingSeconds;
    });
    setCountdowns(newCountdowns);
  }, [activePenalties]);

  // Countdown effect
  useEffect(() => {
    if (!isMatchRunning || activePenalties.length === 0) {
      return;
    }

    const interval = setInterval(() => {
      setCountdowns((prev) => {
        const updated = { ...prev };

        Object.keys(updated).forEach((eventId) => {
          if (updated[eventId] > 0) {
            updated[eventId] -= 1;
            if (updated[eventId] === 0) {
              onPenaltyExpire?.(eventId);
            }
          }
        });

        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isMatchRunning, activePenalties.length, onPenaltyExpire]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const isHomePenalty = useCallback(
    (teamId: string) => teamId === homeTeam.id,
    [homeTeam.id]
  );

  if (activePenalties.length === 0) {
    return null;
  }

  // Sort: home penalties first, then by remaining time
  const sortedPenalties = [...activePenalties].sort((a, b) => {
    const aIsHome = isHomePenalty(a.teamId);
    const bIsHome = isHomePenalty(b.teamId);
    if (aIsHome !== bIsHome) {
      return aIsHome ? -1 : 1;
    }
    return (countdowns[a.eventId] ?? 0) - (countdowns[b.eventId] ?? 0);
  });

  return (
    <div style={styles.container}>
      {sortedPenalties.map((penalty) => {
        const remaining = countdowns[penalty.eventId] ?? 0;
        const isExpiring = remaining <= 10;
        const isHome = isHomePenalty(penalty.teamId);

        return (
          <div
            key={penalty.eventId}
            style={{
              ...styles.penaltyBadge,
              backgroundColor: isExpiring
                ? colors.warningLight
                : colors.surface,
              borderColor: isExpiring ? colors.warning : colors.borderDefault,
            }}
          >
            <span style={styles.icon}>⏱️</span>
            <span style={styles.playerInfo}>
              {penalty.playerNumber ? `#${penalty.playerNumber}` : ''}
              <span style={styles.teamLabel}>
                ({isHome ? 'H' : 'G'})
              </span>
            </span>
            <span
              style={{
                ...styles.countdown,
                color: isExpiring ? colors.warning : colors.textPrimary,
              }}
            >
              {formatTime(remaining)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    padding: `${spacing.sm} ${spacing.md}`,
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.lg,
    maxWidth: '100%',
  },
  penaltyBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    padding: `${spacing.xs} ${spacing.sm}`,
    backgroundColor: colors.surface,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: borderRadius.md,
    transition: 'all 0.3s ease',
  },
  icon: {
    fontSize: fontSizes.sm,
  },
  playerInfo: {
    fontSize: fontSizes.sm,
    fontWeight: 600,
    color: colors.textSecondary,
  },
  teamLabel: {
    marginLeft: spacing.xs,
    fontSize: fontSizes.xs,
    color: colors.textTertiary,
  },
  countdown: {
    fontSize: fontSizes.sm,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    minWidth: '45px',
    textAlign: 'right',
  },
};

export default PenaltyIndicators;
