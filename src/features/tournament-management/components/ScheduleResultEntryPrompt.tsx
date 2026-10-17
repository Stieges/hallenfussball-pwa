/**
 * ScheduleResultEntryPrompt (A-08f3e2): Rückfragen der Schnelleingabe im Spielplan.
 * - abgesetzt (@FU-093): „Spiel war abgesetzt – trotzdem Ergebnis eintragen?“ Ja/Nein.
 * - beendet (Grundpflicht @EK-004, @EK-037): Grund aus der Grundliste (`CorrectionReason`), ohne Vorauswahl;
 *   „Sonstiges“ nur mit Freitext. Abbruch speichert nichts. Fixrunde 1 (I-3): Bausteine `Select`/`Input`
 *   (Schrift ≥ 16 px, sichtbare Beschriftung), Fläche `DialogSurface`.
 * - K.-o.-Unentschieden (A-25a, @FU-094): Ergebnis des Strafstoßschießens (`ScheduleShootoutPrompt`).
 */
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { DialogSurface } from '../../../components/ui/molecules/DialogSurface';
import { cssVars, dialogWidths } from '../../../design-tokens';
import { CORRECTION_REASONS, type CorrectionReason } from '../../../types/userProfile';
import type { ResultEntryPrompt } from '../hooks/useScheduleResultEntry';
import { ScheduleShootoutPrompt } from './ScheduleShootoutPrompt';

export interface ScheduleResultEntryPromptProps {
  prompt: ResultEntryPrompt | null;
  answerPrompt: (answer: string | null) => void;
}

const REASONS = Object.keys(CORRECTION_REASONS) as CorrectionReason[];

const bodyStyle: CSSProperties = { padding: cssVars.spacing.lg, display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md };
const titleStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary };
const textStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.lg, color: cssVars.colors.textPrimary };
const errorStyle: CSSProperties = { margin: 0, color: cssVars.colors.error, fontSize: cssVars.fontSizes.md };
const footerStyle: CSSProperties = { display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: cssVars.spacing.md };

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
  const options = [
    { value: '', label: t('schedule.resultEntry.reasonPlaceholder') },
    ...REASONS.map((key) => ({ value: key, label: t(`schedule.resultEntry.reasons.${key}`) })),
  ];

  return (
    <DialogSurface isOpen onClose={() => answerPrompt(null)} maxWidth={dialogWidths.md} accent={cssVars.colors.warning} labelledBy="result-entry-reason-title">
      <div style={bodyStyle} data-testid="result-entry-reason-dialog">
        <h2 id="result-entry-reason-title" style={titleStyle}>{t('schedule.resultEntry.reasonTitle', { number: prompt.matchNumber })}</h2>
        <p style={textStyle}>{t('schedule.resultEntry.beforeAfter', { before: prompt.before, after: prompt.after })}</p>
        <Select
          label={t('schedule.resultEntry.reasonLabel')}
          value={reason}
          options={options}
          onChange={(value) => { setReason(value as CorrectionReason | ''); setError(null); }}
          error={error !== null && reason === ''}
          data-testid="result-entry-reason"
        />
        {reason === 'other' && (
          <Input
            label={t('schedule.resultEntry.noteLabel')}
            value={note}
            onChange={(value) => { setNote(value); setError(null); }}
            error={error !== null}
            data-testid="result-entry-note"
          />
        )}
        {error && <p role="alert" data-testid="result-entry-reason-error" style={errorStyle}>{error}</p>}
        <div style={footerStyle}>
          <Button variant="secondary" onClick={() => answerPrompt(null)} data-testid="result-entry-cancel">{t('schedule.resultEntry.cancel')}</Button>
          <Button variant="primary" onClick={confirm} data-testid="result-entry-save">{t('schedule.resultEntry.save')}</Button>
        </div>
      </div>
    </DialogSurface>
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
  if (prompt.kind === 'shootout') {
    return <ScheduleShootoutPrompt key={`${prompt.matchNumber}-${prompt.score}`} prompt={prompt} answerPrompt={answerPrompt} />;
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
