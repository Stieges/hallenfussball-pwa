/**
 * ResultEntrySheet (@SL-195, @SL-238): das Blatt „Endergebnis Spiel n“ für die Gruppenphase – Tipp aufs Ergebnisfeld oder „Ergebnis eintragen“
 * in der Auswahl. Leere Felder (nie 0:0 vorbelegt), Cursor im ersten Feld, „−“/„+“ neben dem Feld; gespeichert wird erst mit „Ergebnis
 * speichern“ (@FU-101), die Rückfragen (läuft noch, noch nicht angepfiffen, abgesetzt) stellt der Speicherweg (`useScheduleResultEntry`).
 * - Laufendes Spiel: „Stand im Cockpit 1:0“ im Kopf, „Speichern beendet das Spiel.“ und „1:0 einsetzen“ (füllt beide Felder).
 * - Hinweis „inzwischen von Tom geändert (jetzt 3:1)“ (@FU-104): der Entwurf bleibt, nichts wird still gespeichert; im laufenden Spiel mit
 *   „3:1 einsetzen“ (nur hier, die Finalrunde bleibt unverändert).
 * - Darunter „Tore während des Spiels trägst du im Cockpit ein“ mit „Zum Cockpit“.
 * Die Fläche (`ScoreEntrySheet`) ist fachfrei; hier stehen Texte, Entwurf (`useScoreDraft`) und Verdrahtung.
 */
import { useRef, type CSSProperties, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import type { ScheduledMatch } from '../../core/generators';
import { ScoreDraftInput } from '../ui/atoms';
import { ScoreChangedHint, ScoreDraftHint, ScoreEntrySheet, useScoreDraft, type ScoreCommitResult } from '../ui/molecules';
import { Button } from '../ui/Button';
import { sideDisplay, type SideContext } from './matchSides';

export interface ResultEntrySheetProps {
  match: ScheduledMatch;
  sides: SideContext;
  /** Gespeicherter Endstand (nicht der Entwurf); bei laufendem Spiel `undefined`, der Stand der Uhr steht in `cockpit` */
  saved: { a: number | undefined; b: number | undefined };
  /** Läuft das Spiel? Dann gilt „Speichern beendet das Spiel“ und auch der Stand der Uhr lässt sich senden (@FU-112) */
  running: boolean;
  /** Stand der Uhr im Cockpit (nur laufendes Spiel) */
  cockpit: { a: number; b: number } | null;
  /** Anpfiff-Zeit des Spiels („09:40“) */
  time: string;
  onCommit: (matchId: string, scoreA: number, scoreB: number) => ScoreCommitResult;
  changeAuthorOf?: (matchId: string) => Promise<string | null>;
  onToCockpit?: (matchId: string) => void;
  onClose: () => void;
}

const noteStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, color: cssVars.colors.textSecondary };
const rowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: cssVars.spacing.sm };

export function ResultEntrySheet({ match, sides, saved, running, cockpit, time, onCommit, changeAuthorOf, onToCockpit, onClose }: ResultEntrySheetProps): ReactElement {
  const { t } = useTranslation('tournament');
  const home = sideDisplay(match, 'A', sides).name;
  const away = sideDisplay(match, 'B', sides).name;
  const firstField = useRef<HTMLInputElement | null>(null);

  // Gespeichert wird erst mit „Ergebnis speichern“; wurde gespeichert (nicht abgelehnt, nicht „Nein“), schließt das Blatt (@SL-195)
  const commit = (a: number, b: number): ScoreCommitResult => Promise.resolve(onCommit(match.id, a, b)).then((result) => {
    if (result !== false) { onClose(); }
    return result;
  });
  const draft = useScoreDraft({
    resetKey: match.id, savedA: saved.a, savedB: saved.b, onCommit: commit, allowUnchanged: running,
    resolveAuthor: changeAuthorOf ? () => changeAuthorOf(match.id) : undefined,
  });

  const field = (side: 'a' | 'b', team: string, testId: string): ReactElement => {
    const props = draft.fieldProps(side);
    const inputRef = side === 'a'
      ? (element: HTMLInputElement | null) => { firstField.current = element; (props.inputRef as (e: HTMLInputElement | null) => void)(element); }
      : props.inputRef;
    return <ScoreDraftInput {...props} inputRef={inputRef} ariaLabel={t('scoreCell.goalsOf', { team })} testId={testId} />;
  };
  const row = (side: 'a' | 'b', team: string) => {
    const key = side === 'a' ? 'home' : 'away';
    return {
      id: key,
      name: team,
      field: field(side, team, `result-sheet-score-${key}`),
      minusLabel: t('resultSheet.minus', { team }),
      plusLabel: t('resultSheet.plus', { team }),
      onMinus: () => { draft.bump(side, -1); },
      onPlus: () => { draft.bump(side, 1); },
      minusTestId: `result-sheet-minus-${key}`,
      plusTestId: `result-sheet-plus-${key}`,
    };
  };

  const cockpitScore = cockpit === null ? null : `${cockpit.a}:${cockpit.b}`;
  const meta = [t('header.timeValue', { time }), t('matchCard.field', { field: match.field })];
  if (running && cockpitScore !== null) { meta.push(t('resultSheet.cockpitScore', { score: cockpitScore })); }
  const changedScore = draft.changed === null ? null : `${draft.changed.goalsA ?? '–'}:${draft.changed.goalsB ?? '–'}`;
  const takeOver = running && draft.changed?.goalsA !== undefined && draft.changed.goalsB !== undefined
    ? () => { draft.fill(draft.changed?.goalsA ?? 0, draft.changed?.goalsB ?? 0); }
    : undefined;

  const notice = (
    <>
      {draft.changed !== null && (
        <ScoreChangedHint changed={draft.changed} testId={`score-changed-${match.id}`} keepTestId={`score-changed-keep-${match.id}`} onKeepDraft={draft.keepDraft} onTakeOver={takeOver} />
      )}
      {running && (
        <div style={rowStyle}>
          <p style={noteStyle} data-testid="result-sheet-ends-match">{t('resultSheet.endsMatch')}</p>
          {cockpit !== null && (
            <Button variant="secondary" size="md" onClick={() => { draft.fill(cockpit.a, cockpit.b); }} data-testid="result-sheet-take-cockpit">
              {t('scoreCell.takeOver', { score: cockpitScore })}
            </Button>
          )}
        </div>
      )}
    </>
  );
  const hint = (
    <>
      {draft.invalid && <ScoreDraftHint id={draft.hintId} testId={`result-sheet-hint-${match.id}`} />}
      <div style={rowStyle}>
        <p style={noteStyle} data-testid="result-sheet-cockpit-note">{t('resultSheet.cockpitNote')}</p>
        {onToCockpit !== undefined && (
          <Button variant="secondary" size="md" onClick={() => { onToCockpit(match.id); }} data-testid="result-sheet-to-cockpit">{t('resultSheet.toCockpit')}</Button>
        )}
      </div>
    </>
  );

  return (
    <ScoreEntrySheet
      testId="result-sheet"
      title={t('resultSheet.title', { number: match.matchNumber })}
      subtitle={meta.join(' · ')}
      closeLabel={t('resultSheet.close')}
      teamHeading={t('resultSheet.team')}
      goalsHeading={t('resultSheet.goals')}
      rows={[row('a', home), row('b', away)]}
      notice={changedScore === null && !running ? undefined : notice}
      hint={hint}
      cancelLabel={t('resultSheet.cancel')}
      saveLabel={t('resultSheet.save')}
      saveDisabled={!draft.canSave}
      onCancel={onClose}
      onSave={draft.save}
      initialFocusRef={firstField}
    />
  );
}
