/**
 * ScheduleEndPrompt (Spiel beenden, 20261110_009): Rückfrage der Turnierleitung, bevor ein angepfiffenes Spiel im
 * Spielplan mit dem Ergebnis beendet wird -- Abpfiff und Ergebnis in einem Schritt, ohne Übernahme des Feldes.
 * Steuert ein anderes Gerät das Feld, steht der Hinweis „Feld 2 wird gerade von Tom gesteuert“ über der Frage (@FU-115,
 * @FU-081). Beim laufenden Spiel beendet „Beenden“, „Abbrechen“ ändert nichts (@FU-112); bei abgelaufener Zeit (@FU-114) „Ja“ / „Nein“. Dazu „Spielleitung übernehmen“ (B-49, @FU-081), wenn
 * `takeOver` gesetzt ist: Antwort `'takeover'`. Szenarien: @FU-112, @FU-114, @FU-115, @FU-081.
 */
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import type { EndPrompt } from '../hooks/scheduleEndMatch';

export interface ScheduleEndPromptProps {
  prompt: EndPrompt;
  answerPrompt: (answer: string | null) => void;
}

export function ScheduleEndPrompt({ prompt, answerPrompt }: ScheduleEndPromptProps) {
  const { t } = useTranslation('tournament');
  const { t: tCockpit } = useTranslation('cockpit');
  const question = prompt.rest === null
    ? t('schedule.resultEntry.endQuestionExpired', { score: prompt.score })
    : t('schedule.resultEntry.endQuestionRunning', { number: prompt.matchNumber, rest: prompt.rest, score: prompt.score });
  const controlled = prompt.controlledBy;
  const hint = controlled === null
    ? null
    : controlled.holder
      ? t('schedule.resultEntry.endControlledBy', { field: controlled.field, name: controlled.holder })
      : t('schedule.resultEntry.endControlledByOther', { field: controlled.field });
  return (
    <ConfirmDialog
      variant="warning"
      title={t('schedule.resultEntry.endTitle')}
      message={
        <span data-testid="result-entry-end-message">
          {hint && <><strong data-testid="result-entry-end-controlled">{hint}</strong><br /></>}
          {question}
        </span>
      }
      // @FU-112/@SL-195 (Daniel 12.11.): beim laufenden Spiel „Beenden“ / „Abbrechen“; die Rückfrage „Spielzeit abgelaufen“ (@FU-114) behält „Ja“ / „Nein“
      confirmText={prompt.rest === null ? t('schedule.resultEntry.yes') : t('schedule.resultEntry.endConfirmRunning')}
      cancelText={prompt.rest === null ? t('schedule.resultEntry.no') : t('schedule.resultEntry.endCancelRunning')}
      onConfirm={() => answerPrompt('yes')}
      onCancel={() => answerPrompt(null)}
      secondaryAction={prompt.takeOver ? { text: tCockpit('leiste.uebernehmen'), onClick: () => answerPrompt('takeover') } : undefined}
    />
  );
}
