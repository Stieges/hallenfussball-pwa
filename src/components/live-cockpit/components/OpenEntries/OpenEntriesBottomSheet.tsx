/**
 * OpenEntriesBottomSheet - Mobile Bottom Sheet for Open Events
 *
 * A slide-up panel that shows incomplete events on mobile devices.
 * Displays a notification badge when collapsed and expands to show
 * all open entries when tapped.
 *
 * Konzept-Referenz: docs/concepts/LIVE-COCKPIT-KONZEPT.md §4.2
 *
 * Features:
 * - Immer sichtbare Leiste mit Zähler (kein Modal); Tippen oder Hochwischen öffnet die Liste
 * - Die Liste liegt im zentralen BottomSheet (B-43b2: deckende Fläche, Fokusfalle, Esc/Zurück)
 * - Quick access to edit incomplete events
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { cssVars } from '../../../../design-tokens';
import { BottomSheet } from '../../../ui/BottomSheet';
import type { MatchEvent } from '../../../../types/tournament';

interface Team {
  id: string;
  name: string;
}

interface OpenEntriesBottomSheetProps {
  openEvents: MatchEvent[];
  homeTeam: Team;
  awayTeam: Team;
  onEditEvent: (eventId: string) => void;
  /** Whether the sheet is visible */
  isVisible?: boolean;
}

export function OpenEntriesBottomSheet({
  openEvents,
  homeTeam,
  awayTeam,
  onEditEvent,
  isVisible = true,
}: OpenEntriesBottomSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);

  // Flash the badge when new open events are added
  useEffect(() => {
    if (openEvents.length > 0 && !isExpanded) {
      const sheet = sheetRef.current;
      if (sheet) {
        sheet.classList.add('pulse');
        setTimeout(() => sheet.classList.remove('pulse'), 600);
      }
    }
  }, [openEvents.length, isExpanded]);

  const getTeamName = useCallback((teamId?: string) => {
    if (teamId === homeTeam.id) {return homeTeam.name;}
    if (teamId === awayTeam.id) {return awayTeam.name;}
    return 'Team';
  }, [homeTeam, awayTeam]);

  const getEventIcon = (type?: string): string => {
    switch (type) {
      case 'GOAL': return '⚽';
      case 'YELLOW_CARD': return '🟨';
      case 'RED_CARD': return '🟥';
      case 'TIME_PENALTY': return '⏱️';
      case 'SUBSTITUTION': return '🔄';
      default: return '📝';
    }
  };

  const formatTime = (matchMinute: number) => {
    const mins = Math.floor(matchMinute);
    const secs = Math.round((matchMinute % 1) * 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Hochwischen auf der Leiste öffnet die Liste
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const diff = startYRef.current - e.changedTouches[0].clientY;
    if (diff > 50) {
      setIsExpanded(true);
    }
  }, []);

  if (!isVisible || openEvents.length === 0) {
    return null;
  }

  return (
    <>
      <div
        ref={sheetRef}
        style={styles.container}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle Bar */}
        <div
          style={styles.handleBar}
          onClick={() => setIsExpanded(true)}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          aria-label={`${openEvents.length} offene Eingaben`}
        >
          <div style={styles.handle} />
        </div>

        {/* Header */}
        <div style={styles.header} onClick={() => setIsExpanded(true)}>
          <div style={styles.headerLeft}>
            <span style={styles.warningIcon}>⚠️</span>
            <span style={styles.headerTitle}>Offene Eingaben</span>
            <span style={styles.badge}>{openEvents.length}</span>
          </div>
          <span style={styles.chevron}>▲</span>
        </div>
      </div>

      <BottomSheet isOpen={isExpanded} onClose={() => setIsExpanded(false)} title="Offene Eingaben">
        <div style={styles.eventsList}>
          {openEvents.map((event) => (
            <button
              key={event.id}
              style={styles.eventRow}
              onClick={() => onEditEvent(event.id)}
            >
              <div style={styles.eventInfo}>
                <span style={styles.eventIcon}>{getEventIcon(event.type)}</span>
                <span style={styles.eventTime}>{formatTime(event.matchMinute)}</span>
                <span style={styles.eventTeam}>{getTeamName(event.teamId)}</span>
                <span style={styles.missingBadge}>#?</span>
              </div>
              <span style={styles.editLabel}>Bearbeiten</span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: cssVars.colors.surfaceElevated,
    borderTopLeftRadius: cssVars.borderRadius.xl,
    borderTopRightRadius: cssVars.borderRadius.xl,
    boxShadow: `0 -4px 20px ${cssVars.colors.shadowMedium}`,
    zIndex: 900,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 56,
  },
  handleBar: {
    display: 'flex',
    justifyContent: 'center',
    padding: `${cssVars.spacing.sm} 0`,
    cursor: 'pointer',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: cssVars.colors.borderDefault,
    borderRadius: 2,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `0 ${cssVars.spacing.md} ${cssVars.spacing.sm}`,
    cursor: 'pointer',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  },
  warningIcon: {
    fontSize: cssVars.fontSizes.md,
  },
  headerTitle: {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: 600,
    color: cssVars.colors.warning,
    textTransform: 'uppercase',
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
    color: cssVars.colors.textSecondary,
  },
  eventsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs,
  },
  eventRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: cssVars.spacing.md,
    backgroundColor: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.warningBannerBorder}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
    minHeight: 48,
    width: '100%',
    textAlign: 'left',
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
  missingBadge: {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: 600,
    color: cssVars.colors.warning,
    backgroundColor: cssVars.colors.warningBannerBg,
    padding: `2px ${cssVars.spacing.xs}`,
    borderRadius: cssVars.borderRadius.sm,
  },
  editLabel: {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: 500,
    color: cssVars.colors.primary,
  },
};

export default OpenEntriesBottomSheet;
