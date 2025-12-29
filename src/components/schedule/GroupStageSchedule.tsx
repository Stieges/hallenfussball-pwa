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
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { colors, fontSizes, fontWeights, borderRadius, spacing } from '../../design-tokens';
import { ScheduledMatch } from '../../lib/scheduleGenerator';
import { RefereeConfig, Tournament } from '../../types/tournament';
import { getGroupShortCode } from '../../utils/displayNames';
import {
  MatchCard,
  MatchCardDesktop,
  EditableMatchCard,
  type MatchCardStatus,
  type RefereeOption,
} from './MatchCard';
import { QuickScoreExpand, LiveInfoExpand, StartMatchExpand } from './MatchExpand';
import { useMatchConflictsFromTournament } from '../../features/schedule-editor/hooks/useMatchConflicts';
import type { ScheduleConflict } from '../../features/schedule-editor/types';

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

  // Close expand when clicking outside or pressing Escape
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
        // Finished: Show quick edit (same as card click for now)
        setExpandedMatchId(matchId);
        setExpandType('quick');
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
  const handleNavigateToCockpit = useCallback((_matchId: string) => {
    // For now, just close the expand - navigation will be added later
    setExpandedMatchId(null);
    setExpandType(null);
  }, []);

  /**
   * Unified render function for expand content (used by both mobile and desktop)
   */
  const renderExpandContent = useCallback((match: ScheduledMatch): React.ReactNode => {
    if (expandedMatchId !== match.id || !expandType) {
      return null;
    }

    const homeTeam = { id: `${match.id}-home`, name: match.homeTeam };
    const awayTeam = { id: `${match.id}-away`, name: match.awayTeam };

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
  }, [expandedMatchId, expandType, handleExpandClose, handleExpandSave, handleNavigateToCockpit]);

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
        padding: '40px 20px',
        color: colors.textSecondary,
        fontSize: '15px'
      }}>
        Keine Spiele vorhanden
      </div>
    );
  }

  const showReferees = refereeConfig && refereeConfig.mode !== 'none';
  const showFields = numberOfFields > 1;

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
    marginBottom: spacing.lg,
  };

  const titleStyle: CSSProperties = {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.primary,
    marginBottom: spacing.md,
  };

  // Mobile edit mode select style
  const mobileSelectStyle: CSSProperties = {
    padding: '4px 8px',
    border: `1px solid ${colors.border}`,
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: fontWeights.semibold,
    cursor: 'pointer',
    backgroundColor: colors.background,
    color: colors.textPrimary,
    minHeight: '32px',
  };

  // Get active match for drag overlay
  const activeMatch = activeId ? sortedMatches.find(m => m.id === activeId) : null;

  // ============================================================================
  // SortableMobileCard Component - uses useSortable for mobile card DnD
  // Passes drag handle attributes/listeners to EditableMatchCard
  // ============================================================================
  interface SortableMobileCardProps {
    match: ScheduledMatch;
    status: MatchCardStatus;
    isExpanded: boolean;
    displayedRef: number | null | undefined;
    displayedField: number | undefined;
    hasUnsavedChanges: boolean;
    hasPendingField: boolean;
    conflicts: ScheduleConflict[];
  }

  const SortableMobileCard: React.FC<SortableMobileCardProps> = ({
    match,
    status,
    isExpanded,
    displayedRef,
    displayedField,
    hasUnsavedChanges,
    hasPendingField,
    conflicts,
  }) => {
    const isLocked = status === 'running' || status === 'finished';

    // Can only drag scheduled matches (not running or finished)
    const canDrag = !!(editingSchedule && onMatchSwap && !isLocked);

    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
      isOver,
    } = useSortable({
      id: match.id,
      disabled: !canDrag,
    });

    // Apply transform and transition for smooth animations
    const wrapperStyle: CSSProperties = {
      marginBottom: spacing.sm,
      transform: CSS.Transform.toString(transform),
      transition,
      // Drag states
      ...(isDragging ? {
        opacity: 0.5,
        zIndex: 0,
      } : {}),
      ...(isOver && !isDragging ? {
        transform: CSS.Transform.toString(transform),
      } : {}),
    };

    // Shared card props
    const cardProps = {
      matchId: match.id,
      matchNumber: match.matchNumber,
      scheduledTime: match.time,
      field: match.field,
      group: match.group ? getGroupShortCode(match.group, tournament) : undefined,
      homeTeam: { id: `${match.id}-home`, name: match.homeTeam },
      awayTeam: { id: `${match.id}-away`, name: match.awayTeam },
      homeScore: match.scoreA ?? 0,
      awayScore: match.scoreB ?? 0,
      status: status,
      progress: 0,
    };

    return (
      <div ref={setNodeRef} style={wrapperStyle}>
        <EditableMatchCard
          {...cardProps}
          canDrag={canDrag}
          isDragging={isDragging}
          isDropTarget={isOver && !isDragging}
          dragHandleAttributes={attributes}
          dragHandleListeners={listeners}
          isLocked={isLocked}
          hasUnsavedChanges={hasUnsavedChanges}
          referee={displayedRef ?? undefined}
          refereeOptions={showReferees ? editableRefereeOptions : []}
          onRefereeChange={onRefereeChange ? (matchId, value) => {
            const numValue = value === null ? null :
              typeof value === 'string' ? parseInt(value) : value;
            onRefereeChange(matchId, numValue);
          } : undefined}
          conflicts={conflicts}
          onCardClick={() => handleCardClick(match.id)}
          onCircleClick={() => handleCircleClick(match.id)}
          isExpanded={isExpanded}
          expandContent={renderExpandContent(match)}
        />

        {/* Edit mode: Field selector (shown below card) */}
        {editingSchedule && showFields && onFieldChange && (
          <div style={{
            display: 'flex',
            gap: spacing.sm,
            marginTop: spacing.xs,
            padding: `${spacing.xs} ${spacing.sm}`,
            backgroundColor: colors.surfaceLight,
            borderRadius: borderRadius.sm,
          }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: fontSizes.xs, color: colors.textMuted }}>Feld</label>
              <select
                value={displayedField || 1}
                onChange={(e) => onFieldChange(match.id, parseInt(e.target.value))}
                style={{
                  ...mobileSelectStyle,
                  width: '100%',
                  border: `1px solid ${hasPendingField ? colors.primary : colors.border}`,
                }}
              >
                {fieldOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // DesktopCard Component - renders MatchCardDesktop (no DnD in normal mode)
  // ============================================================================
  const DesktopCard: React.FC<{ match: ScheduledMatch }> = ({ match }) => {
    const status = getMatchStatus(match);
    const isExpanded = expandedMatchId === match.id;

    return (
      <div style={{ marginBottom: spacing.sm }}>
        <MatchCardDesktop
          matchId={match.id}
          matchNumber={match.matchNumber}
          scheduledTime={match.time}
          field={match.field}
          group={match.group ? getGroupShortCode(match.group, tournament) : undefined}
          homeTeam={{ id: `${match.id}-home`, name: match.homeTeam }}
          awayTeam={{ id: `${match.id}-away`, name: match.awayTeam }}
          homeScore={match.scoreA ?? 0}
          awayScore={match.scoreB ?? 0}
          status={status}
          progress={0}
          onRowClick={() => handleCardClick(match.id)}
          onCircleClick={() => handleCircleClick(match.id)}
          isExpanded={isExpanded}
          expandContent={renderExpandContent(match)}
        />
      </div>
    );
  };

  // ============================================================================
  // SortableDesktopCard Component - Desktop card with DnD support for edit mode
  // Uses horizontal layout with drag handle, conflict badge, and SR controls
  // ============================================================================
  interface SortableDesktopCardProps {
    match: ScheduledMatch;
    status: MatchCardStatus;
    displayedRef: number | null | undefined;
    displayedField: number | undefined;
    hasUnsavedChanges: boolean;
    hasPendingRef: boolean;
    hasPendingField: boolean;
    conflicts: ScheduleConflict[];
  }

  const SortableDesktopCard: React.FC<SortableDesktopCardProps> = ({
    match,
    status,
    displayedRef,
    displayedField,
    hasUnsavedChanges,
    hasPendingRef,
    hasPendingField,
    conflicts,
  }) => {
    const isLocked = status === 'running' || status === 'finished';
    const canDrag = !!(editingSchedule && onMatchSwap && !isLocked);
    const hasConflicts = conflicts.length > 0;
    const hasErrors = conflicts.some(c => c.severity === 'error');

    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
      isOver,
    } = useSortable({
      id: match.id,
      disabled: !canDrag,
    });

    // Container style with transform
    const containerStyle: CSSProperties = {
      marginBottom: spacing.sm,
      transform: CSS.Transform.toString(transform),
      transition,
      ...(isDragging ? { opacity: 0.5, zIndex: 0 } : {}),
    };

    // Row wrapper with drag handle integrated
    const rowWrapperStyle: CSSProperties = {
      display: 'flex',
      alignItems: 'stretch',
      borderRadius: borderRadius.md,
      overflow: 'hidden',
      border: `1px solid ${
        isOver && !isDragging
          ? colors.primary
          : hasErrors
            ? colors.error
            : hasConflicts
              ? colors.warning
              : hasUnsavedChanges
                ? colors.editorDirtyBorder
                : colors.border
      }`,
      boxShadow: isOver && !isDragging
        ? `0 0 12px ${colors.primaryGlowLight}`
        : undefined,
    };

    // Drag handle style
    const dragHandleStyle: CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 40,
      backgroundColor: isOver && !isDragging
        ? colors.editorSwapActive
        : hasUnsavedChanges
          ? colors.editorDirtyRowBg
          : colors.editorEditModeRowBg,
      cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'not-allowed',
      color: isLocked ? colors.textDisabled : colors.textSecondary,
      fontSize: fontSizes.lg,
      touchAction: 'none',
      flexShrink: 0,
    };

    // Content area style
    const contentStyle: CSSProperties = {
      flex: 1,
      display: 'grid',
      gridTemplateColumns: showReferees
        ? 'auto auto auto 1fr auto 1fr auto auto'
        : 'auto auto 1fr auto 1fr auto auto',
      alignItems: 'center',
      gap: spacing.md,
      padding: `${spacing.sm} ${spacing.md}`,
      backgroundColor: isOver && !isDragging
        ? colors.editorSwapActive
        : hasUnsavedChanges
          ? colors.editorDirtyRowBg
          : status === 'running'
            ? colors.statusLiveRowBg
            : colors.surface,
    };

    // Conflict indicator style
    const conflictIndicatorStyle: CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 28,
      height: 28,
      borderRadius: '50%',
      backgroundColor: hasErrors ? colors.error : colors.warning,
      color: colors.onError,
      fontSize: fontSizes.sm,
      fontWeight: fontWeights.bold,
      cursor: 'help',
      flexShrink: 0,
    };

    // SR dropdown style
    const srSelectStyle: CSSProperties = {
      padding: '4px 8px',
      border: `1px solid ${hasPendingRef ? colors.primary : colors.border}`,
      borderRadius: borderRadius.sm,
      fontSize: fontSizes.sm,
      fontWeight: fontWeights.semibold,
      backgroundColor: colors.background,
      color: colors.textPrimary,
      cursor: 'pointer',
      minWidth: 60,
    };

    // Field dropdown style
    const fieldSelectStyle: CSSProperties = {
      padding: '4px 8px',
      border: `1px solid ${hasPendingField ? colors.primary : colors.border}`,
      borderRadius: borderRadius.sm,
      fontSize: fontSizes.sm,
      fontWeight: fontWeights.semibold,
      backgroundColor: colors.background,
      color: colors.textPrimary,
      cursor: 'pointer',
      minWidth: 60,
    };

    const timeStyle: CSSProperties = {
      fontSize: fontSizes.sm,
      fontWeight: fontWeights.medium,
      color: status === 'running' ? colors.primary : colors.textSecondary,
      fontVariantNumeric: 'tabular-nums',
      minWidth: 50,
    };

    const teamNameStyle: CSSProperties = {
      fontSize: fontSizes.md,
      fontWeight: fontWeights.bold,
      color: colors.textPrimary,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    };

    const vsStyle: CSSProperties = {
      fontSize: fontSizes.sm,
      color: colors.textMuted,
      padding: `0 ${spacing.sm}`,
    };

    const groupStyle: CSSProperties = {
      fontSize: fontSizes.xs,
      color: colors.textSecondary,
      textAlign: 'right',
      minWidth: 45,
    };

    return (
      <div ref={setNodeRef} style={containerStyle}>
        <div style={rowWrapperStyle}>
          {/* Drag Handle */}
          <div
            style={dragHandleStyle}
            {...(canDrag ? { ...attributes, ...listeners } : {})}
            aria-label={isLocked ? 'Spiel kann nicht verschoben werden' : 'Ziehen zum Verschieben'}
          >
            {isLocked ? '🔒' : '⋮⋮'}
          </div>

          {/* Content */}
          <div style={contentStyle}>
            {/* Conflict Indicator */}
            {hasConflicts && (
              <div
                style={conflictIndicatorStyle}
                title={conflicts.map(c => c.message).join('\n')}
              >
                {conflicts.length}
              </div>
            )}
            {!hasConflicts && <div style={{ width: 28 }} />}

            {/* SR Selector */}
            {showReferees && onRefereeChange && (
              <select
                value={displayedRef ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  onRefereeChange(match.id, value ? parseInt(value) : null);
                }}
                style={srSelectStyle}
                aria-label="Schiedsrichter"
              >
                <option value="">SR -</option>
                {refereeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    SR {opt.label}
                  </option>
                ))}
              </select>
            )}

            {/* Time */}
            <div style={timeStyle}>
              {isDragging ? '↕️' : match.time}
            </div>

            {/* Home Team */}
            <div style={{ ...teamNameStyle, textAlign: 'right' }}>
              {match.homeTeam}
            </div>

            {/* VS */}
            <div style={vsStyle}>vs</div>

            {/* Away Team */}
            <div style={teamNameStyle}>
              {match.awayTeam}
            </div>

            {/* Field Selector */}
            {showFields && onFieldChange && (
              <select
                value={displayedField || 1}
                onChange={(e) => onFieldChange(match.id, parseInt(e.target.value))}
                style={fieldSelectStyle}
                aria-label="Feld"
              >
                {fieldOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    F{opt.label}
                  </option>
                ))}
              </select>
            )}

            {/* Group */}
            <div style={groupStyle}>
              {match.group ? `Gr. ${getGroupShortCode(match.group, tournament)}` : ''}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render desktop card list (non-edit mode)
  const renderDesktopCardContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
      {sortedMatches.map((match) => (
        <DesktopCard key={match.id} match={match} />
      ))}
    </div>
  );

  // Render desktop cards for edit mode (with DnD support)
  const renderDesktopEditContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
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
          />
        );
      })}
    </div>
  );

  return (
    <div style={containerStyle} className="group-stage-schedule">
      <h2 style={titleStyle}>
        {hasGroups ? 'Vorrunde' : 'Spielplan'}
      </h2>

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
                backgroundColor: colors.surface,
                boxShadow: `0 8px 24px ${colors.surfaceDark}`,
                borderRadius: borderRadius.md,
                border: `3px solid ${colors.primary}`,
                padding: `${spacing.sm} ${spacing.md}`,
                display: 'flex',
                alignItems: 'center',
                gap: spacing.md,
                minWidth: '400px',
                maxWidth: '700px',
                cursor: 'grabbing',
              }}>
                <span style={{ color: colors.primary, fontSize: fontSizes.lg }}>⋮⋮</span>
                <span style={{ fontSize: fontSizes.sm, color: colors.textSecondary }}>
                  {activeMatch.time}
                </span>
                <span style={{ fontWeight: fontWeights.bold, flex: 1 }}>
                  {activeMatch.homeTeam}
                  <span style={{ color: colors.textMuted, padding: `0 ${spacing.sm}` }}>vs</span>
                  {activeMatch.awayTeam}
                </span>
                {hasGroups && (
                  <span style={{
                    backgroundColor: colors.primary,
                    color: colors.background,
                    padding: `2px ${spacing.sm}`,
                    borderRadius: borderRadius.sm,
                    fontSize: fontSizes.xs,
                    fontWeight: fontWeights.semibold,
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
                  />
                );
              })}
            </SortableContext>
          </div>

          {/* Mobile Drag Overlay */}
          <DragOverlay dropAnimation={null}>
            {activeMatch && (
              <div style={{
                backgroundColor: colors.surface,
                boxShadow: `0 8px 24px ${colors.surfaceDark}`,
                borderRadius: borderRadius.md,
                border: `3px solid ${colors.primary}`,
                padding: spacing.md,
                display: 'flex',
                alignItems: 'center',
                gap: spacing.sm,
                minWidth: '280px',
                maxWidth: '100%',
                cursor: 'grabbing',
              }}>
                <span style={{ color: colors.primary, fontSize: fontSizes.lg }}>⋮⋮</span>
                <span style={{ fontWeight: fontWeights.bold, color: colors.primary }}>
                  #{activeMatch.matchNumber}
                </span>
                <span style={{ color: colors.textSecondary, fontSize: fontSizes.sm }}>
                  {activeMatch.time}
                </span>
                <span style={{ fontWeight: fontWeights.semibold, flex: 1, fontSize: fontSizes.sm }}>
                  {activeMatch.homeTeam} <span style={{ color: colors.textMuted }}>vs</span> {activeMatch.awayTeam}
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
              homeTeam: { id: `${match.id}-home`, name: match.homeTeam },
              awayTeam: { id: `${match.id}-away`, name: match.awayTeam },
              homeScore: match.scoreA ?? 0,
              awayScore: match.scoreB ?? 0,
              status: status,
              progress: 0,
            };

            return (
              <div key={match.id} style={{ marginBottom: spacing.sm }}>
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

      <style>{`
        /* Hide mobile view by default */
        .group-stage-schedule .mobile-view {
          display: none;
        }

        /* Mobile: Show cards, hide table */
        @media (max-width: 767px) {
          .group-stage-schedule .desktop-view {
            display: none;
          }
          .group-stage-schedule .mobile-view {
            display: block;
          }
        }

        /* Mobile correction button hover */
        .correction-btn-mobile:hover {
          background: ${colors.primary} !important;
          color: white !important;
          border-color: ${colors.primary} !important;
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
