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
import { colors, fontWeights, borderRadius } from '../../design-tokens';
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
    if (!over || active.id === over.id) return;

    const sourceMatchId = active.id as string;
    const targetMatchId = over.id as string;

    // Immediately update visual order using arrayMove
    setDisplayOrder(prevOrder => {
      const oldIndex = prevOrder.indexOf(sourceMatchId);
      const newIndex = prevOrder.indexOf(targetMatchId);
      if (oldIndex === -1 || newIndex === -1) return prevOrder;
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
        backgroundColor: 'rgba(255, 152, 0, 0.1)',
        outline: `2px dashed ${colors.accent}`,
        outlineOffset: '-1px',
        zIndex: 0,
      } : {}),
      // When another row is dragged OVER this one: highlight as drop target
      ...(isOver && !isDragging ? {
        backgroundColor: 'rgba(255, 152, 0, 0.25)',
        outline: `3px solid ${colors.accent}`,
        outlineOffset: '-1px',
        boxShadow: `0 0 12px rgba(255, 152, 0, 0.4)`,
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

  const containerStyle: CSSProperties = { marginBottom: '24px' };
  const titleStyle: CSSProperties = {
    fontSize: '18px',
    fontWeight: fontWeights.bold,
    color: colors.accent,
    marginBottom: '16px',
  };
  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    minWidth: '600px',
  };
  const thStyle: CSSProperties = {
    background: colors.accent,
    color: colors.background,
    padding: '10px 8px',
    textAlign: 'left',
    fontWeight: fontWeights.semibold,
    borderBottom: `2px solid ${colors.border}`,
  };
  const tdStyle: CSSProperties = {
    padding: '8px',
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
    fontSize: '11px',
    fontWeight: fontWeights.semibold,
    color: colors.accent,
    whiteSpace: 'nowrap',
  };

  // Team cell style (matching GroupStageSchedule)
  const teamCellStyle: CSSProperties = {
    ...tdStyle,
    fontWeight: fontWeights.medium,
  };

  // Mobile card styles
  const mobileCardStyle: CSSProperties = {
    backgroundColor: colors.background,
    border: `2px solid ${colors.accent}`,
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '12px',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
  };
  const mobileCardHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: `2px solid ${colors.accent}`,
  };
  const mobileMatchNumberStyle: CSSProperties = {
    fontSize: '16px',
    fontWeight: fontWeights.bold,
    color: colors.accent,
  };
  const mobileTimeStyle: CSSProperties = {
    fontSize: '14px',
    color: colors.textSecondary,
  };
  const mobileLabelStyle: CSSProperties = {
    fontSize: '16px',
    fontWeight: fontWeights.bold,
    color: colors.accent,
    marginBottom: '12px',
    textAlign: 'center',
  };
  const mobileTeamsContainerStyle: CSSProperties = { marginBottom: '12px' };
  const mobileTeamStyle: CSSProperties = {
    fontSize: '15px',
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    marginBottom: '8px',
  };
  const mobileScoreContainerStyle: CSSProperties = {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px',
    backgroundColor: colors.surfaceDark,
    borderRadius: '6px',
    marginBottom: '12px',
  };
  const mobileMetaStyle: CSSProperties = {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    fontSize: '13px',
    color: colors.textSecondary,
  };
  const mobileMetaItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };
  const mobileSelectStyle: CSSProperties = {
    padding: '8px 12px',
    border: `1px solid ${colors.border}`,
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: fontWeights.semibold,
    cursor: 'pointer',
    backgroundColor: colors.background,
    color: colors.textPrimary,
    minHeight: '44px',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{match.matchNumber}</span>
                  {isRunning && <LiveBadge compact />}
                </div>
              </td>
                {showReferees && (() => {
                  const hasPendingRef = pendingChanges?.refereeAssignments[match.id] !== undefined;
                  const displayedRef = hasPendingRef ? pendingChanges?.refereeAssignments[match.id] : match.referee;
                  const isPendingChange = hasPendingRef;
                  return (
                  <td style={{ ...tdStyle, textAlign: 'center', padding: editingSchedule ? '4px' : '8px', backgroundColor: isPendingChange ? 'rgba(0, 176, 255, 0.1)' : undefined }}>
                    {editingSchedule && onRefereeChange ? (
                      <select value={displayedRef ?? ''} onChange={(e) => onRefereeChange(match.id, e.target.value ? parseInt(e.target.value) : null)} style={{ width: '100%', padding: '4px', border: `1px solid ${isPendingChange ? colors.primary : colors.border}`, borderRadius: '4px', fontSize: '12px', fontWeight: fontWeights.semibold, textAlign: 'center', cursor: 'pointer', backgroundColor: colors.background, color: colors.textPrimary }}>
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
                  const displayedField = hasPendingField ? pendingChanges?.fieldAssignments[match.id] : match.field;
                  const isPendingChange = hasPendingField;
                  return (
                  <td style={{ ...tdStyle, textAlign: 'center', padding: editingSchedule ? '4px' : '8px', backgroundColor: isPendingChange ? 'rgba(0, 176, 255, 0.1)' : undefined }}>
                    {editingSchedule && onFieldChange ? (
                      <select value={displayedField || 1} onChange={(e) => { const fieldNum = parseInt(e.target.value); onFieldChange(match.id, fieldNum); }} style={{ width: '100%', padding: '4px', border: `1px solid ${isPendingChange ? colors.primary : colors.border}`, borderRadius: '4px', fontSize: '12px', fontWeight: fontWeights.semibold, textAlign: 'center', cursor: 'pointer', backgroundColor: colors.background, color: colors.textPrimary }}>
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
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                  borderRadius: borderRadius.md,
                  border: `3px solid ${colors.accent}`,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  minWidth: '400px',
                  cursor: 'grabbing',
                }}>
                  <span style={{ color: colors.accent, fontSize: '18px' }}>⋮⋮</span>
                  <span style={{ fontWeight: fontWeights.bold, color: colors.accent }}>
                    #{activeMatch.matchNumber}
                  </span>
                  <span style={{
                    backgroundColor: colors.accent,
                    color: colors.background,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
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

      <div className="mobile-view">
        {sortedMatches.map((match) => {
          const isRunning = runningMatchIds?.has(match.id);
          return (
          <div key={match.id} style={mobileCardStyle}>
            <div style={mobileCardHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={mobileMatchNumberStyle}>Spiel #{match.matchNumber}</span>
                {isRunning && <LiveBadge compact />}
              </div>
              <span style={mobileTimeStyle}>{match.time}</span>
            </div>
            <div style={mobileLabelStyle}>{getFinalMatchLabel(match)}</div>
            <div style={mobileTeamsContainerStyle}>
              <div style={{
                ...mobileTeamStyle,
                ...(isPlaceholderTeam(match.homeTeam) ? { color: colors.textPlaceholder, fontStyle: 'italic' } : {})
              }}>{match.homeTeam}</div>
              <div style={{
                ...mobileTeamStyle,
                ...(isPlaceholderTeam(match.awayTeam) ? { color: colors.textPlaceholder, fontStyle: 'italic' } : {})
              }}>{match.awayTeam}</div>
            </div>
            <div style={mobileScoreContainerStyle}>
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
            </div>
            <div style={mobileMetaStyle}>
              {showReferees && (() => {
                const hasPendingRef = pendingChanges?.refereeAssignments[match.id] !== undefined;
                const displayedRef = hasPendingRef ? pendingChanges?.refereeAssignments[match.id] : match.referee;
                const isPendingChange = hasPendingRef;
                return (
                <div style={{ ...mobileMetaItemStyle, backgroundColor: isPendingChange ? 'rgba(0, 176, 255, 0.1)' : undefined, padding: isPendingChange ? '4px 8px' : undefined, borderRadius: isPendingChange ? '4px' : undefined }}>
                  <strong>SR:</strong>
                  {editingSchedule && onRefereeChange ? (
                    <select value={displayedRef ?? ''} onChange={(e) => onRefereeChange(match.id, e.target.value ? parseInt(e.target.value) : null)} style={{ ...mobileSelectStyle, border: `1px solid ${isPendingChange ? colors.primary : colors.border}` }}>
                      <option value="">-</option>
                      {refereeOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                    </select>
                  ) : (<span>{displayedRef ?? '-'}</span>)}
                </div>
                );
              })()}
              {showFields && (() => {
                const hasPendingField = pendingChanges?.fieldAssignments[match.id] !== undefined;
                const displayedField = hasPendingField ? pendingChanges?.fieldAssignments[match.id] : match.field;
                const isPendingChange = hasPendingField;
                return (
                <div style={{ ...mobileMetaItemStyle, backgroundColor: isPendingChange ? 'rgba(0, 176, 255, 0.1)' : undefined, padding: isPendingChange ? '4px 8px' : undefined, borderRadius: isPendingChange ? '4px' : undefined }}>
                  <strong>Feld:</strong>
                  {editingSchedule && onFieldChange ? (
                    <select value={displayedField || 1} onChange={(e) => { const fieldNum = parseInt(e.target.value); onFieldChange(match.id, fieldNum); }} style={{ ...mobileSelectStyle, border: `1px solid ${isPendingChange ? colors.primary : colors.border}` }}>
                      {fieldOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                    </select>
                  ) : (<span>{displayedField || '-'}</span>)}
                </div>
                );
              })()}
            </div>
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
