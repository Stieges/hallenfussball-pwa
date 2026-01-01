/**
 * OpenEntriesSection - Display and Edit Open Entries
 *
 * Shows events that are missing player numbers (e.g., goals without scorer).
 * Allows tournament directors to complete these entries later.
 *
 * Konzept-Referenz: docs/concepts/LIVE-COCKPIT-KONZEPT.md §4.2, §4.3
 *
 * Example:
 * OFFENE EINGABEN (2)
 * ⚽ 04:12 Bayern #?  [Eingeben]
 * ⚽ 02:30 1860 #?    [Eingeben]
 */

import { useState } from 'react';
import { cssVars } from '../../../../design-tokens'
import type { MatchEvent } from '../../../../types/tournament';

interface Team {
  id: string;
  name: string;
}

interface OpenEntriesSectionProps {
  openEvents: MatchEvent[];
  homeTeam: Team;
  awayTeam: Team;
  onEditEvent: (eventId: string) => void;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
}

export function OpenEntriesSection({
  openEvents,
  homeTeam,
  awayTeam,
  onEditEvent,
  defaultCollapsed = true,
}: OpenEntriesSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const getTeamName = (teamId?: string) => {
    if (teamId === homeTeam.id) {
      return homeTeam.name;
    }
    if (teamId === awayTeam.id) {
      return awayTeam.name;
    }
    return 'Team';
  };

  const getEventIcon = (type: MatchEvent['type']) => {
    switch (type) {
      case 'GOAL':
        return '⚽';
      case 'YELLOW_CARD':
        return '🟨';
      case 'RED_CARD':
        return '🟥';
      case 'TIME_PENALTY':
        return '⏱️';
      case 'SUBSTITUTION':
        return '🔄';
      default:
        return '📝';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (openEvents.length === 0) {
    return null;
  }

  return (
    <div style={styles.container}>
      <button
        style={styles.header}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div style={styles.headerLeft}>
          <span style={styles.headerTitle}>OFFENE EINGABEN</span>
          <span style={styles.badge}>{openEvents.length}</span>
        </div>
        <span style={styles.chevron}>{isCollapsed ? '▼' : '▲'}</span>
      </button>

      {!isCollapsed && (
        <div style={styles.eventsList}>
          {openEvents.map((event) => (
            <div key={event.id} style={styles.eventRow}>
              <div style={styles.eventInfo}>
                <span style={styles.eventIcon}>{getEventIcon(event.type)}</span>
                <span style={styles.eventTime}>
                  {formatTime(event.matchMinute * 60)}
                </span>
                <span style={styles.eventTeam}>
                  {getTeamName(event.teamId)}
                </span>
                <span style={styles.missingNumber}>#?</span>
              </div>
              <button
                style={styles.editButton}
                onClick={() => onEditEvent(event.id)}
              >
                Eingeben
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Badge component for header (shows count)
export function OpenEntriesBadge({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }

  return (
    <span style={badgeStyles.badge}>
      {count}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: cssVars.colors.surfaceDark,
    borderRadius: cssVars.borderRadius.lg,
    overflow: 'hidden',
    border: `1px solid ${cssVars.colors.warningBannerBorder}`,
  },
  header: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: cssVars.spacing.md,
    backgroundColor: cssVars.colors.warningBannerBg,
    border: 'none',
    cursor: 'pointer',
    color: cssVars.colors.warning,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  },
  headerTitle: {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: 600,
    letterSpacing: '0.05em',
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 24,
    height: 24,
    padding: `0 ${cssVars.spacing.xs}`,
    backgroundColor: cssVars.colors.warning,
    color: cssVars.colors.onWarning,
    borderRadius: cssVars.borderRadius.full,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: 700,
  },
  chevron: {
    fontSize: cssVars.fontSizes.xs,
  },
  eventsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs,
    padding: cssVars.spacing.sm,
  },
  eventRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: cssVars.spacing.sm,
    backgroundColor: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.md,
  },
  eventInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  },
  eventIcon: {
    fontSize: cssVars.fontSizes.md,
  },
  eventTime: {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    color: cssVars.colors.textSecondary,
    minWidth: 45,
  },
  eventTeam: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textPrimary,
    maxWidth: 100,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  missingNumber: {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: 600,
    color: cssVars.colors.warning,
  },
  editButton: {
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: 500,
    backgroundColor: cssVars.colors.primary,
    color: cssVars.colors.onPrimary,
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
    minHeight: 44, // Touch target minimum per WCAG/Mobile UX guidelines
  },
};

const badgeStyles: Record<string, React.CSSProperties> = {
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
    height: 20,
    padding: `0 6px`,
    backgroundColor: cssVars.colors.warning,
    color: cssVars.colors.onWarning,
    borderRadius: 10,
    fontSize: cssVars.fontSizes.xs,
    fontWeight: 700,
  },
};

export default OpenEntriesSection;
