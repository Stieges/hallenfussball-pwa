/**
 * GroupStageSchedule - Displays group stage matches in MeinTurnierplan style
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
import { RefereeConfig, Tournament } from '../../types/tournament';
import { MatchScoreCell } from './MatchScoreCell';
import { LiveBadge } from './LiveBadge';
import { getGroupShortCode } from '../../utils/displayNames';

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
  editable = false,
  editingSchedule = false,
  pendingChanges,
  finishedMatches,
  correctionMatchId,
  onStartCorrection,
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
  }, [editingSchedule]); // Only trigger on editingSchedule change

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

    // Call the swap handler to persist change
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

  // Styles
  const containerStyle: CSSProperties = {
    marginBottom: '24px',
  };

  const titleStyle: CSSProperties = {
    fontSize: '18px',
    fontWeight: fontWeights.bold,
    color: colors.primary,
    marginBottom: '16px',
  };

  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    minWidth: '600px',
  };

  const thStyle: CSSProperties = {
    background: colors.primary,
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

  // Mobile Card Styles
  const mobileCardStyle: CSSProperties = {
    backgroundColor: colors.background,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '12px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  };

  const mobileCardHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: `1px solid ${colors.border}`,
  };

  const mobileMatchNumberStyle: CSSProperties = {
    fontSize: '16px',
    fontWeight: fontWeights.bold,
    color: colors.primary,
  };

  const mobileTimeStyle: CSSProperties = {
    fontSize: '14px',
    color: colors.textSecondary,
  };

  const mobileTeamsContainerStyle: CSSProperties = {
    marginBottom: '12px',
  };

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

  // Get active match for drag overlay
  const activeMatch = activeId ? sortedMatches.find(m => m.id === activeId) : null;

  // ============================================================================
  // SortableRow Component - uses useSortable for smooth animations
  // Drag listeners are only attached to the drag handle, not the entire row
  // ============================================================================
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

    // Can only drag scheduled matches (not running or finished)
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
        outline: `2px solid ${colors.primary}`,
        outlineOffset: '-1px',
      } : {}),
      // When THIS row is being dragged: show as placeholder
      ...(isDragging ? {
        opacity: 0.4,
        backgroundColor: 'rgba(0, 176, 255, 0.1)',
        outline: `2px dashed ${colors.primary}`,
        outlineOffset: '-1px',
        zIndex: 0,
      } : {}),
      // When another row is dragged OVER this one: highlight as drop target
      ...(isOver && !isDragging ? {
        backgroundColor: 'rgba(0, 176, 255, 0.25)',
        outline: `3px solid ${colors.primary}`,
        outlineOffset: '-1px',
        boxShadow: `0 0 12px rgba(0, 176, 255, 0.4)`,
      } : {}),
    };

    return (
      <tr ref={setNodeRef} style={style}>
        {children({ attributes, listeners, canDrag, isDragging })}
      </tr>
    );
  };

  // Render table content (used both in normal view and drag overlay)
  const renderTableContent = () => (
    <table style={tableStyle}>
      <thead>
        <tr>
          {editingSchedule && <th style={{ ...thStyle, width: '30px' }}></th>}
          <th style={{ ...thStyle, width: '40px' }}>Nr.</th>
          {showReferees && <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>SR</th>}
          <th style={{ ...thStyle, width: '60px' }}>Zeit</th>
          {hasGroups && <th style={{ ...thStyle, width: '40px' }}>Gr</th>}
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
                {/* Drag handle column - only in edit mode */}
                {editingSchedule && (
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: 'center',
                      width: '30px',
                      cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'default',
                      color: canDrag ? colors.primary : colors.textMuted,
                      touchAction: 'none', // Prevents scroll while dragging
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
                  // Get displayed value - pending change takes priority
                  const hasPendingRef = pendingChanges?.refereeAssignments[match.id] !== undefined;
                  const displayedRef = hasPendingRef
                    ? pendingChanges?.refereeAssignments[match.id]
                    : match.referee;
                  const isPendingChange = hasPendingRef;

                  return (
                  <td style={{
                    ...tdStyle,
                    textAlign: 'center',
                    padding: editingSchedule ? '4px' : '8px',
                    backgroundColor: isPendingChange ? 'rgba(0, 176, 255, 0.1)' : undefined,
                  }}>
                    {editingSchedule && onRefereeChange ? (
                      <select
                        value={displayedRef ?? ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          onRefereeChange(match.id, value ? parseInt(value) : null);
                        }}
                        style={{
                          width: '100%',
                          padding: '4px',
                          border: `1px solid ${isPendingChange ? colors.primary : colors.border}`,
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: fontWeights.semibold,
                          textAlign: 'center',
                          cursor: 'pointer',
                          backgroundColor: colors.background,
                          color: colors.textPrimary,
                        }}
                      >
                        <option value="">-</option>
                        {refereeOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ fontWeight: fontWeights.semibold }}>
                        {displayedRef ?? '-'}
                      </span>
                    )}
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
                {hasGroups && (
                  <td style={{ ...tdStyle, textAlign: 'center', fontWeight: fontWeights.semibold }}>
                    {match.group ? getGroupShortCode(match.group, tournament) : '-'}
                  </td>
                )}
                <td style={tdStyle}>{match.homeTeam}</td>
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
                <td style={tdStyle}>{match.awayTeam}</td>
                {showFields && (() => {
                  // Get displayed value - pending change takes priority
                  const hasPendingField = pendingChanges?.fieldAssignments[match.id] !== undefined;
                  const displayedField = hasPendingField
                    ? pendingChanges?.fieldAssignments[match.id]
                    : match.field;
                  const isPendingChange = hasPendingField;

                  return (
                  <td style={{
                    ...tdStyle,
                    textAlign: 'center',
                    padding: editingSchedule ? '4px' : '8px',
                    backgroundColor: isPendingChange ? 'rgba(0, 176, 255, 0.1)' : undefined,
                  }}>
                    {editingSchedule && onFieldChange ? (
                      <select
                        value={displayedField || 1}
                        onChange={(e) => {
                          const fieldNum = parseInt(e.target.value);
                          // In edit mode, no confirmation - conflicts are checked on save
                          onFieldChange(match.id, fieldNum);
                        }}
                        style={{
                          width: '100%',
                          padding: '4px',
                          border: `1px solid ${isPendingChange ? colors.primary : colors.border}`,
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: fontWeights.semibold,
                          textAlign: 'center',
                          cursor: 'pointer',
                          backgroundColor: colors.background,
                          color: colors.textPrimary,
                        }}
                      >
                        {fieldOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ fontWeight: fontWeights.semibold }}>
                        {displayedField || '-'}
                      </span>
                    )}
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
    <div style={containerStyle} className="group-stage-schedule">
      <h2 style={titleStyle}>
        {hasGroups ? 'Vorrunde' : 'Spielplan'}
      </h2>

      {/* Desktop Table View with DnD */}
      {editingSchedule && onMatchSwap ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="desktop-view" style={{ overflowX: 'auto' }}>
            <SortableContext
              items={sortedMatches.map(m => m.id)}
              strategy={verticalListSortingStrategy}
            >
              {renderTableContent()}
            </SortableContext>
          </div>

          {/* Drag Overlay - OUTSIDE scrollable container to prevent offset issues */}
          <DragOverlay dropAnimation={null}>
            {activeMatch && (
              <div style={{
                backgroundColor: colors.surface,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                borderRadius: borderRadius.md,
                border: `3px solid ${colors.primary}`,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                minWidth: '400px',
                maxWidth: '600px',
                cursor: 'grabbing',
                transform: 'translate(-50%, -50%)', // Center on cursor
              }}>
                <span style={{ color: colors.primary, fontSize: '18px' }}>⋮⋮</span>
                <span style={{ fontWeight: fontWeights.bold, color: colors.primary }}>
                  #{activeMatch.matchNumber}
                </span>
                <span style={{ color: colors.textSecondary }}>{activeMatch.time}</span>
                <span style={{ fontWeight: fontWeights.semibold, flex: 1 }}>
                  {activeMatch.homeTeam} <span style={{ color: colors.textMuted }}>vs</span> {activeMatch.awayTeam}
                </span>
                {hasGroups && (
                  <span style={{
                    backgroundColor: colors.primary,
                    color: colors.background,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
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
        <div className="desktop-view" style={{ overflowX: 'auto' }}>
          {renderTableContent()}
        </div>
      )}

      {/* Mobile Card View */}
      <div className="mobile-view">
        {sortedMatches.map((match) => {
          const isRunning = runningMatchIds?.has(match.id);
          return (
          <div key={match.id} style={mobileCardStyle}>
            {/* Header with match number and time */}
            <div style={mobileCardHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={mobileMatchNumberStyle}>Spiel #{match.matchNumber}</span>
                {isRunning && <LiveBadge compact />}
              </div>
              <span style={mobileTimeStyle}>{match.time}</span>
            </div>

            {/* Teams */}
            <div style={mobileTeamsContainerStyle}>
              <div style={mobileTeamStyle}>{match.homeTeam}</div>
              <div style={mobileTeamStyle}>{match.awayTeam}</div>
            </div>

            {/* Score Input */}
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

            {/* Meta information */}
            <div style={mobileMetaStyle}>
              {hasGroups && (
                <div style={mobileMetaItemStyle}>
                  <strong>Gruppe:</strong>
                  <span>{match.group ? getGroupShortCode(match.group, tournament) : '-'}</span>
                </div>
              )}
              {showReferees && (() => {
                const hasPendingRef = pendingChanges?.refereeAssignments[match.id] !== undefined;
                const displayedRef = hasPendingRef
                  ? pendingChanges?.refereeAssignments[match.id]
                  : match.referee;
                const isPendingChange = hasPendingRef;

                return (
                <div style={{
                  ...mobileMetaItemStyle,
                  backgroundColor: isPendingChange ? 'rgba(0, 176, 255, 0.1)' : undefined,
                  padding: isPendingChange ? '4px 8px' : undefined,
                  borderRadius: isPendingChange ? '4px' : undefined,
                }}>
                  <strong>SR:</strong>
                  {editingSchedule && onRefereeChange ? (
                    <select
                      value={displayedRef ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        onRefereeChange(match.id, value ? parseInt(value) : null);
                      }}
                      style={{
                        ...mobileSelectStyle,
                        border: `1px solid ${isPendingChange ? colors.primary : colors.border}`,
                      }}
                    >
                      <option value="">-</option>
                      {refereeOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{displayedRef ?? '-'}</span>
                  )}
                </div>
                );
              })()}
              {showFields && (() => {
                const hasPendingField = pendingChanges?.fieldAssignments[match.id] !== undefined;
                const displayedField = hasPendingField
                  ? pendingChanges?.fieldAssignments[match.id]
                  : match.field;
                const isPendingChange = hasPendingField;

                return (
                <div style={{
                  ...mobileMetaItemStyle,
                  backgroundColor: isPendingChange ? 'rgba(0, 176, 255, 0.1)' : undefined,
                  padding: isPendingChange ? '4px 8px' : undefined,
                  borderRadius: isPendingChange ? '4px' : undefined,
                }}>
                  <strong>Feld:</strong>
                  {editingSchedule && onFieldChange ? (
                    <select
                      value={displayedField || 1}
                      onChange={(e) => {
                        const fieldNum = parseInt(e.target.value);
                        // In edit mode, no confirmation - conflicts are checked on save
                        onFieldChange(match.id, fieldNum);
                      }}
                      style={{
                        ...mobileSelectStyle,
                        border: `1px solid ${isPendingChange ? colors.primary : colors.border}`,
                      }}
                    >
                      {fieldOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{displayedField || '-'}</span>
                  )}
                </div>
                );
              })()}
            </div>
          </div>
          );
        })}
      </div>

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
