/**
 * ScheduleEndPrompt (Spiel beenden, 20261110_009): Rückfrage der Turnierleitung, bevor ein angepfiffenes Spiel im
 * Spielplan mit dem Ergebnis beendet wird -- Abpfiff und Ergebnis in einem Schritt, ohne Übernahme des Feldes.
 * Steuert ein anderes Gerät das Feld, steht der Hinweis „Feld 2 wird gerade von Tom gesteuert“ über der Frage (@FU-115,
 * @FU-081). „Ja“ beendet, „Nein“ ändert nichts (@FU-112). Szenarien: @FU-112, @FU-114, @FU-115, @FU-081.
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
      confirmText={t('schedule.resultEntry.yes')}
      cancelText={t('schedule.resultEntry.no')}
      onConfirm={() => answerPrompt('yes')}
      onCancel={() => answerPrompt(null)}
    />
  );
}
