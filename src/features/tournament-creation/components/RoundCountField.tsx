/**
 * Rundenzahl bei „Jeder gegen jeden“ (@TM-152, @TM-153): Eingabe 1–10 (Vorbelegung 1) mit Tippfehler-Schutz –
 * zu große oder zu kleine Werte werden auf die Grenze gesetzt und mit „Höchstens 10 Runden“ bzw. „Mindestens 1 Runde“
 * gemeldet. Darunter (`RoundCountSummary`) Spielzahl und voraussichtliches Ende; endet das Turnier gegen Mitternacht,
 * nur ein Hinweis – Weiter bleibt möglich.
 */
import { CSSProperties, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { Button, Input } from '../../../components/ui';
import type { Tournament } from '../../../types/tournament';
import { clampRoundCount, ROUND_COUNT_MAX, ROUND_COUNT_MIN, type RoundCountHint } from '../../../core/generators/repeatRounds';
import { estimateRoundRobinRounds } from '../utils/roundCountEstimate';

interface RoundCountFieldProps {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
  disabled?: boolean;
}

const rowStyle: CSSProperties = { display: 'flex', alignItems: 'flex-end', gap: cssVars.spacing.sm };
const buttonStyle: CSSProperties = { minWidth: cssVars.touchTargets.minimum, minHeight: cssVars.touchTargets.minimum };
const hintStyle: CSSProperties = { color: cssVars.colors.warning, fontSize: cssVars.fontSizes.sm, margin: `${cssVars.spacing.xs} 0 0 0` };

export const RoundCountField: React.FC<RoundCountFieldProps> = ({ formData, onUpdate, disabled = false }) => {
  const { t } = useTranslation('wizard');
  const value = clampRoundCount(formData.numberOfRounds ?? ROUND_COUNT_MIN).rounds;
  const [draft, setDraft] = useState(String(value));
  const [hint, setHint] = useState<RoundCountHint>(null);

  useEffect(() => { setDraft(String(value)); }, [value]);

  const apply = (next: number, fromTyping: boolean) => {
    const clamped = clampRoundCount(next);
    setHint(fromTyping ? clamped.hint : null);
    setDraft(String(clamped.rounds));
    onUpdate('numberOfRounds', clamped.rounds);
  };

  const handleTyping = (text: string) => {
    setDraft(text);
    if (text.trim() === '') { return; }
    const parsed = Number.parseInt(text, 10);
    if (!Number.isNaN(parsed)) { apply(parsed, true); }
  };

  return (
    <div>
      <div style={rowStyle}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => apply(value - 1, false)}
          disabled={disabled || value <= ROUND_COUNT_MIN}
          style={buttonStyle}
          aria-label={t('step2.rounds.decrease')}
          data-testid="wizard-round-count-decrease"
        >
          −
        </Button>
        <Input
          label={t('step2.rounds.label')}
          type="number"
          value={draft}
          min={ROUND_COUNT_MIN}
          max={ROUND_COUNT_MAX}
          onChange={handleTyping}
          onBlur={() => setDraft(String(value))}
          disabled={disabled}
          describedBy={hint ? 'wizard-round-count-hint' : undefined}
          data-testid="wizard-round-count-input"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => apply(value + 1, false)}
          disabled={disabled || value >= ROUND_COUNT_MAX}
          style={buttonStyle}
          aria-label={t('step2.rounds.increase')}
          data-testid="wizard-round-count-increase"
        >
          +
        </Button>
      </div>
      {hint && (
        <p id="wizard-round-count-hint" role="status" style={hintStyle} data-testid="wizard-round-count-hint">
          {t(hint === 'max' ? 'step2.rounds.maxHint' : 'step2.rounds.minHint', { count: hint === 'max' ? ROUND_COUNT_MAX : ROUND_COUNT_MIN })}
        </p>
      )}
    </div>
  );
};

const summaryStyle: CSSProperties = {
  margin: `${cssVars.spacing.md} 0 0 0`,
  color: cssVars.colors.textPrimary,
  fontSize: cssVars.fontSizes.md,
  fontWeight: cssVars.fontWeights.semibold,
};
const lateStyle: CSSProperties = {
  margin: `${cssVars.spacing.xs} 0 0 0`,
  padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
  background: cssVars.colors.warningSubtle,
  border: `1px solid ${cssVars.colors.warningBorder}`,
  borderRadius: cssVars.borderRadius.md,
  color: cssVars.colors.textPrimary,
  fontSize: cssVars.fontSizes.sm,
};

/** Spielzahl · Ende ca. hh:mm und – bei spätem Ende – der Hinweis gegen Mitternacht (@TM-153). */
export const RoundCountSummary: React.FC<{ formData: Partial<Tournament> }> = ({ formData }) => {
  const { t } = useTranslation('wizard');
  const estimate = estimateRoundRobinRounds(formData);
  if (estimate.matches === 0) { return null; }
  return (
    <div>
      <p style={summaryStyle} data-testid="wizard-round-summary">
        {estimate.endTime === null
          ? t('step2.rounds.summaryNoTime', { count: estimate.matches })
          : t('step2.rounds.summary', { count: estimate.matches, time: estimate.endTime })}
      </p>
      {estimate.endsLate && (
        <p role="status" style={lateStyle} data-testid="wizard-round-late-hint">
          {t('step2.rounds.lateHint')}
        </p>
      )}
    </div>
  );
};
