import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, mediaQueries } from '../../design-tokens'
import type { ViewMatchStatus } from '../../core/view';
import { entryScore } from './runningEntryScore';
import { tableResultExtra, tableResultExtraTerms, type ResultFigures } from './matchResult';
import { ScoreDraftInput } from '../ui/atoms';
import { ScoreChangedHint, ScoreDraftHint, ScoreSaveButton, useScoreDraft, type ScoreCommitResult } from '../ui/molecules';
interface MatchScoreCellProps {
  matchId: string;
  scoreA: number | undefined;
  scoreB: number | undefined;
  editable: boolean;
  isFinished: boolean;
  /** Laufendes Spiel: „Spiel beenden und Ergebnis eintragen“, auch der Stand der Uhr lässt sich senden (@FU-112) */
  isRunning?: boolean;
  inCorrectionMode: boolean;
  /** Tore, Strafstoß und Sieger (`resultFigures`): zeigt „2:2 (4:3 i. E.)“ bzw. „3:2 n. V.“ statt `scoreA : scoreB` (@OB-064) */
  result?: ResultFigures | null;
  /** Fachlicher Status der Ansicht: „ausgefallen“ statt Platzhalter, „gewertet“ neben dem Ergebnis (@ZM-104) */
  viewStatus?: ViewMatchStatus;
  /** Namen der Teams für die Feld-Beschriftung „Tore {Team}“ */
  nameA?: string;
  nameB?: string;
  /** `false` (bzw. abgelehnte Zusage) = nicht gespeichert: die Zelle zeigt wieder den gespeicherten Stand */
  onScoreChange: (scoreA: number, scoreB: number) => ScoreCommitResult;
  /** Ohne Handler (bis B-24) gibt es keinen Korrigieren-Knopf. */
  onStartCorrection?: () => void;
  /** Wer dieses Spiel zuletzt geändert hat, für den Hinweis „inzwischen geändert“ (@FU-104) */
  changeAuthorOf?: (matchId: string) => Promise<string | null>;
  // Note: Permission check is now handled in the parent component (ScheduleTab)
}

export const MatchScoreCell: React.FC<MatchScoreCellProps> = ({
  matchId,
  scoreA,
  scoreB,
  editable,
  isFinished,
  isRunning = false,
  inCorrectionMode,
  result,
  viewStatus,
  nameA,
  nameB,
  onScoreChange,
  onStartCorrection,
  changeAuthorOf,
}) => {
  const { t } = useTranslation(['tournament', 'sport']);

  // Jede Ziffer bleibt lokal, gespeichert wird erst mit „Ergebnis speichern“, wenn beide Felder gefüllt sind (@FU-101:
  // „1“ dann „0“ ergibt 10:2, nicht 1:2; Verlassen eines Feldes speichert nichts). Escape verwirft, nach „Nein“/Abbruch zeigt die Zelle wieder den gespeicherten Stand.
  // @FU-104: ändert ein anderes Gerät genau dieses Spiel, sendet die Zelle den Entwurf erst nach „Meine Eingabe behalten“.
  const draft = useScoreDraft({
    resetKey: matchId, savedA: entryScore(scoreA, scoreB, isRunning), savedB: entryScore(scoreB, scoreA, isRunning), onCommit: onScoreChange, allowUnchanged: isRunning,
    resolveAuthor: changeAuthorOf ? () => changeAuthorOf(matchId) : undefined,
  });
  const changedHint = (editableNow: boolean) => draft.changed && (
    <ScoreChangedHint
      changed={draft.changed}
      testId={`score-changed-${matchId}`}
      keepTestId={`score-changed-keep-${matchId}`}
      onKeepDraft={editableNow ? draft.keepDraft : undefined}
    />
  );
  const placeholder = viewStatus === 'cancelled' ? t('view.status.cancelled') : '___ : ___';
  const awardedMark = viewStatus === 'awarded' ? ` ${t('view.status.awarded')}` : '';
  // Tabelle: „2:2 (4:3 i. E.)“ / „3:2 n. V.“ – die Kurzform trägt den ausgeschriebenen Begriff als title und Vorlesetext (@OB-075)
  const extra = result === undefined || result === null ? undefined : tableResultExtra(result, t);
  const extraTerms = result === undefined || result === null ? undefined : tableResultExtraTerms(result, t);
  const shownResult: ReactNode = result === undefined || result === null
    ? (typeof scoreA === 'number' && typeof scoreB === 'number' && viewStatus === undefined ? `${scoreA} : ${scoreB}` : placeholder)
    : (
      <>
        {`${result.goalsA}:${result.goalsB}`}
        {extra !== undefined && (
          <>
            {' '}
            <span data-testid={`match-score-extra-${matchId}`} title={extraTerms?.long} aria-label={extraTerms?.spoken} role="note">{extra}</span>
          </>
        )}
        {awardedMark}
      </>
    );

  // State 1: Finished match - ALWAYS read-only with correction button
  // BUG FIX: Beendete Spiele dürfen nicht direkt bearbeitet werden, auch wenn editable=true
  // Der CorrectionDialog muss verwendet werden, um Ergebnisse zu korrigieren
  if (isFinished && !inCorrectionMode) {
    const containerStyle: CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '6px',
    };

    const scoreStyle: CSSProperties = {
      fontWeight: cssVars.fontWeights.bold,
      fontSize: cssVars.fontSizes.md,
    };

    const buttonStyle: CSSProperties = {
      background: 'transparent',
      border: `1px solid ${cssVars.colors.borderControl}`,
      borderRadius: cssVars.borderRadius.sm,
      color: cssVars.colors.textSecondary,
      fontSize: cssVars.fontSizes.xs,
      padding: '3px 8px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      whiteSpace: 'nowrap' as const,
    };

    return (
      <>
        <div style={containerStyle} className="match-score-cell-finished">
          <span style={scoreStyle}>
            {shownResult}
          </span>
          {onStartCorrection && (
            <button
              style={buttonStyle}
              onClick={(e) => {
                e.stopPropagation();
                onStartCorrection();
              }}
              className="correction-button"
              data-testid={`correction-button-${matchId}`}
            >
              {t('scoreCell.correctResult')}
            </button>
          )}
          {changedHint(false)}
        </div>

        <style>{`
          .correction-button:hover,
          .correction-button:active {
            background: ${cssVars.colors.primary};
            color: white;
            border-color: ${cssVars.colors.primary};
          }

          ${mediaQueries.tabletDown} {
            .match-score-cell-finished {
              gap: 4px !important;
            }

            .correction-button {
              font-size: 10px !important;
              padding: 2px 6px !important;
            }
          }
        `}</style>
      </>
    );
  }

  // State 2 & 3: Editable (active) or Correction mode
  if (editable || inCorrectionMode) {
    const inputContainerStyle: CSSProperties = {
      display: 'flex',
      gap: cssVars.spacing.xs,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative' as const,
      flexWrap: 'wrap',
    };

    const iconStyle: CSSProperties = {
      position: 'absolute' as const,
      top: '-8px',
      right: '-8px',
      fontSize: cssVars.fontSizes.lg,
    };

    return (
      <div style={inputContainerStyle}>
        {inCorrectionMode && <span style={iconStyle}>⚠️</span>}
        <ScoreDraftInput
          {...draft.fieldProps('a')}
          ariaLabel={t('scoreCell.goalsOf', { team: nameA ?? t('scoreCell.homeFallback') })}
          testId={`match-score-input-${matchId}-home`}
          inCorrectionMode={inCorrectionMode}
        />
        <span>:</span>
        <ScoreDraftInput
          {...draft.fieldProps('b')}
          ariaLabel={t('scoreCell.goalsOf', { team: nameB ?? t('scoreCell.awayFallback') })}
          testId={`match-score-input-${matchId}-away`}
          inCorrectionMode={inCorrectionMode}
        />
        {draft.invalid && <ScoreDraftHint id={draft.hintId} testId={`match-score-hint-${matchId}`} />}
        {changedHint(true)}
        <ScoreSaveButton testId={`match-score-save-${matchId}`} disabled={!draft.canSave} ending={isRunning && !inCorrectionMode} onSave={draft.save} />
      </div>
    );
  }

  // Fallback: Display only
  return (
    <span>
      {shownResult}
      {changedHint(false)}
    </span>
  );
};
