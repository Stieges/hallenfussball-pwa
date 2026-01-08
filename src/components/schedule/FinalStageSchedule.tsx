/**
 * FinalStageSchedule - Displays playoff/final matches in MeinTurnierplan style
 * Fully responsive with table view for desktop and card view for mobile
 *
 * US-SCHEDULE-EDITOR: Now supports Drag & Drop for match swapping in edit mode
 */

import { CSSProperties, useState, useMemo, useEffect } from 'react';
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
import { cssVars, shadowSemantics, mediaQueries } from '../../design-tokens'
import { ScheduledMatch } from '../../core/generators';
import { RefereeConfig } from '../../types/tournament';
import { MatchScoreCell } from './MatchScoreCell';
import { LiveBadge } from './LiveBadge';

// Pending changes during edit mode
interface PendingChanges {
  refereeAssignments: Record<string, number | null>;
  fieldAssignments: Record<string, number>;
}

interface FinalStageScheduleProps {
  matches: ScheduledMatch[];
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
  /** US-SCHEDULE-EDITOR: Callback when matches are swapped via DnD */
  onMatchSwap?: (matchId1: string, matchId2: string) => void;
  /** Whether to show the section title (default: true) */
  showTitle?: boolean;
  // Note: Permission check is now handled in ScheduleTab
}

export const FinalStageSchedule: React.FC<FinalStageScheduleProps> = ({
  matches,
  refereeConfig,
  numberOfFields = 1,
  onRefereeChange,
  onFieldChange,
  onScoreChange,
  editable = false,
  editingSchedule = false,
  pendingChanges,
  finishedMatches,
  correctionMatchId,
  onStartCorrection,
  runningMatchIds,
  onMatchSwap,
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
    if (!editingSchedule) {
      setDisplayOrder(matches.map(m => m.id));
    }
  }, [matches, editingSchedule]);

  // Reset when entering edit mode (start fresh from current order)
  useEffect(() => {
    if (editingSchedule) {
      setDisplayOrder(matches.map(m => m.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only reset when entering edit mode, not when matches change
  }, [editingSchedule]);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) { return; }

    const sourceMatchId = active.id as string;
    const targetMatchId = over.id as string;

    // Immediately update visual order using arrayMove
    setDisplayOrder(prevOrder => {
      const oldIndex = prevOrder.indexOf(sourceMatchId);
      const newIndex = prevOrder.indexOf(targetMatchId);
      if (oldIndex === -1 || newIndex === -1) { return prevOrder; }
      return arrayMove(prevOrder, oldIndex, newIndex);
    });

    if (onMatchSwap) {
      onMatchSwap(sourceMatchId, targetMatchId);
    }
  };

  // Sort matches by displayOrder for rendering
  const sortedMatches = useMemo(() => {
    const orderMap = new Map(displayOrder.map((id, index) => [id, index]));
    return [...matches].sort((a, b) => {
      const indexA = orderMap.get(a.id) ?? Infinity;
      const indexB = orderMap.get(b.id) ?? Infinity;
      return indexA - indexB;
    });
  }, [matches, displayOrder]);

  // Get active match for drag overlay
  const activeMatch = activeId ? sortedMatches.find(m => m.id === activeId) : null;

  // SortableRow component for final matches - uses useSortable for smooth animations
  // Drag listeners are only attached to the drag handle, not the entire row
  interface SortableRowRenderProps {
    attributes: ReturnType<typeof useSortable>['attributes'];
    listeners: ReturnType<typeof useSortable>['listeners'];
    canDrag: boolean;
    isDragging: boolean;
  }

  const SortableRow: React.FC<{
    match: ScheduledMatch;
    children: (props: SortableRowRenderProps) => React.ReactNode;
  }> = ({ match, children }) => {
    const isRunning = runningMatchIds?.has(match.id);
    const isFinished = finishedMatches?.has(match.id);
    const canDrag = !!(editingSchedule && onMatchSwap && !isRunning && !isFinished);

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
    const style: CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      ...(isRunning ? { backgroundColor: cssVars.colors.statusLiveRowBg } : {}),
      ...(editingSchedule && canDrag ? {
        outline: `2px solid ${cssVars.colors.accent}`,
        outlineOffset: '-1px',
      } : {}),
      // When THIS row is being dragged: show as placeholder
      ...(isDragging ? {
        opacity: 0.4,
        backgroundColor: cssVars.colors.editorSwapBg,
        outline: `2px dashed ${cssVars.colors.accent}`,
        outlineOffset: '-1px',
        zIndex: 0,
      } : {}),
      // When another row is dragged OVER this one: highlight as drop target
      ...(isOver && !isDragging ? {
        backgroundColor: cssVars.colors.editorSwapActive,
        outline: `3px solid ${cssVars.colors.accent}`,
        outlineOffset: '-1px',
        boxShadow: shadowSemantics.dropTargetGlow,
      } : {}),
    };

    return (
      <tr ref={setNodeRef} style={style}>
        {children({ attributes, listeners, canDrag, isDragging })}
      </tr>
    );
  };

  if (matches.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: `${cssVars.spacing.xl} ${cssVars.spacing.lg}`,
        color: cssVars.colors.textSecondary,
        fontSize: cssVars.fontSizes.md
      }}>
        Keine Spiele vorhanden
      </div>
    );
  }

  const showReferees = refereeConfig && refereeConfig.mode !== 'none';
  const showFields = numberOfFields > 1;

  const getRefereeOptions = () => {
    if (!refereeConfig) { return []; }
    const numberOfReferees = refereeConfig.mode === 'organizer'
      ? (refereeConfig.numberOfReferees || 2)
      : matches.length;
    const options = [];
    for (let i = 1; i <= numberOfReferees; i++) {
      const name = refereeConfig.refereeNames?.[i];
      const label = name ? `${i} (${name})` : i.toString();
      options.push({ value: i, label });
    }
    return options;
  };

  const getFieldOptions = () => {
    const options = [];
    for (let i = 1; i <= numberOfFields; i++) {
      options.push({ value: i, label: i.toString() });
    }
    return options;
  };

  const refereeOptions = getRefereeOptions();
  const fieldOptions = getFieldOptions();

  const containerStyle: CSSProperties = { marginBottom: cssVars.spacing.lg };
  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.accent,
    marginBottom: cssVars.spacing.md,
  };
  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: cssVars.fontSizes.sm,
    minWidth: '600px',
  };
  const thStyle: CSSProperties = {
    background: cssVars.colors.accent,
    color: cssVars.colors.background,
    padding: `10px ${cssVars.spacing.sm}`,
    textAlign: 'left',
    fontWeight: cssVars.fontWeights.semibold,
    borderBottom: `2px solid ${cssVars.colors.border}`,
  };
  const tdStyle: CSSProperties = {
    padding: cssVars.spacing.sm,
    borderBottom: `1px solid ${cssVars.colors.border}`,
    color: cssVars.colors.textPrimary,
  };
  const resultCellStyle: CSSProperties = {
    ...tdStyle,
    textAlign: 'center',
    fontWeight: cssVars.fontWeights.bold,
    minWidth: '60px',
  };
  // Match label column style (compact for "Runde" column)
  const matchLabelCellStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.accent,
    whiteSpace: 'nowrap',
  };

  // Team cell style (matching GroupStageSchedule)
  const teamCellStyle: CSSProperties = {
    ...tdStyle,
    fontWeight: cssVars.fontWeights.medium,
  };

  // Mobile Card Styles - Compact Design (matching GroupStageSchedule)
  const mobileCardStyle: CSSProperties = {
    backgroundColor: cssVars.colors.background,
    border: `2px solid ${cssVars.colors.accent}`,
    borderRadius: cssVars.borderRadius.md,
    padding: `10px ${cssVars.spacing.sm}`,
    marginBottom: cssVars.spacing.sm,
  };

  const mobileCardHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: cssVars.spacing.xs,
    fontSize: cssVars.fontSizes.sm,
  };

  const mobileMatchInfoStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    color: cssVars.colors.textSecondary,
  };

  const mobileMatchNumberStyle: CSSProperties = {
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.accent,
  };

  const mobileLabelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.accent,
    marginBottom: cssVars.spacing.xs,
    textAlign: 'center' as const,
    backgroundColor: `${cssVars.colors.accent}20`,
    padding: '2px 8px',
    borderRadius: cssVars.borderRadius.sm,
  };

  const mobileMetaCompactStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.sm,
    color: cssVars.colors.textMuted,
    fontSize: cssVars.fontSizes.xs,
  };

  // Team row with inline score - compact layout
  const getMobileTeamRowStyle = (isWinner: boolean, isLoser: boolean, hasResult: boolean, isPlaceholder: boolean): CSSProperties => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
    fontSize: cssVars.fontSizes.md,
    fontWeight: isWinner ? cssVars.fontWeights.bold : cssVars.fontWeights.normal,
    color: isPlaceholder
      ? cssVars.colors.textPlaceholder
      : hasResult
        ? (isLoser ? cssVars.colors.textMuted : cssVars.colors.textPrimary)
        : cssVars.colors.textPrimary,
    fontStyle: isPlaceholder ? 'italic' : 'normal',
  });

  const mobileTeamNameStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  };

  const mobileScoreStyle = (isWinner: boolean): CSSProperties => ({
    fontWeight: cssVars.fontWeights.bold,
    fontSize: cssVars.fontSizes.lg,
    minWidth: '24px',
    textAlign: 'right' as const,
    color: isWinner ? cssVars.colors.success : cssVars.colors.textPrimary,
  });

  const mobileWinnerIconStyle: CSSProperties = {
    color: cssVars.colors.success,
    fontSize: cssVars.fontSizes.sm,
    flexShrink: 0,
  };

  const mobileScoreInputStyle: CSSProperties = {
    width: '36px',
    padding: cssVars.spacing.xs,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.bold,
    textAlign: 'center' as const,
    backgroundColor: cssVars.colors.background,
    color: cssVars.colors.textPrimary,
  };

  const mobileSelectStyle: CSSProperties = {
    height: '32px',
    padding: `0 ${cssVars.spacing.lg} 0 ${cssVars.spacing.sm}`,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    cursor: 'pointer',
    backgroundColor: cssVars.colors.background,
    color: cssVars.colors.textPrimary,
    // Fix: Prevent all options from rendering at once
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: '32px',
  };

  // Render table content
  const renderTableContent = () => (
    <table style={tableStyle}>
      <thead>
        <tr>
          {editingSchedule && <th style={{ ...thStyle, width: '30px' }}></th>}
          <th style={{ ...thStyle, width: '40px' }}>Nr.</th>
          {showReferees && <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>SR</th>}
          <th style={{ ...thStyle, width: '60px' }}>Zeit</th>
          <th style={{ ...thStyle, width: '100px' }}>Runde</th>
          <th style={thStyle}>Heim</th>
          <th style={{ ...thStyle, width: '80px', textAlign: 'center' }}>Ergebnis</th>
          <th style={thStyle}>Gast</th>
          {showFields && <th style={{ ...thStyle, width: '60px', textAlign: 'center' }}>Feld</th>}
        </tr>
      </thead>
      <tbody>
        {sortedMatches.map((match) => {
          const isRunning = runningMatchIds?.has(match.id);

          return (
            <SortableRow key={match.id} match={match}>
              {({ attributes, listeners, canDrag, isDragging }) => (
                <>
                  {editingSchedule && (
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: 'center',
                        width: '30px',
                        cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'default',
                        color: canDrag ? cssVars.colors.accent : cssVars.colors.textMuted,
                        touchAction: 'none',
                      }}
                      {...(canDrag ? { ...attributes, ...listeners } : {})}
                    >
                      {canDrag ? '⋮⋮' : '🔒'}
                    </td>
                  )}
                  <td style={{ ...tdStyle, fontWeight: cssVars.fontWeights.semibold }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm }}>
                      <span>{match.matchNumber}</span>
                      {isRunning && <LiveBadge compact />}
                    </div>
                  </td>
                  {showReferees && (() => {
                    const hasPendingRef = pendingChanges?.refereeAssignments[match.id] !== undefined;
                    const displayedRef = hasPendingRef ? pendingChanges.refereeAssignments[match.id] : match.referee;
                    const isPendingChange = hasPendingRef;
                    return (
                      <td style={{ ...tdStyle, textAlign: 'center', padding: editingSchedule ? cssVars.spacing.xs : cssVars.spacing.sm, backgroundColor: isPendingChange ? cssVars.colors.editorDragActiveBg : undefined }}>
                        {editingSchedule && onRefereeChange ? (
                          <select value={displayedRef ?? ''} onChange={(e) => onRefereeChange(match.id, e.target.value ? parseInt(e.target.value) : null)} style={{ width: '100%', padding: cssVars.spacing.xs, border: `1px solid ${isPendingChange ? cssVars.colors.primary : cssVars.colors.border}`, borderRadius: cssVars.borderRadius.sm, fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.semibold, textAlign: 'center', cursor: 'pointer', backgroundColor: cssVars.colors.background, color: cssVars.colors.textPrimary }}>
                            <option value="">-</option>
                            {refereeOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                          </select>
                        ) : (<span style={{ fontWeight: cssVars.fontWeights.semibold }}>{displayedRef ?? '-'}</span>)}
                      </td>
                    );
                  })()}
                  <td style={{
                    ...tdStyle,
                    color: isDragging ? cssVars.colors.textMuted : undefined,
                    fontStyle: isDragging ? 'italic' : undefined,
                  }}>
                    {isDragging ? '↕️' : match.time}
                  </td>
                  <td style={{ ...tdStyle, ...matchLabelCellStyle }}>{getFinalMatchLabel(match)}</td>
                  <td style={{
                    ...teamCellStyle,
                    ...(isPlaceholderTeam(match.homeTeam) ? { color: cssVars.colors.textPlaceholder, fontStyle: 'italic' } : {})
                  }}>
                    {match.homeTeam}
                  </td>
                  <td style={resultCellStyle}>
                    <MatchScoreCell
                      matchId={match.id}
                      scoreA={match.scoreA}
                      scoreB={match.scoreB}
                      editable={editable && onScoreChange !== undefined}
                      isFinished={finishedMatches?.has(match.id) ?? false}
                      inCorrectionMode={correctionMatchId === match.id}
                      onScoreChange={(scoreA, scoreB) => onScoreChange?.(match.id, scoreA, scoreB)}
                      onStartCorrection={() => onStartCorrection?.(match.id)}
                    />
                  </td>
                  <td style={{
                    ...teamCellStyle,
                    ...(isPlaceholderTeam(match.awayTeam) ? { color: cssVars.colors.textPlaceholder, fontStyle: 'italic' } : {})
                  }}>
                    {match.awayTeam}
                  </td>
                  {showFields && (() => {
                    const hasPendingField = pendingChanges?.fieldAssignments[match.id] !== undefined;
                    const displayedField = hasPendingField ? pendingChanges.fieldAssignments[match.id] : match.field;
                    const isPendingChange = hasPendingField;
                    return (
                      <td style={{ ...tdStyle, textAlign: 'center', padding: editingSchedule ? cssVars.spacing.xs : cssVars.spacing.sm, backgroundColor: isPendingChange ? cssVars.colors.editorDragActiveBg : undefined }}>
                        {editingSchedule && onFieldChange ? (
                          <select value={displayedField || 1} onChange={(e) => { const fieldNum = parseInt(e.target.value); onFieldChange(match.id, fieldNum); }} style={{ width: '100%', padding: cssVars.spacing.xs, border: `1px solid ${isPendingChange ? cssVars.colors.primary : cssVars.colors.border}`, borderRadius: cssVars.borderRadius.sm, fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.semibold, textAlign: 'center', cursor: 'pointer', backgroundColor: cssVars.colors.background, color: cssVars.colors.textPrimary }}>
                            {fieldOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                          </select>
                        ) : (<span style={{ fontWeight: cssVars.fontWeights.semibold }}>{displayedField || '-'}</span>)}
                      </td>
                    );
                  })()}
                </>
              )}
            </SortableRow>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div style={containerStyle} className="final-stage-schedule">
      {showTitle && <h2 style={titleStyle}>Finalrunde</h2>}

      {/* Desktop Table View with DnD */}
      <div className="desktop-view" style={{ overflowX: 'auto' }}>
        {editingSchedule && onMatchSwap ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedMatches.map(m => m.id)}
              strategy={verticalListSortingStrategy}
            >
              {renderTableContent()}
            </SortableContext>

            {/* Drag Overlay - shows the dragged row as floating card */}
            <DragOverlay dropAnimation={null}>
              {activeMatch && (
                <div style={{
                  backgroundColor: cssVars.colors.surface,
                  boxShadow: shadowSemantics.dialog,
                  borderRadius: cssVars.borderRadius.md,
                  border: `3px solid ${cssVars.colors.accent}`,
                  padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: cssVars.spacing.md,
                  minWidth: '400px',
                  cursor: 'grabbing',
                }}>
                  <span style={{ color: cssVars.colors.accent, fontSize: cssVars.fontSizes.xl }}>⋮⋮</span>
                  <span style={{ fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.accent }}>
                    #{activeMatch.matchNumber}
                  </span>
                  <span style={{
                    backgroundColor: cssVars.colors.accent,
                    color: cssVars.colors.background,
                    padding: `2px ${cssVars.spacing.sm}`,
                    borderRadius: cssVars.borderRadius.sm,
                    fontSize: cssVars.fontSizes.xs,
                    fontWeight: cssVars.fontWeights.semibold,
                  }}>
                    {getFinalMatchLabel(activeMatch)}
                  </span>
                  <span style={{ color: cssVars.colors.textSecondary }}>{activeMatch.time}</span>
                  <span style={{ fontWeight: cssVars.fontWeights.semibold, flex: 1 }}>
                    {activeMatch.homeTeam} <span style={{ color: cssVars.colors.textMuted }}>vs</span> {activeMatch.awayTeam}
                  </span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : (
          renderTableContent()
        )}
      </div>

      {/* Mobile Card View - Compact Design */}
      <div className="mobile-view">
        {sortedMatches.map((match) => {
          const isRunning = runningMatchIds?.has(match.id);
          const isFinished = finishedMatches?.has(match.id) ?? false;
          const hasResult = match.scoreA !== undefined && match.scoreB !== undefined;
          const homeIsPlaceholder = isPlaceholderTeam(match.homeTeam);
          const awayIsPlaceholder = isPlaceholderTeam(match.awayTeam);

          // Determine winner/loser
          const homeWins = hasResult && (match.scoreA ?? 0) > (match.scoreB ?? 0);
          const awayWins = hasResult && (match.scoreB ?? 0) > (match.scoreA ?? 0);
          const isDraw = hasResult && match.scoreA === match.scoreB;

          // Get pending changes
          const hasPendingRef = pendingChanges?.refereeAssignments[match.id] !== undefined;
          const displayedRef = hasPendingRef
            ? pendingChanges.refereeAssignments[match.id]
            : match.referee;
          const hasPendingField = pendingChanges?.fieldAssignments[match.id] !== undefined;
          const displayedField = hasPendingField
            ? pendingChanges.fieldAssignments[match.id]
            : match.field;

          // Is this match editable for score input?
          const canEditScore = editable && onScoreChange !== undefined && !isFinished;
          const inCorrectionMode = correctionMatchId === match.id;

          return (
            <div
              key={match.id}
              style={{
                ...mobileCardStyle,
                ...(isRunning ? {
                  borderColor: cssVars.colors.statusLive,
                  backgroundColor: cssVars.colors.statusLiveRowBg,
                } : {}),
              }}
            >
              {/* Compact Header: #Nr • Zeit | Meta Info */}
              <div style={mobileCardHeaderStyle}>
                <div style={mobileMatchInfoStyle}>
                  <span style={mobileMatchNumberStyle}>#{match.matchNumber}</span>
                  <span>•</span>
                  <span>{match.time}</span>
                  {isRunning && <LiveBadge compact />}
                </div>
                <div style={mobileMetaCompactStyle}>
                  {showReferees && displayedRef && (
                    <span style={hasPendingRef ? { color: cssVars.colors.primary } : undefined}>
                      SR:{displayedRef}
                    </span>
                  )}
                  {showFields && displayedField && displayedField > 1 && (
                    <span style={hasPendingField ? { color: cssVars.colors.primary } : undefined}>
                      F:{displayedField}
                    </span>
                  )}
                </div>
              </div>

              {/* Final Match Label */}
              <div style={mobileLabelStyle}>{getFinalMatchLabel(match)}</div>

              {/* Team Row: Home Team with Score */}
              <div style={getMobileTeamRowStyle(homeWins, awayWins && !isDraw, hasResult, homeIsPlaceholder)}>
                <div style={mobileTeamNameStyle}>
                  {homeWins && <span style={mobileWinnerIconStyle}>✓</span>}
                  <span style={{
                    // MOBILE-UX: No truncation - team names must be fully visible
                    wordBreak: 'break-word' as const,
                    overflowWrap: 'break-word' as const
                  }}>
                    {match.homeTeam}
                  </span>
                </div>
                {canEditScore || inCorrectionMode ? (
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={match.scoreA ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== '' && match.scoreB !== undefined) {
                        onScoreChange?.(match.id, parseInt(val), match.scoreB);
                      }
                    }}
                    placeholder="–"
                    style={{
                      ...mobileScoreInputStyle,
                      ...(inCorrectionMode ? {
                        borderColor: cssVars.colors.warning,
                        backgroundColor: cssVars.colors.warningLight,
                      } : {}),
                    }}
                  />
                ) : (
                  <span style={mobileScoreStyle(homeWins)}>
                    {match.scoreA ?? '–'}
                  </span>
                )}
              </div>

              {/* Team Row: Away Team with Score */}
              <div style={getMobileTeamRowStyle(awayWins, homeWins && !isDraw, hasResult, awayIsPlaceholder)}>
                <div style={mobileTeamNameStyle}>
                  {awayWins && <span style={mobileWinnerIconStyle}>✓</span>}
                  <span style={{
                    // MOBILE-UX: No truncation - team names must be fully visible
                    wordBreak: 'break-word' as const,
                    overflowWrap: 'break-word' as const
                  }}>
                    {match.awayTeam}
                  </span>
                </div>
                {canEditScore || inCorrectionMode ? (
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={match.scoreB ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (match.scoreA !== undefined && val !== '') {
                        onScoreChange?.(match.id, match.scoreA, parseInt(val));
                      }
                    }}
                    placeholder="–"
                    style={{
                      ...mobileScoreInputStyle,
                      ...(inCorrectionMode ? {
                        borderColor: cssVars.colors.warning,
                        backgroundColor: cssVars.colors.warningLight,
                      } : {}),
                    }}
                  />
                ) : (
                  <span style={mobileScoreStyle(awayWins)}>
                    {match.scoreB ?? '–'}
                  </span>
                )}
              </div>

              {/* Correction button for finished matches */}
              {isFinished && !inCorrectionMode && (
                <button
                  onClick={() => onStartCorrection?.(match.id)}
                  style={{
                    marginTop: cssVars.spacing.xs,
                    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
                    fontSize: cssVars.fontSizes.xs,
                    color: cssVars.colors.textSecondary,
                    backgroundColor: 'transparent',
                    border: `1px solid ${cssVars.colors.border}`,
                    borderRadius: cssVars.borderRadius.sm,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                  className="correction-btn-mobile"
                >
                  Korrigieren
                </button>
              )}

              {/* Edit mode: Referee & Field selectors */}
              {editingSchedule && (showReferees || showFields) && (
                <div style={{
                  display: 'flex',
                  gap: cssVars.spacing.sm,
                  marginTop: cssVars.spacing.xs,
                  paddingTop: cssVars.spacing.xs,
                  borderTop: `1px solid ${cssVars.colors.border}`,
                }}>
                  {showReferees && onRefereeChange && (
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textMuted }}>SR</label>
                      <select
                        value={displayedRef ?? ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          onRefereeChange(match.id, value ? parseInt(value) : null);
                        }}
                        style={{
                          ...mobileSelectStyle,
                          width: '100%',
                          border: `1px solid ${hasPendingRef ? cssVars.colors.primary : cssVars.colors.border}`,
                        }}
                      >
                        <option value="">-</option>
                        {refereeOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {showFields && onFieldChange && (
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textMuted }}>Feld</label>
                      <select
                        value={displayedField || 1}
                        onChange={(e) => onFieldChange(match.id, parseInt(e.target.value))}
                        style={{
                          ...mobileSelectStyle,
                          width: '100%',
                          border: `1px solid ${hasPendingField ? cssVars.colors.primary : cssVars.colors.border}`,
                        }}
                      >
                        {fieldOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .final-stage-schedule .mobile-view { display: none; }
        ${mediaQueries.tabletDown} {
          .final-stage-schedule .desktop-view { display: none; }
          .final-stage-schedule .mobile-view { display: block; }
        }
        /* Mobile correction button hover/active */
        .final-stage-schedule .correction-btn-mobile:hover,
        .final-stage-schedule .correction-btn-mobile:active {
          background: ${cssVars.colors.accent} !important;
          color: white !important;
          border-color: ${cssVars.colors.accent} !important;
        }
        @media (min-width: 768px) and (max-width: 1024px) {
          .final-stage-schedule table { font-size: 12px; }
          .final-stage-schedule th, .final-stage-schedule td { padding: 8px 6px; }
        }
        @media print {
          .final-stage-schedule { break-inside: avoid; }
          .final-stage-schedule .mobile-view { display: none !important; }
          .final-stage-schedule .desktop-view { display: block !important; }
          .final-stage-schedule table { min-width: 100%; }
        }
      `}</style>
    </div>
  );
};

/**
 * Check if a team name is an unresolved placeholder
 * Examples: "TBD", "1. Gruppe A", "Sieger HF1", "group-a-1st"
 */
function isPlaceholderTeam(teamName: string): boolean {
  if (!teamName) { return false; }
  const placeholderPatterns = [
    /^TBD$/i,
    /^\d+\.\s*(Gruppe|Group)/i,  // "1. Gruppe A"
    /^(Sieger|Verlierer|Winner|Loser)/i,  // "Sieger HF1"
    /group-[a-z]-\d+(st|nd|rd|th)/i,  // "group-a-1st"
    /-winner$/i,  // "semi1-winner"
    /-loser$/i,  // "semi1-loser"
    /^bestSecond$/i,
  ];
  return placeholderPatterns.some(pattern => pattern.test(teamName));
}

function getFinalMatchLabel(match: ScheduledMatch): string {
  if (match.finalType === 'final') { return 'Finale'; }
  if (match.finalType === 'thirdPlace') { return 'Spiel um Platz 3'; }
  if (match.finalType === 'fifthSixth') { return 'Spiel um Platz 5'; }
  if (match.finalType === 'seventhEighth') { return 'Spiel um Platz 7'; }
  if (match.phase === 'semifinal') { return 'Halbfinale'; }
  if (match.phase === 'quarterfinal') { return 'Viertelfinale'; }
  if (match.label?.includes('Halbfinale')) { return match.label; }
  return 'Finalspiel';
}
