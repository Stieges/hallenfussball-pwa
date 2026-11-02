/**
 * FinalStageSchedule - Displays playoff/final matches in MeinTurnierplan style
 * Fully responsive with table view for desktop and card view for mobile
 *
 * US-SCHEDULE-EDITOR: Now supports Drag & Drop for match swapping in edit mode
 */

import { CSSProperties, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cssVars, shadowSemantics, mediaQueries } from '../../design-tokens'
import { ScheduledMatch } from '../../core/generators';
import type { SpectatorClock } from '../../core/view';
import { RefereeConfig } from '../../types/tournament';
import type { ScoreCommitResult } from '../ui/molecules';
import { buildSideContext, matchViewOf, sideDisplay, sideName, type SideSource } from './matchSides';
import { finalMatchLabel } from './finalMatchLabel';
import { MatchScoreCell } from './MatchScoreCell';
import { FinalSortableRow } from './FinalSortableRow';
import { FinalStageMobileCard } from './FinalStageMobileCard';
import { MatchForfeitAction, type MatchForfeitActions } from './MatchForfeitAction';
import { cardStatusOf, resultFigures, type ResultFigures } from './matchResult';
import { MatchStatusBadge } from '../ui/molecules/MatchStatusBadge';
import { ShortLabel, Versus } from '../ui/atoms';
import { MatchMenuSlot, OriginalTimeNote } from './MatchTimeShiftSlots';
import { SCHEDULE_AUTO_SCROLL, useScheduleDrag } from './useScheduleDrag';
import { useRefereeChoices } from './refereeChoices';
import { SwapWithButton } from './SwapWithButton';

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
  onScoreChange?: (matchId: string, scoreA: number, scoreB: number) => ScoreCommitResult;
  editable?: boolean;
  /** Is the schedule currently being edited (edit mode active) */
  editingSchedule?: boolean;
  /** Pending changes during edit mode (not yet saved) */
  pendingChanges?: PendingChanges;
  correctionMatchId?: string | null;
  onStartCorrection?: (matchId: string) => void;
  /** Wer ein Spiel zuletzt geändert hat, für den Hinweis „inzwischen geändert“ der Schnelleingabe (@FU-104) */
  changeAuthorOf?: (matchId: string) => Promise<string | null>;
  clockOf?: (matchId: string) => SpectatorClock | null; // Restzeit laufender Spiele (@ZM-162)
  /** US-SCHEDULE-EDITOR: Callback when matches are swapped via DnD */
  onMatchSwap?: (matchId1: string, matchId2: string) => boolean;
  /** Whether to show the section title (default: true) */
  showTitle?: boolean;
  /** Teams, Gruppen, Spiele und die gemeinsame Ansicht (Status, Seiten, Endstand) */
  tournament?: SideSource;
  /** B-12: „Nicht angetreten“ / „Wertung zurücknehmen“ (nur Turnierleitung); ohne Angabe keine Taste */
  forfeit?: MatchForfeitActions;
  /** @FU-112/@FU-113: laufende Spiele beenden und eintragen darf nur die Turnierleitung; ohne Angabe nicht */
  canEndRunning?: boolean;
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
  correctionMatchId,
  onStartCorrection,
  changeAuthorOf,
  clockOf,
  onMatchSwap,
  showTitle = true,
  tournament,
  forfeit,
  canEndRunning = false,
}) => {
  const { t } = useTranslation('tournament');
  // Spielseiten: Namen immer aus der Ansicht (Slots, aktuelle Teams), nie aus gespeichertem Anzeigetext
  const sides = useMemo(() => buildSideContext(tournament, matches), [tournament, matches]);
  // Eine Statusquelle: die Ansicht (läuft ∨ unterbrochen = läuft; ohne Ansicht gilt jedes Spiel als geplant)
  const statusOf = (match: ScheduledMatch) => cardStatusOf(matchViewOf(sides, match.id));
  // Ziehen/Tauschen (@ZP-100): Liste nach Uhrzeit, Tausch über onMatchSwap (Entwurf)
  const { sensors, sortedMatches, activeMatch, handleDragStart, handleDragEnd, handleDragCancel } = useScheduleDrag(matches, onMatchSwap);
  // Schiedsrichter-Auswahl aus einer Quelle (Teams pfeifen: Teamnamen, @W3-011)
  const refereeChoiceList = useRefereeChoices(refereeConfig, tournament?.teams);

  if (matches.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: `${cssVars.spacing.xl} ${cssVars.spacing.lg}`,
        color: cssVars.colors.textSecondary,
        fontSize: cssVars.fontSizes.md
      }}>
        {t('finals.noMatches')}
      </div>
    );
  }

  const showReferees = refereeConfig && refereeConfig.mode !== 'none';
  const showFields = numberOfFields > 1;

  const getFieldOptions = () => {
    const options = [];
    for (let i = 1; i <= numberOfFields; i++) {
      options.push({ value: i, label: i.toString() });
    }
    return options;
  };

  const refereeOptions = refereeChoiceList;
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

  // Render table content
  const renderTableContent = () => (
    <table style={tableStyle}>
      <thead>
        <tr>
          {editingSchedule && <th style={{ ...thStyle, width: '30px' }}></th>}
          <th style={{ ...thStyle, width: '1%', whiteSpace: 'nowrap' }}><ShortLabel term="number" /></th>
          {showReferees && <th style={{ ...thStyle, width: '1%', whiteSpace: 'nowrap', textAlign: 'center' }}>{t('finals.columns.referee')}</th>}
          <th style={{ ...thStyle, width: '60px' }}>{t('finals.columns.time')}</th>
          <th style={{ ...thStyle, width: '100px' }}>{t('finals.columns.round')}</th>
          <th style={thStyle}>{t('finals.columns.home')}</th>
          <th style={{ ...thStyle, width: '80px', textAlign: 'center' }}>{t('finals.columns.result')}</th>
          <th style={thStyle}>{t('finals.columns.away')}</th>
          {showFields && <th style={{ ...thStyle, width: '60px', textAlign: 'center' }}>{t('finals.columns.field')}</th>}
        </tr>
      </thead>
      <tbody>
        {sortedMatches.map((match) => {
          const status = statusOf(match);
          const isRunning = status === 'running';
          const rowView = matchViewOf(sides, match.id);
          const result = resultFigures(rowView?.score, status);

          return (
            <FinalSortableRow
              key={match.id}
              matchId={match.id}
              isRunning={isRunning}
              isFinished={status === 'finished'}
              editingSchedule={editingSchedule}
              canSwap={onMatchSwap !== undefined}
            >
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
                      {rowView?.badge.kind === 'badge' && <MatchStatusBadge model={rowView.badge} size="row" testId={isRunning ? `final-row-live-${match.id}` : undefined} />}
                      {editingSchedule && <SwapWithButton matchId={match.id} locked={status === 'running' || status === 'finished'} />}
                    </div>
                  </td>
                  {showReferees && (() => {
                    const hasPendingRef = pendingChanges?.refereeAssignments[match.id] !== undefined;
                    const displayedRef = hasPendingRef ? pendingChanges.refereeAssignments[match.id] : match.referee;
                    const isPendingChange = hasPendingRef;
                    return (
                      <td style={{ ...tdStyle, textAlign: 'center', padding: editingSchedule ? cssVars.spacing.xs : cssVars.spacing.sm, backgroundColor: isPendingChange ? cssVars.colors.editorDragActiveBg : undefined }}>
                        {editingSchedule && onRefereeChange ? (
                          <select disabled={(status === 'running' || status === 'finished')} value={displayedRef ?? ''} onChange={(e) => onRefereeChange(match.id, e.target.value ? parseInt(e.target.value) : null)} style={{ width: '100%', padding: cssVars.spacing.xs, border: `1px solid ${isPendingChange ? cssVars.colors.primary : cssVars.colors.borderControl}`, borderRadius: cssVars.borderRadius.sm, fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.semibold, textAlign: 'center', cursor: 'pointer', backgroundColor: cssVars.colors.background, color: cssVars.colors.textPrimary }}>
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
                    {!isDragging && <OriginalTimeNote matchId={match.id} />}
                    {!isDragging && !editingSchedule && <MatchMenuSlot matchId={match.id} />}
                  </td>
                  <td style={{ ...tdStyle, ...matchLabelCellStyle }}>{finalMatchLabel(match, sides, t)}</td>
                  <td style={{
                    ...teamCellStyle,
                    ...winnerCellStyle(result, 'a'),
                    ...(sideDisplay(match, 'A', sides).pending ? { color: cssVars.colors.textPlaceholder, fontStyle: 'italic' } : {})
                  }}>
                    {sideName(match, 'A', sides)}
                  </td>
                  <td style={resultCellStyle}>
                    <MatchScoreCell
                      matchId={match.id}
                      scoreA={match.scoreA}
                      scoreB={match.scoreB}
                      editable={editable && onScoreChange !== undefined && (!isRunning || canEndRunning)}
                      isFinished={status === 'finished'}
                      isRunning={isRunning}
                      result={result}
                      viewStatus={matchViewOf(sides, match.id)?.status}
                      inCorrectionMode={correctionMatchId === match.id}
                      nameA={sideName(match, 'A', sides)}
                      nameB={sideName(match, 'B', sides)}
                      onScoreChange={(scoreA, scoreB) => onScoreChange?.(match.id, scoreA, scoreB)}
                      onStartCorrection={onStartCorrection ? () => onStartCorrection(match.id) : undefined}
                      changeAuthorOf={changeAuthorOf}
                    />
                    <MatchForfeitAction matchId={match.id} viewStatus={rowView?.status} forfeit={forfeit} />
                  </td>
                  <td style={{
                    ...teamCellStyle,
                    ...winnerCellStyle(result, 'b'),
                    ...(sideDisplay(match, 'B', sides).pending ? { color: cssVars.colors.textPlaceholder, fontStyle: 'italic' } : {})
                  }}>
                    {sideName(match, 'B', sides)}
                  </td>
                  {showFields && (() => {
                    const hasPendingField = pendingChanges?.fieldAssignments[match.id] !== undefined;
                    const displayedField = hasPendingField ? pendingChanges.fieldAssignments[match.id] : match.field;
                    const isPendingChange = hasPendingField;
                    return (
                      <td style={{ ...tdStyle, textAlign: 'center', padding: editingSchedule ? cssVars.spacing.xs : cssVars.spacing.sm, backgroundColor: isPendingChange ? cssVars.colors.editorDragActiveBg : undefined }}>
                        {editingSchedule && onFieldChange ? (
                          <select disabled={(status === 'running' || status === 'finished')} value={displayedField || 1} onChange={(e) => { const fieldNum = parseInt(e.target.value); onFieldChange(match.id, fieldNum); }} style={{ width: '100%', padding: cssVars.spacing.xs, border: `1px solid ${isPendingChange ? cssVars.colors.primary : cssVars.colors.borderControl}`, borderRadius: cssVars.borderRadius.sm, fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.semibold, textAlign: 'center', cursor: 'pointer', backgroundColor: cssVars.colors.background, color: cssVars.colors.textPrimary }}>
                            {fieldOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                          </select>
                        ) : (<span style={{ fontWeight: cssVars.fontWeights.semibold }}>{displayedField || '-'}</span>)}
                      </td>
                    );
                  })()}
                </>
              )}
            </FinalSortableRow>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div style={containerStyle} className="final-stage-schedule">
      {showTitle && <h2 style={titleStyle}>{t('finals.title')}</h2>}

      <style>{`
        /* Hide mobile view by default */
        .final-stage-schedule .mobile-view {
          display: none;
        }

        /* Mobile: Show cards, hide table */
        @media (max-width: 768px) {
          .final-stage-schedule .desktop-view {
            display: none !important;
          }
          .final-stage-schedule .mobile-view {
            display: block !important;
          }
        }

        /* Print: Always use table layout */
        @media print {
          .final-stage-schedule {
            break-inside: avoid;
          }
          .final-stage-schedule .mobile-view {
            display: none !important;
          }
          .final-stage-schedule .desktop-view {
            display: block !important;
          }
          .final-stage-schedule table {
            min-width: 100%;
          }
        }
      `}</style>

      {/* Desktop Table View with DnD */}
      <div className="desktop-view" style={{ overflowX: 'auto' }}>
        {editingSchedule && onMatchSwap ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            autoScroll={SCHEDULE_AUTO_SCROLL}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
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
                    {finalMatchLabel(activeMatch, sides, t)}
                  </span>
                  <span style={{ color: cssVars.colors.textSecondary }}>{activeMatch.time}</span>
                  <span style={{ fontWeight: cssVars.fontWeights.semibold, flex: 1 }}>
                    {sideName(activeMatch, 'A', sides)} <span style={{ color: cssVars.colors.textMuted }}><Versus /></span> {sideName(activeMatch, 'B', sides)}
                  </span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : (
          renderTableContent()
        )}
      </div>

      {/* Mobile Card View: Tore je Zeile (@OB-064), Eingabe je Feld (C-FINALRUNDE-MOBIL-EINGABE) */}
      <div className="mobile-view">
        {sortedMatches.map((match) => {
          const status = statusOf(match);
          const isFinished = status === 'finished';
          const matchView = matchViewOf(sides, match.id);
          const home = sideDisplay(match, 'A', sides);
          const away = sideDisplay(match, 'B', sides);
          const hasPendingRef = pendingChanges?.refereeAssignments[match.id] !== undefined;
          const hasPendingField = pendingChanges?.fieldAssignments[match.id] !== undefined;

          return (
            <FinalStageMobileCard
              key={match.id}
              match={match}
              label={finalMatchLabel(match, sides, t)}
              homeName={home.name}
              awayName={away.name}
              homePending={home.pending}
              awayPending={away.pending}
              result={resultFigures(matchView?.score, status)}
              isRunning={status === 'running'}
              badge={matchView?.badge}
              clock={clockOf?.(match.id) ?? null}
              viewStatus={matchView?.status}
              isFinished={isFinished}
              canEditScore={editable && onScoreChange !== undefined && !isFinished && (status !== 'running' || canEndRunning)}
              inCorrectionMode={correctionMatchId === match.id}
              onScoreChange={onScoreChange}
              onStartCorrection={onStartCorrection}
              changeAuthorOf={changeAuthorOf}
              showReferees={!!showReferees}
              showFields={showFields}
              editingSchedule={editingSchedule}
              displayedRef={hasPendingRef ? pendingChanges.refereeAssignments[match.id] : match.referee}
              displayedField={hasPendingField ? pendingChanges.fieldAssignments[match.id] : match.field}
              hasPendingRef={hasPendingRef}
              hasPendingField={hasPendingField}
              refereeOptions={refereeOptions}
              fieldOptions={fieldOptions}
              onRefereeChange={onRefereeChange}
              onFieldChange={onFieldChange}
              extraAction={<>
                <MatchForfeitAction matchId={match.id} viewStatus={matchView?.status} forfeit={forfeit} />
                {editingSchedule && <SwapWithButton matchId={match.id} locked={status === 'running' || isFinished} />}
              </>}
            />
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

/** Sieger fett, Verlierer gedämpft (@OB-064); ohne Entscheidung unverändert. */
function winnerCellStyle(result: ResultFigures | null, side: 'a' | 'b'): CSSProperties {
  if (result?.winner === undefined || result.winner === null) { return {}; }
  return result.winner === side
    ? { fontWeight: cssVars.fontWeights.bold }
    : { color: cssVars.colors.textSecondary };
}
