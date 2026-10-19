/**
 * MatchRulesSection (B-08e): Regel „Uhr-Art“ im Match-Cockpit-Bereich des Admin Centers. Nur die Turnierleitung
 * ändert sie (`locked`, @W2A-030); die Vorgabe „durchlaufend, letzte Minute angehalten“ kommt aus den Turnierdaten.
 * Gilt ab dem nächsten Anpfiff. Bei „durchlaufend, letzte Minute angehalten“ stellt sie außerdem die Länge der
 * angehaltenen Schlussphase ein (1 bis 5 Minuten, @W2A-040). Szenarien: @SL-002, @W2A-035, @W2A-040.
 */
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, touchTargets } from '../../../../design-tokens';
import { CLOCK_MODES, finalPhaseValid, type ClockMode } from '../../../../core/match/clockDisplay';

export interface MatchRulesSectionProps {
  value: ClockMode;
  locked: boolean;
  onChange: (value: ClockMode) => void;
  /** Gespeicherte Länge der angehaltenen Schlussphase in Minuten (@W2A-040). */
  finalPhaseMinutes: number;
  /** Länge eines Abschnitts in Sekunden; begrenzt die Schlussphase nach oben. */
  sectionSeconds: number;
  onFinalPhaseChange: (minutes: number) => void;
}

const sectionStyle: CSSProperties = { marginBottom: cssVars.spacing.lg };
const titleStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.lg,
  fontWeight: cssVars.fontWeights.semibold,
  color: cssVars.colors.textPrimary,
  margin: 0,
  marginBottom: cssVars.spacing.sm,
};
const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: cssVars.spacing.md,
  flexWrap: 'wrap',
};
const textStyle: CSSProperties = { fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, margin: 0 };
const selectStyle: CSSProperties = {
  padding: cssVars.spacing.sm,
  paddingRight: cssVars.spacing.xl,
  minHeight: touchTargets.minimum,
  fontSize: cssVars.fontSizes.lg,
  color: cssVars.colors.textPrimary,
  backgroundColor: cssVars.colors.surface,
  border: `1px solid ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.md,
};

const inputStyle: CSSProperties = {
  width: touchTargets.primary,
  height: touchTargets.primary,
  textAlign: 'center',
  fontSize: cssVars.fontSizes.lg,
  color: cssVars.colors.textPrimary,
  backgroundColor: cssVars.colors.surface,
  border: `1px solid ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.md,
};
const lockedStyle: CSSProperties = { opacity: 0.5, cursor: 'not-allowed' };
const hintStyle: CSSProperties = { ...textStyle, color: cssVars.colors.error };

export function MatchRulesSection({
  value, locked, onChange, finalPhaseMinutes, sectionSeconds, onFinalPhaseChange,
}: MatchRulesSectionProps) {
  const { t } = useTranslation('cockpit');
  // Eingabetext der Schlussphase; `null` = unverändert, dann gilt der gespeicherte Wert.
  const [entwurf, setEntwurf] = useState<string | null>(null);
  const check = finalPhaseValid({ finalPhaseMinutes: entwurf === null ? finalPhaseMinutes : Number(entwurf) }, sectionSeconds);
  const zeigeHinweis = entwurf !== null && !check.valid;
  const hinweis = check.range === null
    ? t('settings.finalPhaseTooShort')
    : check.range.max === 1
      ? t('settings.finalPhaseRangeOne')
      : t('settings.finalPhaseRange', { max: check.range.max });

  const optionen: { value: ClockMode; label: string }[] = [
    { value: CLOCK_MODES[0], label: t('settings.clockModeLastMinute') },
    { value: CLOCK_MODES[1], label: t('settings.clockModeAlwaysRunning') },
    { value: CLOCK_MODES[2], label: t('settings.clockModeAlwaysStopped') },
  ];

  return (
    <section style={sectionStyle}>
      <h3 style={titleStyle}>{t('settings.clockMode')}</h3>
      <div style={rowStyle}>
        <p style={textStyle}>{t('settings.clockModeDesc')}</p>
        <select
          data-testid="settings-clock-mode"
          aria-label={t('settings.clockMode')}
          value={value}
          disabled={locked}
          style={selectStyle}
          onChange={(e) => {
            const gewaehlt = optionen.find((option) => option.value === e.target.value);
            if (gewaehlt) { onChange(gewaehlt.value); }
          }}
        >
          {optionen.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      {value === CLOCK_MODES[0] && (
        <>
          <div style={{ ...rowStyle, marginTop: cssVars.spacing.md }}>
            <label htmlFor="settings-final-phase-minutes" style={textStyle}>{t('settings.finalPhaseMinutes')}</label>
            <input
              id="settings-final-phase-minutes"
              data-testid="settings-final-phase-minutes"
              type="number"
              inputMode="numeric"
              value={entwurf ?? String(finalPhaseMinutes)}
              disabled={locked}
              aria-invalid={zeigeHinweis}
              style={locked ? { ...inputStyle, ...lockedStyle } : inputStyle}
              onChange={(e) => {
                const text = e.target.value;
                setEntwurf(text);
                if (finalPhaseValid({ finalPhaseMinutes: Number(text) }, sectionSeconds).valid) {
                  onFinalPhaseChange(Number(text));
                }
              }}
              onBlur={() => { setEntwurf(null); }}
            />
          </div>
          {zeigeHinweis && <p style={hintStyle} role="alert" data-testid="settings-final-phase-range">{hinweis}</p>}
          <p style={textStyle}>{t('settings.finalPhaseDesc')}</p>
        </>
      )}
      {locked && <p style={textStyle}>{t('settings.rulesOnlyByLead')}</p>}
    </section>
  );
}

export default MatchRulesSection;
