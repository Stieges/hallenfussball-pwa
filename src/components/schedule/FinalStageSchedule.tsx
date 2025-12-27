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
import { colors, fontSizes, fontWeights, borderRadius, spacing, shadowSemantics } from '../../design-tokens';
import { ScheduledMatch } from '../../lib/scheduleGenerator';
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
      ...(isRunning ? { backgroundColor: colors.statusLiveRowBg } : {}),
      ...(editingSchedule && canDrag ? {
        outline: `2px solid ${colors.accent}`,
        outlineOffset: '-1px',
      } : {}),
      // When THIS row is being dragged: show as placeholder
      ...(isDragging ? {
        opacity: 0.4,
        backgroundColor: colors.editorSwapBg,
        outline: `2px dashed ${colors.accent}`,
        outlineOffset: '-1px',
        zIndex: 0,
      } : {}),
      // When another row is dragged OVER this one: highlight as drop target
      ...(isOver && !isDragging ? {
        backgroundColor: colors.editorSwapActive,
        outline: `3px solid ${colors.accent}`,
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
        padding: `${spacing.xl} ${spacing.lg}`,
        color: colors.textSecondary,
        fontSize: fontSizes.md
      }}>
        Keine Spiele vorhanden
      </div>
    );
  }

  const showReferees = refereeConfig && refereeConfig.mode !== 'none';
  const showFields = numberOfFields > 1;

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

  const getFieldOptions = () => {
    const options = [];
    for (let i = 1; i <= numberOfFields; i++) {
      options.push({ value: i, label: i.toString() });
    }
    return options;
  };

  const refereeOptions = getRefereeOptions();
  const fieldOptions = getFieldOptions();

  const containerStyle: CSSProperties = { marginBottom: spacing.lg };
  const titleStyle: CSSProperties = {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.accent,
    marginBottom: spacing.md,
  };
  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: fontSizes.sm,
    minWidth: '600px',
  };
  const thStyle: CSSProperties = {
    background: colors.accent,
    color: colors.background,
    padding: `10px ${spacing.sm}`,
    textAlign: 'left',
    fontWeight: fontWeights.semibold,
    borderBottom: `2px solid ${colors.border}`,
  };
  const tdStyle: CSSProperties = {
    padding: spacing.sm,
    borderBottom: `1px solid ${colors.border}`,
    color: colors.textPrimary,
  };
  const resultCellStyle: CSSProperties = {
    ...tdStyle,
    textAlign: 'center',
    fontWeight: fontWeights.bold,
    minWidth: '60px',
  };
  // Match label column style (compact for "Runde" column)
  const matchLabelCellStyle: CSSProperties = {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.accent,
    whiteSpace: 'nowrap',
  };

  // Team cell style (matching GroupStageSchedule)
  const teamCellStyle: CSSProperties = {
    ...tdStyle,
    fontWeight: fontWeights.medium,
  };

  // Mobile Card Styles - Compact Design (matching GroupStageSchedule)
  const mobileCardStyle: CSSProperties = {
    backgroundColor: colors.background,
    border: `2px solid ${colors.accent}`,
    borderRadius: borderRadius.md,
    padding: `10px ${spacing.sm}`,
    marginBottom: spacing.sm,
  };

  const mobileCardHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    fontSize: fontSizes.sm,
  };

  const mobileMatchInfoStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    color: colors.textSecondary,
  };

  const mobileMatchNumberStyle: CSSProperties = {
    fontWeight: fontWeights.bold,
    color: colors.accent,
  };

  const mobileLabelStyle: CSSProperties = {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.accent,
    marginBottom: spacing.xs,
    textAlign: 'center' as const,
    backgroundColor: `${colors.accent}20`,
    padding: '2px 8px',
    borderRadius: borderRadius.sm,
  };

  const mobileMetaCompactStyle: CSSProperties = {
    display: 'flex',
    gap: spacing.sm,
    color: colors.textMuted,
    fontSize: fontSizes.xs,
  };

  // Team row with inline score - compact layout
  const getMobileTeamRowStyle = (isWinner: boolean, isLoser: boolean, hasResult: boolean, isPlaceholder: boolean): CSSProperties => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
    fontSize: fontSizes.md,
    fontWeight: isWinner ? fontWeights.bold : fontWeights.normal,
    color: isPlaceholder
      ? colors.textPlaceholder
      : hasResult
        ? (isLoser ? colors.textMuted : colors.textPrimary)
        : colors.textPrimary,
    fontStyle: isPlaceholder ? 'italic' : 'normal',
  });

  const mobileTeamNameStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  };

  const mobileScoreStyle = (isWinner: boolean): CSSProperties => ({
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.lg,
    minWidth: '24px',
    textAlign: 'right' as const,
    color: isWinner ? colors.success : colors.textPrimary,
  });

  const mobileWinnerIconStyle: CSSProperties = {
    color: colors.success,
    fontSize: fontSizes.sm,
    flexShrink: 0,
  };

  const mobileScoreInputStyle: CSSProperties = {
    width: '36px',
    padding: spacing.xs,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.sm,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    textAlign: 'center' as const,
    backgroundColor: colors.background,
    color: colors.textPrimary,
  };

  const mobileSelectStyle: CSSProperties = {
    padding: `${spacing.xs} ${spacing.sm}`,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.sm,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    cursor: 'pointer',
    backgroundColor: colors.background,
    color: colors.textPrimary,
    minHeight: '32px',
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
                    color: canDrag ? colors.accent : colors.textMuted,
                    touchAction: 'none',
                  }}
                  {...(canDrag ? { ...attributes, ...listeners } : {})}
                >
                  {canDrag ? '⋮⋮' : '🔒'}
                </td>
              )}
              <td style={{ ...tdStyle, fontWeight: fontWeights.semibold }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  <span>{match.matchNumber}</span>
                  {isRunning && <LiveBadge compact />}
                </div>
              </td>
                {showReferees && (() => {
                  const hasPendingRef = pendingChanges?.refereeAssignments[match.id] !== undefined;
                  const displayedRef = hasPendingRef ? pendingChanges.refereeAssignments[match.id] : match.referee;
                  const isPendingChange = hasPendingRef;
                  return (
                  <td style={{ ...tdStyle, textAlign: 'center', padding: editingSchedule ? spacing.xs : spacing.sm, backgroundColor: isPendingChange ? colors.editorDragActiveBg : undefined }}>
                    {editingSchedule && onRefereeChange ? (
                      <select value={displayedRef ?? ''} onChange={(e) => onRefereeChange(match.id, e.target.value ? parseInt(e.target.value) : null)} style={{ width: '100%', padding: spacing.xs, border: `1px solid ${isPendingChange ? colors.primary : colors.border}`, borderRadius: borderRadius.sm, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, textAlign: 'center', cursor: 'pointer', backgroundColor: colors.background, color: colors.textPrimary }}>
                        <option value="">-</option>
                        {refereeOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                      </select>
                    ) : (<span style={{ fontWeight: fontWeights.semibold }}>{displayedRef ?? '-'}</span>)}
                  </td>
                  );
                })()}
                <td style={{
                  ...tdStyle,
                  color: isDragging ? colors.textMuted : undefined,
                  fontStyle: isDragging ? 'italic' : undefined,
                }}>
                  {isDragging ? '↕️' : match.time}
                </td>
                <td style={{ ...tdStyle, ...matchLabelCellStyle }}>{getFinalMatchLabel(match)}</td>
                <td style={{
                  ...teamCellStyle,
                  ...(isPlaceholderTeam(match.homeTeam) ? { color: colors.textPlaceholder, fontStyle: 'italic' } : {})
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
                  ...(isPlaceholderTeam(match.awayTeam) ? { color: colors.textPlaceholder, fontStyle: 'italic' } : {})
                }}>
                  {match.awayTeam}
                </td>
                {showFields && (() => {
                  const hasPendingField = pendingChanges?.fieldAssignments[match.id] !== undefined;
                  const displayedField = hasPendingField ? pendingChanges.fieldAssignments[match.id] : match.field;
                  const isPendingChange = hasPendingField;
                  return (
                  <td style={{ ...tdStyle, textAlign: 'center', padding: editingSchedule ? spacing.xs : spacing.sm, backgroundColor: isPendingChange ? colors.editorDragActiveBg : undefined }}>
                    {editingSchedule && onFieldChange ? (
                      <select value={displayedField || 1} onChange={(e) => { const fieldNum = parseInt(e.target.value); onFieldChange(match.id, fieldNum); }} style={{ width: '100%', padding: spacing.xs, border: `1px solid ${isPendingChange ? colors.primary : colors.border}`, borderRadius: borderRadius.sm, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, textAlign: 'center', cursor: 'pointer', backgroundColor: colors.background, color: colors.textPrimary }}>
                        {fieldOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                      </select>
                    ) : (<span style={{ fontWeight: fontWeights.semibold }}>{displayedField || '-'}</span>)}
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
      <h2 style={titleStyle}>Finalrunde</h2>

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
                  backgroundColor: colors.surface,
                  boxShadow: shadowSemantics.dialog,
                  borderRadius: borderRadius.md,
                  border: `3px solid ${colors.accent}`,
                  padding: `${spacing.sm} ${spacing.md}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.md,
                  minWidth: '400px',
                  cursor: 'grabbing',
                }}>
                  <span style={{ color: colors.accent, fontSize: fontSizes.xl }}>⋮⋮</span>
                  <span style={{ fontWeight: fontWeights.bold, color: colors.accent }}>
                    #{activeMatch.matchNumber}
                  </span>
                  <span style={{
                    backgroundColor: colors.accent,
                    color: colors.background,
                    padding: `2px ${spacing.sm}`,
                    borderRadius: borderRadius.sm,
                    fontSize: fontSizes.xs,
                    fontWeight: fontWeights.semibold,
                  }}>
                    {getFinalMatchLabel(activeMatch)}
                  </span>
                  <span style={{ color: colors.textSecondary }}>{activeMatch.time}</span>
                  <span style={{ fontWeight: fontWeights.semibold, flex: 1 }}>
                    {activeMatch.homeTeam} <span style={{ color: colors.textMuted }}>vs</span> {activeMatch.awayTeam}
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
                borderColor: colors.statusLive,
                backgroundColor: colors.statusLiveRowBg,
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
                  <span style={hasPendingRef ? { color: colors.primary } : undefined}>
                    SR:{displayedRef}
                  </span>
                )}
                {showFields && displayedField && displayedField > 1 && (
                  <span style={hasPendingField ? { color: colors.primary } : undefined}>
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
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap' as const
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
                      borderColor: colors.warning,
                      backgroundColor: colors.warningLight,
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
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap' as const
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
                      borderColor: colors.warning,
                      backgroundColor: colors.warningLight,
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
                  marginTop: spacing.xs,
                  padding: `${spacing.xs} ${spacing.sm}`,
                  fontSize: fontSizes.xs,
                  color: colors.textSecondary,
                  backgroundColor: 'transparent',
                  border: `1px solid ${colors.border}`,
                  borderRadius: borderRadius.sm,
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
                gap: spacing.sm,
                marginTop: spacing.xs,
                paddingTop: spacing.xs,
                borderTop: `1px solid ${colors.border}`,
              }}>
                {showReferees && onRefereeChange && (
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: fontSizes.xs, color: colors.textMuted }}>SR</label>
                    <select
                      value={displayedRef ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        onRefereeChange(match.id, value ? parseInt(value) : null);
                      }}
                      style={{
                        ...mobileSelectStyle,
                        width: '100%',
                        border: `1px solid ${hasPendingRef ? colors.primary : colors.border}`,
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
                )}
              </div>
            )}
          </div>
          );
        })}
      </div>

      <style>{`
        .final-stage-schedule .mobile-view { display: none; }
        @media (max-width: 767px) {
          .final-stage-schedule .desktop-view { display: none; }
          .final-stage-schedule .mobile-view { display: block; }
        }
        /* Mobile correction button hover */
        .final-stage-schedule .correction-btn-mobile:hover {
          background: ${colors.accent} !important;
          color: white !important;
          border-color: ${colors.accent} !important;
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
  if (!teamName) {return false;}
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
  if (match.finalType === 'final') {return 'Finale';}
  if (match.finalType === 'thirdPlace') {return 'Spiel um Platz 3';}
  if (match.finalType === 'fifthSixth') {return 'Spiel um Platz 5';}
  if (match.finalType === 'seventhEighth') {return 'Spiel um Platz 7';}
  if (match.phase === 'semifinal') {return 'Halbfinale';}
  if (match.phase === 'quarterfinal') {return 'Viertelfinale';}
  if (match.label?.includes('Halbfinale')) {return match.label;}
  return 'Finalspiel';
}
