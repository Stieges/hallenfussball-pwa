/**
 * FinalStageMobileCard - Spielkarte der Finalrunde für Handy und Tablet hochkant (@OB-064, Variante D)
 *
 * Mannschaften untereinander, ihre Tore rechts in der Zeile; Strafstoß kleiner daneben, Sieger fett.
 * Ein offenes Spiel lässt sich hier eintragen (C-FINALRUNDE-MOBIL-EINGABE, `useScoreDraft`, @FU-101).
 */
import { type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import type { ScheduledMatch } from '../../core/generators';
import { MatchStatusBadge } from '../ui/molecules/MatchStatusBadge';
import { MatchClock } from '../ui/molecules/MatchClock';
import { ScoreDraftInput } from '../ui/atoms';
import { ScoreChangedHint, ScoreDraftHint, useScoreDraft, type ScoreCommitResult } from '../ui/molecules';
import type { MatchBadgeModel, SpectatorClock, ViewMatchStatus } from '../../core/view';
import type { ResultFigures } from './matchResult';
import { MatchMenuSlot, OriginalTimeNote } from './MatchTimeShiftSlots';

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
  inCorrectionMode: boolean;
  onScoreChange?: (matchId: string, scoreA: number, scoreB: number) => ScoreCommitResult;
  onStartCorrection?: (matchId: string) => void;
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
    match, label, homeName, awayName, homePending, awayPending, result, isRunning, isFinished, badge, clock, viewStatus, canEditScore, inCorrectionMode,
    onScoreChange, onStartCorrection, changeAuthorOf, showReferees, showFields, editingSchedule, displayedRef, displayedField,
    hasPendingRef, hasPendingField, refereeOptions, fieldOptions, onRefereeChange, onFieldChange, extraAction,
  } = props;
  const { t } = useTranslation('tournament');
  const decided = result?.winner !== undefined && result.winner !== null;
  const note = isFinished
    ? result?.decision === 'penalty' ? t('matchResult.finishedPenalty') : result?.decision === 'overtime' ? t('matchResult.overtimeShort') : undefined
    : undefined;
  const statusNote = viewStatus === 'awarded' ? t('view.status.awarded') : undefined;
  const editable = canEditScore || inCorrectionMode;
  const draft = useScoreDraft({
    resetKey: match.id, savedA: match.scoreA, savedB: match.scoreB, onCommit: (a, b) => onScoreChange?.(match.id, a, b),
    resolveAuthor: changeAuthorOf ? () => changeAuthorOf(match.id) : undefined,
  });

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
        <span style={nameStyle} data-winner={isWinner ? 'true' : undefined} data-testid={`final-name-${match.id}-${rowKey}`}>{name}</span>
        {editable ? (
          <ScoreDraftInput
            {...draft.fieldProps(side)}
            inCorrectionMode={inCorrectionMode}
            testId={`final-score-input-${match.id}-${rowKey}`}
            ariaLabel={t('scoreCell.goalsOf', { team: name })}
          />
        ) : (
          <span style={{ display: 'flex', alignItems: 'baseline', gap: cssVars.spacing.xs, fontVariantNumeric: 'tabular-nums' }}>
            <span
              style={{ fontSize: cssVars.fontSizes.xl, fontWeight: isWinner ? cssVars.fontWeights.bold : cssVars.fontWeights.semibold }}
              data-testid={`final-goals-${match.id}-${rowKey}`}
            >
              {goals ?? '–'}
            </span>
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
      style={{
        backgroundColor: isRunning ? cssVars.colors.statusLiveRowBg : cssVars.colors.background,
        border: `2px solid ${isRunning ? cssVars.colors.statusLive : cssVars.colors.accent}`,
        borderRadius: cssVars.borderRadius.md,
        padding: `${cssVars.spacing.sm} ${cssVars.spacing.sm}`,
        marginBottom: cssVars.spacing.sm,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: cssVars.spacing.xs, fontSize: cssVars.fontSizes.sm }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.xs, color: cssVars.colors.textSecondary }}>
          <span style={{ fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.accent }}>#{match.matchNumber}</span>
          <span>•</span>
          <span>{match.time}<OriginalTimeNote matchId={match.id} /></span>
          {badge?.kind === 'badge' && <MatchStatusBadge model={badge} size="card" testId={isRunning ? `final-live-${match.id}` : undefined} />}
          {statusNote && <span style={{ fontWeight: cssVars.fontWeights.bold }} data-testid={`final-status-note-${match.id}`}>{statusNote}</span>}
          {note && <span style={{ fontWeight: cssVars.fontWeights.bold }} data-testid={`final-decision-${match.id}`}>{note}</span>}
        </div>
        <div style={{ display: 'flex', gap: cssVars.spacing.sm, color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.xs }}>
          {showReferees && displayedRef && <span style={hasPendingRef ? { color: cssVars.colors.primary } : undefined}>SR:{displayedRef}</span>}
          {showFields && displayedField && displayedField > 1 && <span style={hasPendingField ? { color: cssVars.colors.primary } : undefined}>F:{displayedField}</span>}
          <MatchMenuSlot matchId={match.id} />
        </div>
      </div>

      <div
        style={{
          fontSize: cssVars.fontSizes.sm,
          fontWeight: cssVars.fontWeights.bold,
          color: cssVars.colors.accent,
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

      {clock && <div style={{ marginTop: cssVars.spacing.xs }}><MatchClock clock={clock} size="card" /></div>}

      {isFinished && !inCorrectionMode && onStartCorrection && (
        <button
          onClick={() => onStartCorrection(match.id)}
          style={{
            marginTop: cssVars.spacing.xs,
            padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
            minHeight: cssVars.touchTargets.minimum,
            fontSize: cssVars.fontSizes.xs,
            color: cssVars.colors.textSecondary,
            backgroundColor: 'transparent',
            border: `1px solid ${cssVars.colors.borderControl}`,
            borderRadius: cssVars.borderRadius.sm,
            cursor: 'pointer',
            width: '100%',
          }}
          className="correction-btn-mobile"
        >
          {t('finals.correct')}
        </button>
      )}

      {extraAction}

      {editingSchedule && (showReferees || showFields) && (
        <div style={{ display: 'flex', gap: cssVars.spacing.sm, marginTop: cssVars.spacing.xs, paddingTop: cssVars.spacing.xs, borderTop: `1px solid ${cssVars.colors.border}` }}>
          {showReferees && onRefereeChange && (
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textMuted }}>SR</label>
              <select
                value={displayedRef ?? ''}
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
