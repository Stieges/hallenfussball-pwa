/**
 * ScheduleShootoutPrompt (A-25a, @FU-094): Abfrage des Strafstoßergebnisses, wenn die Turnierleitung im Spielplan ein
 * Unentschieden für ein K.-o.-Spiel einträgt. Zwei Zahlen (Heim/Gast); „Ergebnis speichern“ bleibt gesperrt, solange
 * eine Angabe fehlt oder beide gleich sind – der Hinweis nennt den Grund. Abbruch speichert nichts.
 * Fläche `DialogSurface`, Fuß `DialogActions` (Haupttaste ≥ touchTargets.primary), Eingaben über `Input` (Schrift ≥ 16 px).
 */
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../../../components/ui/Input';
import { DialogActions } from '../../../components/ui/molecules/DialogActions';
import { DialogSurface } from '../../../components/ui/molecules/DialogSurface';
import { cssVars, dialogWidths } from '../../../design-tokens';
import type { ResultEntryPrompt } from '../hooks/useScheduleResultEntry';

export interface ScheduleShootoutPromptProps {
  prompt: Extract<ResultEntryPrompt, { kind: 'shootout' }>;
  answerPrompt: (answer: string | null) => void;
}

const bodyStyle: CSSProperties = { padding: cssVars.spacing.lg, display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md };
const titleStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary };
const textStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.lg, color: cssVars.colors.textPrimary };
const rowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: cssVars.spacing.md };
const fieldStyle: CSSProperties = { flex: '1 1 0', minWidth: 0 };
const hintStyle: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.md };

const asCount = (value: string): number | null => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : null);

export function ScheduleShootoutPrompt({ prompt, answerPrompt }: ScheduleShootoutPromptProps) {
  const { t } = useTranslation('tournament');
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const homeCount = asCount(home);
  const awayCount = asCount(away);
  const hint =
    homeCount === null || awayCount === null
      ? t('schedule.resultEntry.shootoutMissing')
      : homeCount === awayCount
        ? t('schedule.resultEntry.shootoutTie')
        : null;

  // Die Taste ist gesperrt, solange `hint` gesetzt ist -- dann sind beide Zahlen gültig und verschieden.
  const save = () => answerPrompt(`${homeCount}:${awayCount}`);

  return (
    <DialogSurface isOpen onClose={() => answerPrompt(null)} maxWidth={dialogWidths.md} accent={cssVars.colors.warning} labelledBy="result-entry-shootout-title">
      <div style={bodyStyle} data-testid="result-entry-shootout-dialog">
        <h2 id="result-entry-shootout-title" style={titleStyle}>{t('schedule.resultEntry.shootoutTitle')}</h2>
        <p style={textStyle}>{t('schedule.resultEntry.shootoutQuestion', { number: prompt.matchNumber, score: prompt.score })}</p>
        <div style={rowStyle}>
          <div style={fieldStyle}>
            <Input label={prompt.homeName} type="number" min={0} step={1} value={home} onChange={setHome} data-testid="result-entry-shootout-home" />
          </div>
          <div style={fieldStyle}>
            <Input label={prompt.awayName} type="number" min={0} step={1} value={away} onChange={setAway} data-testid="result-entry-shootout-away" />
          </div>
        </div>
        {hint !== null && <p role="status" data-testid="result-entry-shootout-hint" style={hintStyle}>{hint}</p>}
        <DialogActions
          secondary={[{ label: t('schedule.resultEntry.cancel'), onClick: () => answerPrompt(null), 'data-testid': 'result-entry-shootout-cancel' }]}
          primary={{ label: t('schedule.resultEntry.shootoutSave'), onClick: save, disabled: hint !== null, 'data-testid': 'result-entry-shootout-save' }}
        />
      </div>
    </DialogSurface>
  );
}
