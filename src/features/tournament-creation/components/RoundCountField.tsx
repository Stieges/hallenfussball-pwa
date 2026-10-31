/**
 * Rundenzahl bei „Jeder gegen jeden“ (@TM-152, @TM-153): Eingabe 1–10 (Vorbelegung 1) mit Tippfehler-Schutz –
 * zu große oder zu kleine Werte werden auf die Grenze gesetzt und mit „Höchstens 10 Runden“ bzw. „Mindestens 1 Runde“
 * gemeldet. Aufbau wie `NumberStepper` (−, Anzeige, +), die Anzeige ist hier tippbar. Darunter (`RoundCountSummary`)
 * Spielzahl und Ende aus dem erzeugten Plan; Weiter bleibt immer möglich.
 */
import { CSSProperties, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { Button } from '../../../components/ui';
import type { Tournament } from '../../../types/tournament';
import { clampRoundCount, ROUND_COUNT_MAX, ROUND_COUNT_MIN, type RoundCountHint } from '../../../core/generators/repeatRounds';
import { estimateRoundRobinRounds } from '../utils/roundCountEstimate';

interface RoundCountFieldProps {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
  disabled?: boolean;
}

const containerStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs };
const labelStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.sm,
  fontWeight: cssVars.fontWeights.medium,
  color: cssVars.colors.textPrimary,
};
const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm };
const buttonStyle: CSSProperties = { minWidth: cssVars.touchTargets.minimum, height: cssVars.touchTargets.minimum };
// wie die Anzeige im NumberStepper; Schrift 16 px (fontSizes.lg) gegen den Zoom auf iOS
const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  width: '100%',
  minHeight: cssVars.touchTargets.minimum, // tippbar: Touch ≥ 44 px (die Anzeige im NumberStepper ist nicht bedienbar)
  boxSizing: 'border-box',
  textAlign: 'center',
  fontFamily: 'inherit',
  fontSize: cssVars.fontSizes.lg,
  fontWeight: cssVars.fontWeights.semibold,
  color: cssVars.colors.textPrimary,
  padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
  background: cssVars.colors.surface,
  borderRadius: cssVars.borderRadius.md,
  border: `1px solid ${cssVars.colors.borderControl}`,
};
const hintStyle: CSSProperties = { color: cssVars.colors.warning, fontSize: cssVars.fontSizes.sm, margin: 0 };

export const RoundCountField: React.FC<RoundCountFieldProps> = ({ formData, onUpdate, disabled = false }) => {
  const { t } = useTranslation('wizard');
  const inputId = useId();
  const hintId = `${inputId}-hint`;
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
    const digits = text.replace(/[^0-9]/g, '');
    setDraft(digits);
    if (digits === '') { return; }
    apply(Number.parseInt(digits, 10), true);
  };

  return (
    <div style={containerStyle}>
      <label htmlFor={inputId} style={labelStyle}>{t('step2.rounds.label')}</label>
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
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={draft}
          onChange={(event) => handleTyping(event.target.value)}
          onBlur={() => setDraft(String(value))}
          disabled={disabled}
          aria-describedby={hintId}
          style={inputStyle}
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
      {/* Live-Region bleibt stehen, nur der Text wechselt – so sagen Screenreader den Hinweis an */}
      <p id={hintId} role="status" aria-live="polite" style={hintStyle} data-testid="wizard-round-count-hint">
        {hint === null
          ? null
          : t(hint === 'max' ? 'step2.rounds.maxHint' : 'step2.rounds.minHint', { count: hint === 'max' ? ROUND_COUNT_MAX : ROUND_COUNT_MIN })}
      </p>
    </div>
  );
};

const summaryStyle: CSSProperties = {
  margin: `${cssVars.spacing.md} 0 0 0`,
  color: cssVars.colors.textPrimary,
  fontSize: cssVars.fontSizes.md,
  fontWeight: cssVars.fontWeights.semibold,
};

/** „<n> Spiele · Ende ca. hh:mm“ aus dem erzeugten Plan (@TM-153). */
export const RoundCountSummary: React.FC<{ formData: Partial<Tournament> }> = ({ formData }) => {
  const { t } = useTranslation('wizard');
  const {
    numberOfTeams, numberOfFields, numberOfRounds, groupSystem, startTime, timeSlot, teams, groupPhaseGameDuration,
    groupPhaseBreakDuration, gamePeriods, halftimeBreak, minRestSlots, hostTeamIds, openingMode,
  } = formData;
  const estimate = useMemo(() => estimateRoundRobinRounds({
    numberOfTeams, numberOfFields, numberOfRounds, groupSystem, startTime, timeSlot, teams, groupPhaseGameDuration,
    groupPhaseBreakDuration, gamePeriods, halftimeBreak, minRestSlots, hostTeamIds, openingMode,
  }), [numberOfTeams, numberOfFields, numberOfRounds, groupSystem, startTime, timeSlot, teams, groupPhaseGameDuration,
    groupPhaseBreakDuration, gamePeriods, halftimeBreak, minRestSlots, hostTeamIds, openingMode]);
  if (estimate.matches === 0) { return null; }
  return (
    <p style={summaryStyle} data-testid="wizard-round-summary">
      {estimate.endTime === null
        ? t('step2.rounds.summaryNoTime', { count: estimate.matches })
        : t('step2.rounds.summary', { count: estimate.matches, time: estimate.endTime })}
    </p>
  );
};
