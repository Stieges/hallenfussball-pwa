/**
 * ScheduleResultEntryPrompt (A-08f3e2): Rückfragen der Schnelleingabe im Spielplan.
 * - abgesetzt (@FU-093): „Spiel war abgesetzt – trotzdem Ergebnis eintragen?“ Ja/Nein.
 * - beendet (Grundpflicht @EK-004, @EK-037): Grund aus der Grundliste (`CorrectionReason`), ohne Vorauswahl;
 *   „Sonstiges“ nur mit Freitext. Abbruch speichert nichts.
 */
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { cssVars } from '../../../design-tokens';
import { CORRECTION_REASONS, type CorrectionReason } from '../../../types/userProfile';
import type { ResultEntryPrompt } from '../hooks/useScheduleResultEntry';

export interface ScheduleResultEntryPromptProps {
  prompt: ResultEntryPrompt | null;
  answerPrompt: (answer: string | null) => void;
}

const REASONS = Object.keys(CORRECTION_REASONS) as CorrectionReason[];

const fieldStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  minHeight: cssVars.touchTargets.minimum,
  marginTop: cssVars.spacing.sm,
  padding: `0 ${cssVars.spacing.md}`,
  border: `1px solid ${cssVars.colors.textSecondary}`,
  borderRadius: cssVars.borderRadius.md,
  fontSize: cssVars.fontSizes.md,
  backgroundColor: cssVars.colors.background,
  color: cssVars.colors.textPrimary,
};

const errorStyle: CSSProperties = {
  display: 'block',
  marginTop: cssVars.spacing.sm,
  color: cssVars.colors.error,
  fontSize: cssVars.fontSizes.sm,
};

function ReasonPrompt({ prompt, answerPrompt }: { prompt: Extract<ResultEntryPrompt, { kind: 'reason' }>; answerPrompt: (answer: string | null) => void }) {
  const { t } = useTranslation('tournament');
  const [reason, setReason] = useState<CorrectionReason | ''>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    if (reason === '') {
      setError(t('schedule.resultEntry.reasonRequired'));
      return;
    }
    if (reason === 'other' && note.trim() === '') {
      setError(t('schedule.resultEntry.noteRequired'));
      return;
    }
    answerPrompt(reason === 'other' ? `other: ${note.trim()}` : reason);
  };

  return (
    <ConfirmDialog
      variant="warning"
      title={t('schedule.resultEntry.reasonTitle', { number: prompt.matchNumber })}
      confirmText={t('schedule.resultEntry.save')}
      cancelText={t('schedule.resultEntry.cancel')}
      onConfirm={confirm}
      onCancel={() => answerPrompt(null)}
      message={
        <span data-testid="result-entry-reason-dialog">
          <span>{t('schedule.resultEntry.beforeAfter', { before: prompt.before, after: prompt.after })}</span>
          <select
            aria-label={t('schedule.resultEntry.reasonLabel')}
            data-testid="result-entry-reason"
            value={reason}
            onChange={(e) => { setReason(e.target.value as CorrectionReason | ''); setError(null); }}
            style={fieldStyle}
          >
            <option value="" disabled>{t('schedule.resultEntry.reasonPlaceholder')}</option>
            {REASONS.map((key) => (
              <option key={key} value={key}>{t(`schedule.resultEntry.reasons.${key}`)}</option>
            ))}
          </select>
          {reason === 'other' && (
            <input
              aria-label={t('schedule.resultEntry.noteLabel')}
              data-testid="result-entry-note"
              value={note}
              onChange={(e) => { setNote(e.target.value); setError(null); }}
              style={fieldStyle}
            />
          )}
          {error && <span role="alert" data-testid="result-entry-reason-error" style={errorStyle}>{error}</span>}
        </span>
      }
    />
  );
}

export function ScheduleResultEntryPrompt({ prompt, answerPrompt }: ScheduleResultEntryPromptProps) {
  const { t } = useTranslation('tournament');
  if (!prompt) {
    return null;
  }
  if (prompt.kind === 'reason') {
    return <ReasonPrompt key={`${prompt.matchNumber}-${prompt.after}`} prompt={prompt} answerPrompt={answerPrompt} />;
  }
  return (
    <ConfirmDialog
      variant="warning"
      title={t('schedule.resultEntry.skippedTitle', { number: prompt.matchNumber })}
      message={t('schedule.resultEntry.skippedQuestion')}
      confirmText={t('schedule.resultEntry.yes')}
      cancelText={t('schedule.resultEntry.no')}
      onConfirm={() => answerPrompt('yes')}
      onCancel={() => answerPrompt(null)}
    />
  );
}
