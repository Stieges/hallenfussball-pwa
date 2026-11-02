import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import type { ViewMatchStatus } from '../../core/view';
import { entryScore } from './runningEntryScore';
import { formatTableResult, type ResultFigures } from './matchResult';
import { ScoreDraftInput } from '../ui/atoms';
import { ScoreChangedHint, ScoreDraftHint, ScoreSaveButton, useScoreDraft, type ScoreCommitResult } from '../ui/molecules';
const finishedStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: cssVars.spacing.xs };
const finishedScoreStyle: CSSProperties = { fontWeight: cssVars.fontWeights.bold, fontSize: cssVars.fontSizes.md };
const inputContainerStyle: CSSProperties = { display: 'flex', gap: cssVars.spacing.xs, alignItems: 'center', justifyContent: 'center', position: 'relative', flexWrap: 'wrap' };

interface MatchScoreCellProps {
  matchId: string;
  scoreA: number | undefined;
  scoreB: number | undefined;
  editable: boolean;
  isFinished: boolean;
  /** Laufendes Spiel: „Spiel beenden und Ergebnis eintragen“, auch der Stand der Uhr lässt sich senden (@FU-112) */
  isRunning?: boolean;
  /** Tore, Strafstoß und Sieger (`resultFigures`): zeigt „2:2 (4:3 i. E.)“ bzw. „3:2 n. V.“ statt `scoreA : scoreB` (@OB-064) */
  result?: ResultFigures | null;
  /** Fachlicher Status der Ansicht: „ausgefallen“ statt Platzhalter, „gewertet“ neben dem Ergebnis (@ZM-104) */
  viewStatus?: ViewMatchStatus;
  /** Namen der Teams für die Feld-Beschriftung „Tore {Team}“ */
  nameA?: string;
  nameB?: string;
  /** `false` (bzw. abgelehnte Zusage) = nicht gespeichert: die Zelle zeigt wieder den gespeicherten Stand */
  onScoreChange: (scoreA: number, scoreB: number) => ScoreCommitResult;
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
  result,
  viewStatus,
  nameA,
  nameB,
  onScoreChange,
  changeAuthorOf,
}) => {
  const { t } = useTranslation('tournament');

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
  const shownResult = result === undefined || result === null
    ? (typeof scoreA === 'number' && typeof scoreB === 'number' && viewStatus === undefined ? `${scoreA} : ${scoreB}` : placeholder)
    : `${formatTableResult(result, t)}${awardedMark}`;

  // Beendet: nur lesen. Die Korrektur beginnt in der Aktionsauswahl des Spiels, im selben Dialog wie im Cockpit (@EK-063).
  if (isFinished) {
    return (
      <div style={finishedStyle} className="match-score-cell-finished">
        <span style={finishedScoreStyle}>{shownResult}</span>
        {changedHint(false)}
      </div>
    );
  }

  // Offen: Eingabe der Tore, gespeichert erst mit „Ergebnis speichern“
  if (editable) {
    return (
      <div style={inputContainerStyle}>
        <ScoreDraftInput
          {...draft.fieldProps('a')}
          ariaLabel={t('scoreCell.goalsOf', { team: nameA ?? t('scoreCell.homeFallback') })}
          testId={`match-score-input-${matchId}-home`}
        />
        <span>:</span>
        <ScoreDraftInput
          {...draft.fieldProps('b')}
          ariaLabel={t('scoreCell.goalsOf', { team: nameB ?? t('scoreCell.awayFallback') })}
          testId={`match-score-input-${matchId}-away`}
        />
        {draft.invalid && <ScoreDraftHint id={draft.hintId} testId={`match-score-hint-${matchId}`} />}
        {changedHint(true)}
        <ScoreSaveButton testId={`match-score-save-${matchId}`} disabled={!draft.canSave} ending={isRunning} onSave={draft.save} />
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
