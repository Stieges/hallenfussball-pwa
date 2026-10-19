/**
 * MatchRulesSection (B-08e): Regel „Uhr-Art“ im Match-Cockpit-Bereich des Admin Centers. Nur die Turnierleitung
 * ändert sie (`locked`, @W2A-030); die Vorgabe „durchlaufend, letzte Minute angehalten“ kommt aus den Turnierdaten.
 * Gilt ab dem nächsten Anpfiff. Szenarien: @SL-002, @W2A-035.
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../../design-tokens';
import { CLOCK_MODES, type ClockMode } from '../../../../core/match/clockDisplay';

export interface MatchRulesSectionProps {
  value: ClockMode;
  locked: boolean;
  onChange: (value: ClockMode) => void;
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
  fontSize: cssVars.fontSizes.md,
  color: cssVars.colors.textPrimary,
  backgroundColor: cssVars.colors.surface,
  border: `1px solid ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.md,
};

export function MatchRulesSection({ value, locked, onChange }: MatchRulesSectionProps) {
  const { t } = useTranslation('cockpit');
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
      {locked && <p style={textStyle}>{t('settings.rulesOnlyByLead')}</p>}
    </section>
  );
}

export default MatchRulesSection;
