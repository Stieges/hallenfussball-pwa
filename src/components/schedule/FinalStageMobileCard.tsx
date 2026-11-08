/**
 * FinalStageMobileCard - Spielkarte der Finalrunde für Handy und Tablet hochkant (@OB-064, Variante D)
 *
 * Mannschaften untereinander, ihre Tore rechts in der Zeile; Strafstoß kleiner daneben, Sieger fett.
 * Ein offenes Spiel lässt sich hier eintragen (C-FINALRUNDE-MOBIL-EINGABE, `useScoreDraft`, @FU-101).
 * Mit `kasten` steht die Torzahl im kleinen Kasten in Teamfarbe (Weste mit Leibchen-Zeichen bei Leibchen); beim beendeten Finale mit Ring um den Sieger und
 * Pokal oben rechts (@ZM-158, @ZM-156: in der Finalrunde hat der Sieger den Pokal).
 */
import { type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import { useTheme } from '../../hooks/useTheme';
import { overHex } from '../../design-tokens/displayColor';
import { ScoreBox } from '../ui/molecules/ScoreBox';
import { pairFrameStrength } from '../ui/molecules/scoreBoxStyle';
import type { ScheduledMatch } from '../../core/generators';
import { MatchStatusBadge } from '../ui/molecules/MatchStatusBadge';
import { MatchClock } from '../ui/molecules/MatchClock';
import { ZeitstrafeHinweis } from '../ui/molecules/ZeitstrafeHinweis';
import { ScoreDraftInput } from '../ui/atoms';
import { entryScore } from './runningEntryScore';
import { ScoreChangedHint, ScoreDraftHint, ScoreSaveButton, useScoreDraft, type ScoreCommitResult } from '../ui/molecules';
import type { MatchBadgeModel, MatchView, SpectatorClock, ViewMatchStatus } from '../../core/view';
import type { ResultFigures } from './matchResult';
import { MatchMenuSlot, OriginalTimeNote } from './MatchTimeShiftSlots';
import { MatchActionTrigger } from './actionMenu/MatchActionTrigger';
import { isInteractiveTarget } from './actionMenu/isInteractiveTarget';

export interface FinalMobileOption {
  value: number;
  label: string;
}

export interface FinalStageMobileCardProps {
  match: ScheduledMatch;
  /** Rundenname („Halbfinale“, „Finale“ …) */
  label: string;
  homeName: string;
  awayName: string;
  homePending: boolean;
  awayPending: boolean;
  result: ResultFigures | null;
  isRunning: boolean;
  isFinished: boolean;
  /** Abzeichen der Ansicht (`MatchView.badge`): Wort je Zustand, ohne Uhr (@OB-065, @OB-066) */
  badge?: MatchBadgeModel;
  /** Restzeit beim Stand (@ZM-162) */
  clock?: SpectatorClock | null;
  /** Fachlicher Status der Ansicht: „ausgefallen“ / „gewertet“ (@ZM-104) */
  viewStatus?: ViewMatchStatus;
  /** Tore dürfen eingetragen werden (Verwaltung, Spiel nicht beendet) */
  canEditScore: boolean;
  onScoreChange?: (matchId: string, scoreA: number, scoreB: number) => ScoreCommitResult;
  /** Öffnet die Aktionsauswahl des Spiels (@SL-193); fehlt = Karte nicht antippbar */
  onOpenActions?: (matchId: string) => void;
  /** Wer dieses Spiel zuletzt geändert hat, für den Hinweis „inzwischen geändert“ (@FU-104) */
  changeAuthorOf?: (matchId: string) => Promise<string | null>;
  showReferees: boolean;
  showFields: boolean;
  editingSchedule: boolean;
  displayedRef: number | null | undefined;
  displayedField: number | undefined;
  hasPendingRef: boolean;
  hasPendingField: boolean;
  refereeOptions: FinalMobileOption[];
  fieldOptions: FinalMobileOption[];
  onRefereeChange?: (matchId: string, refereeNumber: number | null) => void;
  onFieldChange?: (matchId: string, fieldNumber: number) => void;
  /** B-12: weitere Aktion der Turnierleitung (z. B. „Nicht angetreten“) unter dem Stand */
  extraAction?: ReactNode;
  /** Kästen der Ansicht (`MatchView.boxes`) beim laufenden und beim beendeten Finalspiel; ohne Angabe steht die Zahl wie bisher */
  kasten?: MatchView['boxes'];
}

const nameStyle: CSSProperties = { overflowWrap: 'break-word' };

const selectStyle: CSSProperties = {
  width: '100%',
  height: cssVars.touchTargets.minimum,
  padding: `0 ${cssVars.spacing.lg} 0 ${cssVars.spacing.sm}`,
  borderRadius: cssVars.borderRadius.sm,
  fontSize: cssVars.fontSizes.lg,
  fontWeight: cssVars.fontWeights.semibold,
  cursor: 'pointer',
  backgroundColor: cssVars.colors.background,
  color: cssVars.colors.textPrimary,
};

export const FinalStageMobileCard: React.FC<FinalStageMobileCardProps> = (props) => {
  const {
    match, label, homeName, awayName, homePending, awayPending, result, isRunning, isFinished, badge, clock, viewStatus, canEditScore,
    onScoreChange, onOpenActions, changeAuthorOf, showReferees, showFields, editingSchedule, displayedRef, displayedField,
    hasPendingRef, hasPendingField, refereeOptions, fieldOptions, onRefereeChange, onFieldChange, extraAction, kasten,
  } = props;
  const { t } = useTranslation('tournament');
  const { colors } = useTheme();
  const decided = result?.winner !== undefined && result.winner !== null;
  // Mit Kasten steht der Zusatz „nach Verlängerung“ klein beim Stand des Siegers und das Strafstoßergebnis als „(4)“, nicht in der Kopfzeile (@OB-064, @ZM-158: „beim Stand statt in
  // der Kopfzeile“, Befund C-ENDE-DOPPELT). Ohne Kasten (Verwaltung, Kindermodus) bleibt die Kopfzeile wie bisher.
  const note = isFinished && kasten === undefined
    ? result?.decision === 'penalty' ? t('matchResult.finishedPenalty') : result?.decision === 'overtime' ? t('matchResult.finishedOvertime') : undefined
    : undefined;
  const statusNote = viewStatus === 'awarded' ? t('view.status.awarded') : undefined;
  const editable = canEditScore;
  const draft = useScoreDraft({
    resetKey: match.id, savedA: entryScore(match.scoreA, match.scoreB, isRunning), savedB: entryScore(match.scoreB, match.scoreA, isRunning),
    onCommit: (a, b) => onScoreChange?.(match.id, a, b), allowUnchanged: isRunning,
    resolveAuthor: changeAuthorOf ? () => changeAuthorOf(match.id) : undefined,
  });

  // Hintergrund hinter dem Kasten = die sichtbare Farbe der Karte (Seite, beim laufenden Spiel mit der roten Zeilentönung); gleiche Rahmenbreite beider Kästen
  const hintergrund = isRunning ? overHex(colors.statusLiveRowBg, colors.background) : colors.background;
  const rahmen = kasten === undefined ? undefined : pairFrameStrength({ fill: kasten.home.fill }, { fill: kasten.away.fill }, hintergrund);

  const renderRow = (side: 'a' | 'b', name: string, pending: boolean) => {
    const isWinner = decided && result?.winner === side;
    const isLoser = decided && result?.winner !== side;
    const goals = result === null ? undefined : side === 'a' ? result.goalsA : result.goalsB;
    const penalty = side === 'a' ? result?.penaltyA : result?.penaltyB;
    const rowKey = side === 'a' ? 'home' : 'away';
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: cssVars.spacing.sm,
          padding: `${cssVars.spacing.xs} 0`,
          fontSize: cssVars.fontSizes.md,
          fontWeight: isWinner ? cssVars.fontWeights.bold : cssVars.fontWeights.normal,
          color: pending ? cssVars.colors.textPlaceholder : isLoser ? cssVars.colors.textSecondary : cssVars.colors.textPrimary,
          fontStyle: pending ? 'italic' : 'normal',
        }}
      >
        {/* @ZM-184: laufende Zeitstrafe beim Team */}
        <ZeitstrafeHinweis liste={clock?.zeitstrafen?.[rowKey]} testId={`match-time-penalty-${match.id}-${rowKey}`}>
          <span style={nameStyle} data-winner={isWinner ? 'true' : undefined} data-testid={`final-name-${match.id}-${rowKey}`}>{name}</span>
        </ZeitstrafeHinweis>
        {editable ? (
          <ScoreDraftInput
            {...draft.fieldProps(side)}
            testId={`final-score-input-${match.id}-${rowKey}`}
            ariaLabel={t('scoreCell.goalsOf', { team: name })}
          />
        ) : (
          <span style={{ display: 'flex', alignItems: 'baseline', gap: cssVars.spacing.xs, fontVariantNumeric: 'tabular-nums' }}>
            <span
              style={{ fontSize: cssVars.fontSizes.xl, fontWeight: isWinner ? cssVars.fontWeights.bold : cssVars.fontWeights.semibold }}
              data-testid={`final-goals-${match.id}-${rowKey}`}
            >
              {kasten === undefined ? (goals ?? '–') : (
                <ScoreBox
                  score={goals ?? 0}
                  fill={(side === 'a' ? kasten.home : kasten.away).fill}
                  size="compact"
                  background={hintergrund}
                  textColor={colors.textPrimary}
                  bib={(side === 'a' ? kasten.home : kasten.away).bib}
                  outcome={isFinished && decided ? (isWinner ? 'winner' : 'loser') : undefined}
                  cup={isFinished && isWinner}
                  frameStrength={rahmen}
                  ariaLabel={[`${name}: ${String(goals ?? 0)}`, isFinished && isWinner ? t('matchCard.winnerAria') : null, (side === 'a' ? kasten.home : kasten.away).bib ? t('matchCard.bibAria') : null].filter((x) => x !== null).join(', ')}
                  testId={`final-box-${match.id}-${rowKey}`}
                />
              )}
            </span>
            {kasten !== undefined && isFinished && isWinner && result?.decision === 'overtime' && (
              <span style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary }} data-testid={`final-overtime-${match.id}-${rowKey}`}>
                {t('matchResult.afterOvertime')}
              </span>
            )}
            {penalty !== undefined && (
              <span style={{ fontSize: cssVars.fontSizes.md, color: cssVars.colors.textSecondary }} data-testid={`final-penalty-${match.id}-${rowKey}`}>
                ({penalty})
              </span>
            )}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      data-testid={`final-card-${match.id}`}
      onClick={onOpenActions ? (e) => { if (!isInteractiveTarget(e.target)) { onOpenActions(match.id); } } : undefined}
      style={{
        ...(onOpenActions ? { cursor: 'pointer' } : {}),
        backgroundColor: isRunning ? cssVars.colors.statusLiveRowBg : cssVars.colors.background,
        border: `2px solid ${isRunning ? cssVars.colors.statusLive : cssVars.colors.accent}`,
        borderRadius: cssVars.borderRadius.md,
        padding: `${cssVars.spacing.sm} ${cssVars.spacing.sm}`,
        marginBottom: cssVars.spacing.sm,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: cssVars.spacing.xs, fontSize: cssVars.fontSizes.sm }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.xs, color: cssVars.colors.textSecondary }}>
          {onOpenActions ? (
            <span style={{ fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.accent }}>
              <MatchActionTrigger matchId={match.id} matchNumber={match.matchNumber} onOpen={onOpenActions}>#{match.matchNumber}</MatchActionTrigger>
            </span>
          ) : (
            <span style={{ fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.accent }}>#{match.matchNumber}</span>
          )}
          <span>•</span>
          <span>{match.time}<OriginalTimeNote matchId={match.id} /></span>
          {badge?.kind === 'badge' && <MatchStatusBadge model={badge} size="card" testId={isRunning ? `final-live-${match.id}` : undefined} />}
          {statusNote && <span style={{ fontWeight: cssVars.fontWeights.bold }} data-testid={`final-status-note-${match.id}`}>{statusNote}</span>}
          {note && <span style={{ fontWeight: cssVars.fontWeights.bold }} data-testid={`final-decision-${match.id}`}>{note}</span>}
        </div>
        <div style={{ display: 'flex', gap: cssVars.spacing.sm, color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.xs }}>
          {showReferees && displayedRef && <span style={hasPendingRef ? { color: cssVars.colors.primary } : undefined}>{t('matchCard.refereePrefix', { referee: displayedRef })}</span>}
          {showFields && displayedField && displayedField > 1 && <span style={hasPendingField ? { color: cssVars.colors.primary } : undefined}>F:{displayedField}</span>}
          <MatchMenuSlot matchId={match.id} />
        </div>
      </div>

      <div
        style={{
          fontSize: cssVars.fontSizes.sm,
          fontWeight: cssVars.fontWeights.bold,
          // Textfarbe statt Akzent: Amber auf der Tönung (bei laufendem Spiel zusätzlich auf der roten Zeilentönung) erreichte im hellen Design nur 3,99 bis 4,28 : 1 (Durchsicht Z16)
          color: cssVars.colors.textPrimary,
          marginBottom: cssVars.spacing.xs,
          textAlign: 'center',
          backgroundColor: cssVars.colors.accentLight,
          padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
          borderRadius: cssVars.borderRadius.sm,
        }}
      >
        {label}
      </div>

      {renderRow('a', homeName, homePending)}
      {renderRow('b', awayName, awayPending)}
      {editable && draft.invalid && <ScoreDraftHint id={draft.hintId} testId={`final-score-hint-${match.id}`} />}
      {draft.changed && (
        <ScoreChangedHint
          changed={draft.changed}
          testId={`final-score-changed-${match.id}`}
          keepTestId={`final-score-changed-keep-${match.id}`}
          onKeepDraft={editable && !isFinished ? draft.keepDraft : undefined}
        />
      )}

      {editable && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: cssVars.spacing.xs }}>
          <ScoreSaveButton testId={`final-score-save-${match.id}`} disabled={!draft.canSave} ending={isRunning} onSave={draft.save} />
        </div>
      )}

      {clock && <div style={{ marginTop: cssVars.spacing.xs }}><MatchClock clock={clock} size="card" /></div>}

      {extraAction}

      {editingSchedule && (showReferees || showFields) && (
        <div style={{ display: 'flex', gap: cssVars.spacing.sm, marginTop: cssVars.spacing.xs, paddingTop: cssVars.spacing.xs, borderTop: `1px solid ${cssVars.colors.border}` }}>
          {showReferees && onRefereeChange && (
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textMuted }}>{t('finals.columns.referee')}</label>
              <select
                value={displayedRef ?? ''}
                disabled={isRunning || isFinished /* @ZP-093 */}
                onChange={(e) => onRefereeChange(match.id, e.target.value ? parseInt(e.target.value, 10) : null)}
                style={{ ...selectStyle, border: `1px solid ${hasPendingRef ? cssVars.colors.primary : cssVars.colors.borderControl}` }}
              >
                <option value="">-</option>
                {refereeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          )}
          {showFields && onFieldChange && (
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textMuted }}>{t('finals.field')}</label>
              <select
                value={displayedField ?? 1}
                disabled={isRunning || isFinished /* @ZP-093 */}
                onChange={(e) => onFieldChange(match.id, parseInt(e.target.value, 10))}
                style={{ ...selectStyle, border: `1px solid ${hasPendingField ? cssVars.colors.primary : cssVars.colors.borderControl}` }}
              >
                {fieldOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FinalStageMobileCard;
