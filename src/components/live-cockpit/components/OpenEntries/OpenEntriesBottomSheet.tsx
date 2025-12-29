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
 * - Collapsible bottom sheet with swipe gesture
 * - Badge showing count of open entries
 * - Quick access to edit incomplete events
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { colors, spacing, fontSizes, borderRadius } from '../../../../design-tokens';
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
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);

  // Auto-expand when new open events are added
  useEffect(() => {
    if (openEvents.length > 0 && !isExpanded) {
      // Flash the badge to draw attention
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

  // Touch handlers for swipe gesture
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) {return;}
    const currentY = e.touches[0].clientY;
    const diff = startYRef.current - currentY;

    // Limit drag range
    if (isExpanded) {
      // When expanded, allow dragging down to collapse
      setDragOffset(Math.max(0, Math.min(200, -diff)));
    } else {
      // When collapsed, allow dragging up to expand
      setDragOffset(Math.max(0, Math.min(200, diff)));
    }
  }, [isDragging, isExpanded]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);

    // Snap to expanded or collapsed based on drag distance
    if (dragOffset > 50) {
      setIsExpanded(!isExpanded);
    }
    setDragOffset(0);
  }, [dragOffset, isExpanded]);

  if (!isVisible || openEvents.length === 0) {
    return null;
  }

  const sheetHeight = isExpanded ? Math.min(300, 80 + openEvents.length * 56) : 56;
  const currentHeight = sheetHeight + (isExpanded ? -dragOffset : dragOffset);

  return (
    <div
      ref={sheetRef}
      style={{
        ...styles.container,
        height: currentHeight,
        transition: isDragging ? 'none' : 'height 0.3s ease-out',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Handle Bar */}
      <div
        style={styles.handleBar}
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${openEvents.length} offene Eingaben`}
      >
        <div style={styles.handle} />
      </div>

      {/* Header */}
      <div
        style={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={styles.headerLeft}>
          <span style={styles.warningIcon}>⚠️</span>
          <span style={styles.headerTitle}>Offene Eingaben</span>
          <span style={styles.badge}>{openEvents.length}</span>
        </div>
        <span style={styles.chevron}>{isExpanded ? '▼' : '▲'}</span>
      </div>

      {/* Event List (visible when expanded) */}
      {isExpanded && (
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
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    boxShadow: `0 -4px 20px ${colors.shadowMedium}`,
    zIndex: 900,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  handleBar: {
    display: 'flex',
    justifyContent: 'center',
    padding: `${spacing.sm} 0`,
    cursor: 'pointer',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.borderDefault,
    borderRadius: 2,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `0 ${spacing.md} ${spacing.sm}`,
    cursor: 'pointer',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  },
  warningIcon: {
    fontSize: fontSizes.md,
  },
  headerTitle: {
    fontSize: fontSizes.sm,
    fontWeight: 600,
    color: colors.warning,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 24,
    height: 24,
    padding: `0 ${spacing.xs}`,
    backgroundColor: colors.warning,
    color: colors.onWarning,
    borderRadius: borderRadius.full,
    fontSize: fontSizes.sm,
    fontWeight: 700,
  },
  chevron: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  eventsList: {
    flex: 1,
    overflowY: 'auto',
    padding: `0 ${spacing.sm} ${spacing.md}`,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
  },
  eventRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.surface,
    border: `1px solid ${colors.warningBannerBorder}`,
    borderRadius: borderRadius.md,
    cursor: 'pointer',
    minHeight: 48,
    width: '100%',
    textAlign: 'left',
  },
  eventInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  },
  eventIcon: {
    fontSize: fontSizes.md,
  },
  eventTime: {
    fontSize: fontSizes.sm,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    color: colors.textSecondary,
    minWidth: 45,
  },
  eventTeam: {
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    maxWidth: 100,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  missingBadge: {
    fontSize: fontSizes.sm,
    fontWeight: 600,
    color: colors.warning,
    backgroundColor: colors.warningBannerBg,
    padding: `2px ${spacing.xs}`,
    borderRadius: borderRadius.sm,
  },
  editLabel: {
    fontSize: fontSizes.sm,
    fontWeight: 500,
    color: colors.primary,
  },
};

export default OpenEntriesBottomSheet;
