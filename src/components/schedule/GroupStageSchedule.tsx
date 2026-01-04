/**
 * GroupStageSchedule - Displays group stage matches in MeinTurnierplan style
 * Fully responsive with table view for desktop and card view for mobile
 *
 * US-SCHEDULE-EDITOR: Now supports Drag & Drop for match swapping in edit mode
 */

import { CSSProperties, useState, useMemo, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { cssVars, spacingSemantics, mediaQueries } from '../../design-tokens'
import { ScheduledMatch } from '../../lib/scheduleGenerator';
import { RefereeConfig, Tournament, RuntimeMatchEvent } from '../../types/tournament';
import { getGroupShortCode } from '../../utils/displayNames';
import { getTeamForDisplay } from '../../utils/teamHelpers';
import {
  MatchCard,
  type MatchCardStatus,
  type RefereeOption,
} from './MatchCard';
import { QuickScoreExpand, LiveInfoExpand, StartMatchExpand } from './MatchExpand';
import { MatchSummary } from './MatchSummary';
import { useMatchConflictsFromTournament } from '../../features/schedule-editor/hooks/useMatchConflicts';
import { useLiveMatches } from '../../hooks/useLiveMatches';
import { SortableMobileCard } from './SortableMobileCard';
import { SortableDesktopCard } from './SortableDesktopCard';
import { DesktopCard } from './DesktopCard';

// Pending changes during edit mode
interface PendingChanges {
  refereeAssignments: Record<string, number | null>;
  fieldAssignments: Record<string, number>;
}

interface GroupStageScheduleProps {
  matches: ScheduledMatch[];
  hasGroups: boolean;
  refereeConfig?: RefereeConfig;
  numberOfFields?: number;
  onRefereeChange?: (matchId: string, refereeNumber: number | null) => void;
  onFieldChange?: (matchId: string, fieldNumber: number) => void;
  onScoreChange?: (matchId: string, scoreA: number, scoreB: number) => void;
  editable?: boolean;
  /** Is the schedule currently being edited (edit mode active) */
  editingSchedule?: boolean;
  /** Pending changes during edit mode (not yet saved) */
  pendingChanges?: PendingChanges;
  finishedMatches?: Set<string>;
  correctionMatchId?: string | null;
  onStartCorrection?: (matchId: string) => void;
  /** MON-LIVE-INDICATOR-01: IDs of matches that are currently running */
  runningMatchIds?: Set<string>;
  /** Tournament data for group name resolution */
  tournament?: Tournament;
  /** US-SCHEDULE-EDITOR: Callback when matches are swapped via DnD */
  onMatchSwap?: (matchId1: string, matchId2: string) => void;
  /** Callback to navigate to cockpit with selected match */
  onNavigateToCockpit?: (matchId: string) => void;
  /** Whether to show the section title (default: true) */
  showTitle?: boolean;
  // Note: Permission check is now handled in ScheduleTab
}

export const GroupStageSchedule: React.FC<GroupStageScheduleProps> = ({
  matches,
  hasGroups,
  refereeConfig,
  numberOfFields = 1,
  onRefereeChange,
  onFieldChange,
  onScoreChange,
  editable: _editable = false,
  editingSchedule = false,
  pendingChanges,
  finishedMatches,
  correctionMatchId: _correctionMatchId,
  onStartCorrection: _onStartCorrection,
  runningMatchIds,
  tournament,
  onMatchSwap,
  onNavigateToCockpit,
  showTitle = true,
}) => {
  // DnD State
  const [activeId, setActiveId] = useState<string | null>(null);

  // Local display order - tracks visual order of matches (reorders on drag)
  const [displayOrder, setDisplayOrder] = useState<string[]>(() =>
    matches.map(m => m.id)
  );

  // Sync displayOrder when matches change (e.g., when not in edit mode or on save/reset)
  useEffect(() => {
    // Only reset if we're not editing (to preserve drag order during edit)
    if (!editingSchedule) {
      setDisplayOrder(matches.map(m => m.id));
    }
  }, [matches, editingSchedule]);

  // Also reset when entering edit mode (start fresh from current order)
  useEffect(() => {
    if (editingSchedule) {
      setDisplayOrder(matches.map(m => m.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only reset when entering edit mode, not when matches change
  }, [editingSchedule]);

  // Spielplan 2.0: Expand state for mobile cards
  type ExpandType = 'quick' | 'live' | 'start' | null;
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [expandType, setExpandType] = useState<ExpandType>(null);

  // Match Summary state (for finished match circle click)
  const [showMatchSummary, setShowMatchSummary] = useState(false);
  const [summaryMatchId, setSummaryMatchId] = useState<string | null>(null);

  // Get live match data including events
  const { liveMatches } = useLiveMatches(tournament?.id ?? '');

  // Close expand when pressing Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expandedMatchId) {
        setExpandedMatchId(null);
        setExpandType(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [expandedMatchId]);

  // Close expand when clicking outside (Mobile UX improvement)
  useEffect(() => {
    if (!expandedMatchId) {return;}

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      // Check if click is outside any MatchCard
      const clickedCard = target.closest('[data-match-card]');
      if (!clickedCard) {
        setExpandedMatchId(null);
        setExpandType(null);
      }
    };

    // Use setTimeout to avoid closing on the same click that opened
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('touchend', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchend', handleClickOutside);
    };
  }, [expandedMatchId]);

  // Conflict detection for edit mode
  const { getMatchConflicts } = useMatchConflictsFromTournament(
    tournament ?? null,
    editingSchedule // Only detect when in edit mode
  );

  // DnD Sensors - require 8px movement before drag starts
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag end - swap matches visually and notify parent
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {return;}

    const sourceMatchId = active.id as string;
    const targetMatchId = over.id as string;

    // Immediately update visual order using arrayMove
    setDisplayOrder(prevOrder => {
      const oldIndex = prevOrder.indexOf(sourceMatchId);
      const newIndex = prevOrder.indexOf(targetMatchId);
      if (oldIndex === -1 || newIndex === -1) {return prevOrder;}
      return arrayMove(prevOrder, oldIndex, newIndex);
    });

    // Call the swap handler to persist change
    if (onMatchSwap) {
      onMatchSwap(sourceMatchId, targetMatchId);
    }
  };

  // ============================================================================
  // Spielplan 2.0: Helper functions for MatchCard integration
  // ============================================================================

  /**
   * Convert match state to MatchCardStatus
   */
  const getMatchStatus = (match: ScheduledMatch): MatchCardStatus => {
    if (runningMatchIds?.has(match.id)) {
      return 'running';
    }
    if (finishedMatches?.has(match.id)) {
      return 'finished';
    }
    // Check if match has a score (started but paused would still show as finished)
    if (match.scoreA !== undefined && match.scoreB !== undefined) {
      return 'finished';
    }
    return 'scheduled';
  };

  /**
   * Handle card body click - opens QuickScore expand for non-live matches
   */
  const handleCardClick = (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) {return;}

    const status = getMatchStatus(match);

    if (status === 'running') {
      // Live matches: Show hint that score is managed in cockpit
      // For now, show LiveInfoExpand
      setExpandedMatchId(matchId);
      setExpandType('live');
      return;
    }

    // Toggle expand for non-live matches
    if (expandedMatchId === matchId && expandType === 'quick') {
      setExpandedMatchId(null);
      setExpandType(null);
    } else {
      setExpandedMatchId(matchId);
      setExpandType('quick');
    }
  };

  /**
   * Handle circle click - status-specific action
   */
  const handleCircleClick = (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) {return;}

    const status = getMatchStatus(match);

    switch (status) {
      case 'scheduled':
        // Not started: Show start confirmation
        setExpandedMatchId(matchId);
        setExpandType('start');
        break;
      case 'running':
        // Live: Show live info with link to cockpit
        setExpandedMatchId(matchId);
        setExpandType('live');
        break;
      case 'finished':
        // Finished: Show match summary with events
        setSummaryMatchId(matchId);
        setShowMatchSummary(true);
        break;
      default:
        // Fallback: If match has scores, treat as finished and show summary
        if (match.scoreA !== undefined && match.scoreB !== undefined) {
          setSummaryMatchId(matchId);
          setShowMatchSummary(true);
        }
        break;
    }
  };

  /**
   * Handle score save from expand
   */
  const handleExpandSave = useCallback((matchId: string, homeScore: number, awayScore: number) => {
    if (onScoreChange) {
      onScoreChange(matchId, homeScore, awayScore);
    }
    setExpandedMatchId(null);
    setExpandType(null);
  }, [onScoreChange]);

  /**
   * Handle expand cancel/close
   */
  const handleExpandClose = useCallback(() => {
    setExpandedMatchId(null);
    setExpandType(null);
  }, []);

  /**
   * Navigate to cockpit for a match
   * TODO: Implement actual navigation via context or URL params
   * The actual navigation should be handled by a callback prop (onNavigateToCockpit)
   */
  const handleNavigateToCockpit = useCallback((matchId: string) => {
    // Close the expand
    setExpandedMatchId(null);
    setExpandType(null);
    // Navigate to cockpit if callback provided
    onNavigateToCockpit?.(matchId);
  }, [onNavigateToCockpit]);

  /**
   * Unified render function for expand content (used by both mobile and desktop)
   */
  const renderExpandContent = useCallback((match: ScheduledMatch): React.ReactNode => {
    if (expandedMatchId !== match.id || !expandType) {
      return null;
    }

    const homeTeam = getTeamForDisplay(tournament?.teams, match.originalTeamA, match.homeTeam);
    const awayTeam = getTeamForDisplay(tournament?.teams, match.originalTeamB, match.awayTeam);

    switch (expandType) {
      case 'quick':
        return (
          <QuickScoreExpand
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            homeScore={match.scoreA ?? 0}
            awayScore={match.scoreB ?? 0}
            onSave={(home, away) => handleExpandSave(match.id, home, away)}
            onCancel={handleExpandClose}
          />
        );
      case 'live':
        return (
          <LiveInfoExpand
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            homeScore={match.scoreA ?? 0}
            awayScore={match.scoreB ?? 0}
            elapsedFormatted={match.time || '00:00'}
            onNavigateToCockpit={() => handleNavigateToCockpit(match.id)}
            onClose={handleExpandClose}
          />
        );
      case 'start':
        return (
          <StartMatchExpand
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            matchNumber={match.matchNumber}
            scheduledTime={match.time}
            field={match.field}
            onConfirm={() => handleNavigateToCockpit(match.id)}
            onCancel={handleExpandClose}
          />
        );
      default:
        return null;
    }
  }, [expandedMatchId, expandType, handleExpandClose, handleExpandSave, handleNavigateToCockpit, tournament?.teams]);

  // Sort matches by displayOrder for rendering
  const sortedMatches = useMemo(() => {
    const orderMap = new Map(displayOrder.map((id, index) => [id, index]));
    return [...matches].sort((a, b) => {
      const indexA = orderMap.get(a.id) ?? Infinity;
      const indexB = orderMap.get(b.id) ?? Infinity;
      return indexA - indexB;
    });
  }, [matches, displayOrder]);
  if (matches.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: `${cssVars.spacing.xl} ${cssVars.spacing.md}`,
        color: cssVars.colors.textSecondary,
        fontSize: cssVars.fontSizes.lg
      }}>
        Keine Spiele vorhanden
      </div>
    );
  }

  const showReferees = !!(refereeConfig && refereeConfig.mode !== 'none');
  const showFields = numberOfFields > 1;
  // Hide group label for single-group tournaments (or when no groups defined)
  const showGroupLabel = (tournament?.groups?.length ?? 0) > 1;

  // Generate referee options for dropdown (nur Nummern)
  const getRefereeOptions = () => {
    if (!refereeConfig) {return [];}

    const numberOfReferees = refereeConfig.mode === 'organizer'
      ? (refereeConfig.numberOfReferees || 2)
      : matches.length;

    const options = [];
    for (let i = 1; i <= numberOfReferees; i++) {
      options.push({ value: i, label: i.toString() });
    }
    return options;
  };

  // Generate field options for dropdown
  const getFieldOptions = () => {
    const options = [];
    for (let i = 1; i <= numberOfFields; i++) {
      options.push({ value: i, label: i.toString() });
    }
    return options;
  };

  const refereeOptions = getRefereeOptions();
  const fieldOptions = getFieldOptions();

  // Transform referee options for EditableMatchCard (includes "Kein SR" option)
  const editableRefereeOptions: RefereeOption[] = [
    { value: null, label: 'Kein SR' },
    ...refereeOptions.map(opt => ({
      value: opt.value,
      label: `SR ${opt.label}`,
    })),
  ];

  // Styles
  const containerStyle: CSSProperties = {
    marginBottom: cssVars.spacing.lg,
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.primary,
    marginBottom: cssVars.spacing.md,
  };

  // Get active match for drag overlay
  const activeMatch = activeId ? sortedMatches.find(m => m.id === activeId) : null;

  // Render desktop card list (non-edit mode)
  const renderDesktopCardContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs }}>
      {sortedMatches.map((match) => {
        const status = getMatchStatus(match);
        const isExpanded = expandedMatchId === match.id;

        return (
          <DesktopCard
            key={match.id}
            match={match}
            status={status}
            isExpanded={isExpanded}
            tournament={tournament}
            showGroupLabel={showGroupLabel}
            onCardClick={handleCardClick}
            onCircleClick={handleCircleClick}
            renderExpandContent={renderExpandContent}
          />
        );
      })}
    </div>
  );

  // Render desktop cards for edit mode (with DnD support)
  const renderDesktopEditContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs }}>
      {sortedMatches.map((match) => {
        const status = getMatchStatus(match);

        // Get pending changes for edit mode
        const hasPendingRef = pendingChanges?.refereeAssignments[match.id] !== undefined;
        const displayedRef = hasPendingRef
          ? pendingChanges.refereeAssignments[match.id]
          : match.referee;
        const hasPendingField = pendingChanges?.fieldAssignments[match.id] !== undefined;
        const displayedField = hasPendingField
          ? pendingChanges.fieldAssignments[match.id]
          : match.field;
        const hasUnsavedChanges = hasPendingRef || hasPendingField;

        return (
          <SortableDesktopCard
            key={match.id}
            match={match}
            status={status}
            displayedRef={displayedRef}
            displayedField={displayedField}
            hasUnsavedChanges={hasUnsavedChanges}
            hasPendingRef={hasPendingRef}
            hasPendingField={hasPendingField}
            conflicts={getMatchConflicts(match.id)}
            editingSchedule={editingSchedule}
            canSwap={!!onMatchSwap}
            tournament={tournament}
            showGroupLabel={showGroupLabel}
            showReferees={showReferees}
            refereeOptions={refereeOptions}
            showFields={showFields}
            fieldOptions={fieldOptions}
            onRefereeChange={onRefereeChange}
            onFieldChange={onFieldChange}
          />
        );
      })}
    </div>
  );

  return (
    <div style={containerStyle} className="group-stage-schedule">
      {showTitle && (
        <h2 style={titleStyle}>
          {hasGroups ? 'Vorrunde' : 'Spielplan'}
        </h2>
      )}

      {/* Desktop View - Card layout (normal) or Card edit mode */}
      {editingSchedule && onMatchSwap ? (
        /* Edit Mode: Desktop cards with DnD, conflict display, and inline editing */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="desktop-view">
            <SortableContext
              items={sortedMatches.map(m => m.id)}
              strategy={verticalListSortingStrategy}
            >
              {renderDesktopEditContent()}
            </SortableContext>
          </div>

          {/* Desktop Drag Overlay - Compact row preview */}
          <DragOverlay dropAnimation={null}>
            {activeMatch && (
              <div style={{
                backgroundColor: cssVars.colors.surface,
                boxShadow: `0 8px 24px ${cssVars.colors.surfaceDark}`,
                borderRadius: cssVars.borderRadius.md,
                border: `3px solid ${cssVars.colors.primary}`,
                padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
                display: 'flex',
                alignItems: 'center',
                gap: cssVars.spacing.md,
                minWidth: spacingSemantics.dialogSm,
                maxWidth: spacingSemantics.dialogXl,
                cursor: 'grabbing',
              }}>
                <span style={{ color: cssVars.colors.primary, fontSize: cssVars.fontSizes.lg }}>⋮⋮</span>
                <span style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary }}>
                  {activeMatch.time}
                </span>
                <span style={{ fontWeight: cssVars.fontWeights.bold, flex: 1 }}>
                  {activeMatch.homeTeam}
                  <span style={{ color: cssVars.colors.textMuted, padding: `0 ${cssVars.spacing.sm}` }}>vs</span>
                  {activeMatch.awayTeam}
                </span>
                {hasGroups && (
                  <span style={{
                    backgroundColor: cssVars.colors.primary,
                    color: cssVars.colors.background,
                    padding: `2px ${cssVars.spacing.sm}`,
                    borderRadius: cssVars.borderRadius.sm,
                    fontSize: cssVars.fontSizes.xs,
                    fontWeight: cssVars.fontWeights.semibold,
                  }}>
                    {activeMatch.group ? getGroupShortCode(activeMatch.group, tournament) : '-'}
                  </span>
                )}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        /* Normal Mode: MatchCardDesktop with expand functionality (no DnD needed) */
        <div className="desktop-view">
          {renderDesktopCardContent()}
        </div>
      )}

      {/* Mobile Card View - Spielplan 2.0 with MatchCard */}
      {editingSchedule && onMatchSwap ? (
        /* Edit Mode: Mobile cards with DnD */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="mobile-view">
            <SortableContext
              items={sortedMatches.map(m => m.id)}
              strategy={verticalListSortingStrategy}
            >
              {sortedMatches.map((match) => {
                const status = getMatchStatus(match);
                const isExpanded = expandedMatchId === match.id;

                // Get pending changes for edit mode
                const hasPendingRef = pendingChanges?.refereeAssignments[match.id] !== undefined;
                const displayedRef = hasPendingRef
                  ? pendingChanges.refereeAssignments[match.id]
                  : match.referee;
                const hasPendingField = pendingChanges?.fieldAssignments[match.id] !== undefined;
                const displayedField = hasPendingField
                  ? pendingChanges.fieldAssignments[match.id]
                  : match.field;
                const hasUnsavedChanges = hasPendingRef || hasPendingField;

                return (
                  <SortableMobileCard
                    key={match.id}
                    match={match}
                    status={status}
                    isExpanded={isExpanded}
                    displayedRef={displayedRef}
                    displayedField={displayedField}
                    hasUnsavedChanges={hasUnsavedChanges}
                    hasPendingField={hasPendingField}
                    conflicts={getMatchConflicts(match.id)}
                    editingSchedule={editingSchedule}
                    canSwap={!!onMatchSwap}
                    tournament={tournament}
                    showGroupLabel={showGroupLabel}
                    showReferees={showReferees}
                    refereeOptions={editableRefereeOptions}
                    showFields={showFields}
                    fieldOptions={fieldOptions}
                    onRefereeChange={onRefereeChange}
                    onFieldChange={onFieldChange}
                    onCardClick={handleCardClick}
                    onCircleClick={handleCircleClick}
                    renderExpandContent={renderExpandContent}
                  />
                );
              })}
            </SortableContext>
          </div>

          {/* Mobile Drag Overlay */}
          <DragOverlay dropAnimation={null}>
            {activeMatch && (
              <div style={{
                backgroundColor: cssVars.colors.surface,
                boxShadow: `0 8px 24px ${cssVars.colors.surfaceDark}`,
                borderRadius: cssVars.borderRadius.md,
                border: `3px solid ${cssVars.colors.primary}`,
                padding: cssVars.spacing.md,
                display: 'flex',
                alignItems: 'center',
                gap: cssVars.spacing.sm,
                minWidth: '280px',
                maxWidth: '100%',
                cursor: 'grabbing',
              }}>
                <span style={{ color: cssVars.colors.primary, fontSize: cssVars.fontSizes.lg }}>⋮⋮</span>
                <span style={{ fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.primary }}>
                  #{activeMatch.matchNumber}
                </span>
                <span style={{ color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm }}>
                  {activeMatch.time}
                </span>
                <span style={{ fontWeight: cssVars.fontWeights.semibold, flex: 1, fontSize: cssVars.fontSizes.sm }}>
                  {activeMatch.homeTeam} <span style={{ color: cssVars.colors.textMuted }}>vs</span> {activeMatch.awayTeam}
                </span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        /* Normal Mode: Standard MatchCards without DnD */
        <div className="mobile-view">
          {sortedMatches.map((match) => {
            const status = getMatchStatus(match);
            const isExpanded = expandedMatchId === match.id;

            const cardProps = {
              matchId: match.id,
              matchNumber: match.matchNumber,
              scheduledTime: match.time,
              field: match.field,
              group: match.group ? getGroupShortCode(match.group, tournament) : undefined,
              showGroupLabel,
              homeTeam: getTeamForDisplay(tournament?.teams, match.originalTeamA, match.homeTeam),
              awayTeam: getTeamForDisplay(tournament?.teams, match.originalTeamB, match.awayTeam),
              homeScore: match.scoreA ?? 0,
              awayScore: match.scoreB ?? 0,
              status: status,
              progress: 0,
            };

            return (
              <div key={match.id} style={{ marginBottom: cssVars.spacing.sm }}>
                <MatchCard
                  {...cardProps}
                  onCardClick={() => handleCardClick(match.id)}
                  onCircleClick={() => handleCircleClick(match.id)}
                  isExpanded={isExpanded}
                  expandContent={renderExpandContent(match)}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Match Summary for finished matches */}
      {showMatchSummary && summaryMatchId && (() => {
        const match = matches.find(m => m.id === summaryMatchId);
        if (!match) {return null;}

        // Get live match data for events
        const liveMatch = liveMatches.get(summaryMatchId);
        const liveEvents = liveMatch?.events;
        const events: RuntimeMatchEvent[] = liveEvents
          ? liveEvents.map(e => ({
              ...e,
              matchId: e.matchId,
              scoreAfter: e.scoreAfter,
            }))
          : [];

        return (
          <MatchSummary
            isOpen={showMatchSummary}
            onClose={() => {
              setShowMatchSummary(false);
              setSummaryMatchId(null);
            }}
            homeScore={match.scoreA ?? 0}
            awayScore={match.scoreB ?? 0}
            homeTeamId={match.originalTeamA}
            awayTeamId={match.originalTeamB}
            homeTeamName={match.homeTeam}
            awayTeamName={match.awayTeam}
            events={events}
            onEditScore={() => {
              // Close summary and open quick edit for score correction
              setShowMatchSummary(false);
              setSummaryMatchId(null);
              setExpandedMatchId(summaryMatchId);
              setExpandType('quick');
            }}
          />
        );
      })()}

      <style>{`
        /* Hide mobile view by default */
        .group-stage-schedule .mobile-view {
          display: none;
        }

        /* Mobile: Show cards, hide table */
        ${mediaQueries.tabletDown} {
          .group-stage-schedule .desktop-view {
            display: none;
          }
          .group-stage-schedule .mobile-view {
            display: block;
          }
        }

        /* Mobile correction button hover/active */
        .correction-btn-mobile:hover,
        .correction-btn-mobile:active {
          background: ${cssVars.colors.primary} !important;
          color: white !important;
          border-color: ${cssVars.colors.primary} !important;
        }

        /* Tablet: Keep table but adjust sizing */
        @media (min-width: 768px) and (max-width: 1024px) {
          .group-stage-schedule table {
            font-size: 12px;
          }
          .group-stage-schedule th,
          .group-stage-schedule td {
            padding: 8px 6px;
          }
        }

        /* Print: Always use table layout */
        @media print {
          .group-stage-schedule {
            break-inside: avoid;
          }
          .group-stage-schedule .mobile-view {
            display: none !important;
          }
          .group-stage-schedule .desktop-view {
            display: block !important;
          }
          .group-stage-schedule table {
            min-width: 100%;
          }
        }
      `}</style>
    </div>
  );
};
