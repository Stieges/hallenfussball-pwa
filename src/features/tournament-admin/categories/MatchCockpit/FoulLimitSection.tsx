/**
 * FoulLimitSection: Regel „Foul-Grenze“ im Match-Cockpit-Bereich des Admin Centers (@SL-101, @W2A-037).
 * Ein neues Turnier hat die Grenze ausgeschaltet (kumulierte Fouls kennt nur BFV Teil 2, Futsal); das Cockpit zählt
 * Fouls trotzdem und zeigt nur die Zahl (@SL-102). Einschalten schlägt das 5. Foul je Halbzeit vor, jede ganze Zahl
 * von 1 bis 99 ist wählbar. Nur die Turnierleitung ändert die Regel (`locked`, @W2A-030).
 */
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../../design-tokens';
import { Input } from '../../../../components/ui';
import { ToggleSwitch } from '../../../../components/ui/atoms';
import { FOUL_LIMIT_MAX, FOUL_LIMIT_MIN, FOUL_LIMIT_SUGGESTION } from '../../../../types/tournament';

export interface FoulLimitSectionProps {
  /** Gespeicherte Grenze; `null` = ausgeschaltet. */
  value: number | null;
  locked: boolean;
  onChange: (value: number | null) => void;
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
const descStyle: CSSProperties = { ...textStyle, marginTop: cssVars.spacing.sm };
const fieldStyle: CSSProperties = { marginTop: cssVars.spacing.md, maxWidth: `calc(${cssVars.spacing.xxl} * 8)` };

/** Ganze Zahl von 1 bis 99; alles andere (leer, 0, 2.5, -1, 100) wird nicht übernommen. */
const isValidLimit = (text: string): boolean => {
  const zahl = Number(text);
  return /^\d+$/.test(text.trim()) && zahl >= FOUL_LIMIT_MIN && zahl <= FOUL_LIMIT_MAX;
};

export function FoulLimitSection({ value, locked, onChange }: FoulLimitSectionProps) {
  const { t } = useTranslation('cockpit');
  // Eingabetext; `null` = unverändert, dann gilt der gespeicherte Wert.
  const [entwurf, setEntwurf] = useState<string | null>(null);
  const ungueltig = entwurf !== null && !isValidLimit(entwurf);

  return (
    <section style={sectionStyle}>
      <h3 style={titleStyle}>{t('settings.foulLimit')}</h3>
      <div style={rowStyle}>
        <p style={textStyle}>{t('settings.foulLimitEnable')}</p>
        <ToggleSwitch
          data-testid="settings-foul-limit-enabled"
          checked={value !== null}
          disabled={locked}
          label={t('settings.foulLimitEnable')}
          onChange={(an) => { onChange(an ? FOUL_LIMIT_SUGGESTION : null); }}
        />
      </div>
      {value !== null && (
        <Input
          data-testid="settings-foul-limit"
          label={t('settings.foulLimitValue')}
          type="number"
          min={FOUL_LIMIT_MIN}
          max={FOUL_LIMIT_MAX}
          value={entwurf ?? String(value)}
          disabled={locked}
          style={fieldStyle}
          errorMessage={ungueltig ? t('settings.foulLimitInvalid', { min: FOUL_LIMIT_MIN, max: FOUL_LIMIT_MAX }) : undefined}
          onChange={(text) => {
            setEntwurf(text);
            if (isValidLimit(text)) { onChange(Number(text)); }
          }}
          onBlur={() => { setEntwurf(null); }}
        />
      )}
      <p style={descStyle}>{t('settings.foulLimitDesc')}</p>
      {locked && <p style={descStyle}>{t('settings.rulesOnlyByLead')}</p>}
    </section>
  );
}

export default FoulLimitSection;
