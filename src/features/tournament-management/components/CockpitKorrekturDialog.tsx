/**
 * CockpitKorrekturDialog (B-10a2, @SL-159): erster Schritt der Korrektur aus dem Cockpit nach dem Abpfiff – das bisherige Ergebnis und die
 * zwei Felder für das korrigierte Ergebnis. „Weiter“ führt in die Grund-Auswahl der Korrektur (`ScheduleResultEntryPrompt`, Grundpflicht
 * @EK-004); ohne Änderung bleibt „Weiter“ gesperrt und der Hinweis nennt den Grund. Abbruch speichert nichts.
 * Fläche `DialogSurface`, Fuß `DialogActions`, Eingaben über `Input` (Schrift ≥ 16 px).
 */
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../../../components/ui/Input';
import { DialogActions } from '../../../components/ui/molecules/DialogActions';
import { DialogSurface } from '../../../components/ui/molecules/DialogSurface';
import { cssVars, dialogWidths } from '../../../design-tokens';

export interface CockpitKorrekturDialogProps {
  matchNumber: number;
  homeName: string;
  awayName: string;
  /** Das bisher geltende Ergebnis (ohne Strafstoßschießen). */
  scoreHome: number;
  scoreAway: number;
  onWeiter: (home: number, away: number) => void;
  onAbbrechen: () => void;
}

const bodyStyle: CSSProperties = { padding: cssVars.spacing.lg, display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md };
const titleStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary };
const textStyle: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.lg, color: cssVars.colors.textPrimary };
const rowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: cssVars.spacing.md };
const fieldStyle: CSSProperties = { flex: '1 1 0', minWidth: 0 };
const hintStyle: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.md };

const asCount = (value: string): number | null => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : null);

export function CockpitKorrekturDialog({ matchNumber, homeName, awayName, scoreHome, scoreAway, onWeiter, onAbbrechen }: CockpitKorrekturDialogProps) {
  const { t } = useTranslation('tournament');
  const [home, setHome] = useState(String(scoreHome));
  const [away, setAway] = useState(String(scoreAway));
  const homeCount = asCount(home);
  const awayCount = asCount(away);
  const unveraendert = homeCount === scoreHome && awayCount === scoreAway;
  const hint = homeCount === null || awayCount === null ? t('correctionDialog.validation.missing') : unveraendert ? t('correctionDialog.validation.mustDiffer') : null;

  return (
    <DialogSurface isOpen onClose={onAbbrechen} maxWidth={dialogWidths.md} accent={cssVars.colors.warning} labelledBy="cockpit-korrektur-title">
      <div style={bodyStyle} data-testid="cockpit-korrektur-dialog">
        <h2 id="cockpit-korrektur-title" style={titleStyle}>{t('correctionDialog.titleMatch', { number: matchNumber })}</h2>
        <p style={textStyle}>{t('correctionDialog.currentResult')}: {homeName} {scoreHome}:{scoreAway} {awayName}</p>
        <div style={rowStyle}>
          <div style={fieldStyle}>
            <Input label={t('correctionDialog.goalsFor', { team: homeName })} type="number" min={0} step={1} value={home} onChange={setHome} data-testid="cockpit-korrektur-home" />
          </div>
          <div style={fieldStyle}>
            <Input label={t('correctionDialog.goalsFor', { team: awayName })} type="number" min={0} step={1} value={away} onChange={setAway} data-testid="cockpit-korrektur-away" />
          </div>
        </div>
        {hint !== null && <p role="status" data-testid="cockpit-korrektur-hint" style={hintStyle}>{hint}</p>}
        <DialogActions
          secondary={[{ label: t('correctionDialog.cancel'), onClick: onAbbrechen, 'data-testid': 'cockpit-korrektur-cancel' }]}
          primary={{ label: t('correctionDialog.next'), onClick: () => { if (homeCount !== null && awayCount !== null) { onWeiter(homeCount, awayCount); } }, disabled: hint !== null, 'data-testid': 'cockpit-korrektur-weiter' }}
        />
      </div>
    </DialogSurface>
  );
}
