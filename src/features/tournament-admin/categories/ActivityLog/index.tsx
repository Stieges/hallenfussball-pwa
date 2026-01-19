/**
 * ActivityLogCategory - Audit Trail / Change Log
 *
 * Shows all changes made to the tournament with filtering.
 * Includes match result changes from correctionHistory.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 5.2
 */

import { useState, useMemo, CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';
import { CategoryPage, CollapsibleSection } from '../shared';
import type { Tournament, Match, CorrectionEntry } from '../../../../types/tournament';

// =============================================================================
// TYPES
// =============================================================================

interface ActivityEntry {
  id: string;
  type: 'result_entered' | 'result_changed' | 'match_started' | 'match_finished' | 'tournament_created';
  timestamp: string;
  matchId?: string;
  matchLabel?: string;
  description: string;
  details?: string;
  oldValue?: string;
  newValue?: string;
}

// =============================================================================
// PROPS
// =============================================================================

interface ActivityLogCategoryProps {
  tournamentId: string;
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = {
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.lg,
    marginBottom: cssVars.spacing.md,
  } as CSSProperties,

  select: {
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    background: cssVars.colors.inputBg,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.bodySm,
    minWidth: 120,
  } as CSSProperties,

  entryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
  } as CSSProperties,

  entry: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
  } as CSSProperties,

  entryIcon: {
    fontSize: 24,
    flexShrink: 0,
  } as CSSProperties,

  entryContent: {
    flex: 1,
    minWidth: 0,
  } as CSSProperties,

  entryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: cssVars.spacing.sm,
    marginBottom: cssVars.spacing.xs,
  } as CSSProperties,

  entryTitle: {
    fontSize: cssVars.fontSizes.bodyMd,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  entryTime: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.textMuted,
    flexShrink: 0,
  } as CSSProperties,

  entryDescription: {
    fontSize: cssVars.fontSizes.bodySm,
    color: cssVars.colors.textSecondary,
  } as CSSProperties,

  entryChange: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    marginTop: cssVars.spacing.xs,
    fontSize: cssVars.fontSizes.bodySm,
  } as CSSProperties,

  oldValue: {
    padding: `2px ${cssVars.spacing.xs}`,
    background: cssVars.colors.errorLight,
    color: cssVars.colors.error,
    borderRadius: cssVars.borderRadius.sm,
    textDecoration: 'line-through',
  } as CSSProperties,

  newValue: {
    padding: `2px ${cssVars.spacing.xs}`,
    background: cssVars.colors.successLight,
    color: cssVars.colors.success,
    borderRadius: cssVars.borderRadius.sm,
  } as CSSProperties,

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: cssVars.spacing.md,
  } as CSSProperties,

  statCard: {
    padding: cssVars.spacing.md,
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    textAlign: 'center',
  } as CSSProperties,

  statValue: {
    fontSize: cssVars.fontSizes.headlineSm,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  statLabel: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.textSecondary,
    marginTop: cssVars.spacing.xs,
  } as CSSProperties,

  emptyState: {
    textAlign: 'center',
    padding: cssVars.spacing.xl,
    color: cssVars.colors.textMuted,
  } as CSSProperties,

  emptyIcon: {
    fontSize: 48,
    marginBottom: cssVars.spacing.md,
  } as CSSProperties,

  loadMore: {
    display: 'block',
    width: '100%',
    padding: cssVars.spacing.sm,
    background: 'transparent',
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.primary,
    fontSize: cssVars.fontSizes.bodySm,
    cursor: 'pointer',
    marginTop: cssVars.spacing.md,
  } as CSSProperties,
} as const;

// =============================================================================
// HELPERS
// =============================================================================

function getTeamName(tournament: Tournament, teamId: string): string {
  const team = tournament.teams.find(t => t.id === teamId);
  return team?.name ?? 'Unbekannt';
}

function getMatchLabel(tournament: Tournament, match: Match): string {
  const teamA = getTeamName(tournament, match.teamA);
  const teamB = getTeamName(tournament, match.teamB);
  return `${teamA} vs ${teamB}`;
}

function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function formatTimeOnly(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function getEntryIcon(type: ActivityEntry['type']): string {
  switch (type) {
    case 'result_entered':
      return '✏️';
    case 'result_changed':
      return '🔄';
    case 'match_started':
      return '▶️';
    case 'match_finished':
      return '✅';
    case 'tournament_created':
      return '🏆';
    default:
      return '📋';
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ActivityLogCategory({
  tournament,
}: ActivityLogCategoryProps) {
  const [filter, setFilter] = useState<'all' | 'today' | 'week'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [showCount, setShowCount] = useState(20);

  // Build activity entries from tournament data
  const allEntries = useMemo(() => {
    const entries: ActivityEntry[] = [];

    // Add tournament creation
    if (tournament.createdAt) {
      entries.push({
        id: 'tournament-created',
        type: 'tournament_created',
        timestamp: tournament.createdAt,
        description: `Turnier "${tournament.title}" wurde erstellt`,
      });
    }

    // Process matches for activity entries
    tournament.matches.forEach((match) => {
      const matchLabel = getMatchLabel(tournament, match);

      // Add match finished entries
      if (match.finishedAt) {
        entries.push({
          id: `match-finished-${match.id}`,
          type: 'match_finished',
          timestamp: match.finishedAt,
          matchId: match.id,
          matchLabel,
          description: `Spiel beendet`,
          details: `Endstand: ${match.scoreA ?? 0}:${match.scoreB ?? 0}`,
        });
      }

      // Add correction history entries
      if (match.correctionHistory && match.correctionHistory.length > 0) {
        match.correctionHistory.forEach((correction: CorrectionEntry, index: number) => {
          entries.push({
            id: `correction-${match.id}-${index}`,
            type: 'result_changed',
            timestamp: correction.timestamp,
            matchId: match.id,
            matchLabel,
            description: `Ergebnis korrigiert`,
            oldValue: `${correction.previousScoreA}:${correction.previousScoreB}`,
            newValue: `${correction.newScoreA}:${correction.newScoreB}`,
            details: correction.reason ?? correction.note,
          });
        });
      }

      // Add result entered (first result) - infer from having scores but no correction
      if (
        match.matchStatus === 'finished' &&
        match.scoreA !== undefined &&
        match.scoreB !== undefined &&
        (!match.correctionHistory || match.correctionHistory.length === 0)
      ) {
        // Use finishedAt or fallback to now
        const timestamp = match.finishedAt ?? new Date().toISOString();
        entries.push({
          id: `result-entered-${match.id}`,
          type: 'result_entered',
          timestamp,
          matchId: match.id,
          matchLabel,
          description: `Ergebnis eingetragen`,
          newValue: `${match.scoreA}:${match.scoreB}`,
        });
      }
    });

    // Sort by timestamp descending (newest first)
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return entries;
  }, [tournament]);

  // Apply filters
  const filteredEntries = useMemo(() => {
    let entries = allEntries;

    // Time filter
    if (filter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      entries = entries.filter(e => new Date(e.timestamp) >= today);
    } else if (filter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      entries = entries.filter(e => new Date(e.timestamp) >= weekAgo);
    }

    // Type filter
    if (typeFilter) {
      entries = entries.filter(e => e.type === typeFilter);
    }

    return entries;
  }, [allEntries, filter, typeFilter]);

  // Visible entries (with pagination)
  const visibleEntries = filteredEntries.slice(0, showCount);
  const hasMore = filteredEntries.length > showCount;

  // Stats
  const stats = useMemo(() => {
    const resultChanges = allEntries.filter(e => e.type === 'result_changed').length;
    const matchesFinished = allEntries.filter(e => e.type === 'match_finished').length;
    const totalEntries = allEntries.length;

    return { resultChanges, matchesFinished, totalEntries };
  }, [allEntries]);

  return (
    <CategoryPage
      icon="📋"
      title="Activity Log"
      description="Änderungsprotokoll und Audit-Trail"
    >
      {/* Filter Bar */}
      <div style={styles.filterBar}>
        <select
          style={styles.select}
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'all' | 'today' | 'week')}
        >
          <option value="all">Alle Einträge</option>
          <option value="today">Heute</option>
          <option value="week">Letzte 7 Tage</option>
        </select>
        <select
          style={styles.select}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">Alle Aktionen</option>
          <option value="result_entered">Ergebnisse</option>
          <option value="result_changed">Korrekturen</option>
          <option value="match_finished">Spiele beendet</option>
        </select>
      </div>

      {/* Summary Stats */}
      <CollapsibleSection icon="📊" title="Zusammenfassung" defaultOpen>
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.totalEntries}</div>
            <div style={styles.statLabel}>Gesamt</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.matchesFinished}</div>
            <div style={styles.statLabel}>Spiele beendet</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.resultChanges}</div>
            <div style={styles.statLabel}>Korrekturen</div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Log Entries */}
      <CollapsibleSection
        icon="📝"
        title={`Änderungsprotokoll (${filteredEntries.length})`}
        defaultOpen
      >
        {visibleEntries.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📋</div>
            <p>Keine Einträge gefunden.</p>
            <p style={{ fontSize: cssVars.fontSizes.labelSm, marginTop: cssVars.spacing.sm }}>
              {filter !== 'all' || typeFilter
                ? 'Versuche andere Filtereinstellungen.'
                : 'Das Activity Log wird gefüllt, sobald Änderungen am Turnier vorgenommen werden.'}
            </p>
          </div>
        ) : (
          <>
            <div style={styles.entryList}>
              {visibleEntries.map((entry) => (
                <div key={entry.id} style={styles.entry}>
                  <span style={styles.entryIcon}>{getEntryIcon(entry.type)}</span>
                  <div style={styles.entryContent}>
                    <div style={styles.entryHeader}>
                      <span style={styles.entryTitle}>
                        {entry.matchLabel ?? entry.description}
                      </span>
                      <span style={styles.entryTime}>
                        {formatTimeOnly(entry.timestamp)}
                      </span>
                    </div>
                    <div style={styles.entryDescription}>
                      {entry.matchLabel ? entry.description : formatDateTime(entry.timestamp)}
                      {entry.details && ` – ${entry.details}`}
                    </div>
                    {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR: show section if either value is truthy */}
                    {(entry.oldValue || entry.newValue) && (
                      <div style={styles.entryChange}>
                        {entry.oldValue && (
                          <span style={styles.oldValue}>{entry.oldValue}</span>
                        )}
                        {entry.oldValue && entry.newValue && <span>→</span>}
                        {entry.newValue && (
                          <span style={styles.newValue}>{entry.newValue}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {hasMore && (
              <button
                style={styles.loadMore}
                onClick={() => setShowCount(prev => prev + 20)}
              >
                Mehr laden ({filteredEntries.length - showCount} weitere)
              </button>
            )}
          </>
        )}
      </CollapsibleSection>
    </CategoryPage>
  );
}

export default ActivityLogCategory;
