/**
 * FoulLimitSection: Regel „Foul-Grenze“ im Match-Cockpit-Bereich des Admin Centers (@SL-101, @W2A-037).
 * Ein neues Turnier hat die Grenze ausgeschaltet (kumulierte Fouls kennt nur BFV Teil 2, Futsal); das Cockpit zählt
 * Fouls trotzdem und zeigt nur die Zahl (@SL-102). Einschalten schlägt das 5. Foul je Halbzeit vor, jede ganze Zahl
 * ab 1 ist wählbar. Nur die Turnierleitung ändert die Regel (`locked`, @W2A-030).
 */
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, touchTargets } from '../../../../design-tokens';
import { FOUL_LIMIT_SUGGESTION } from '../../../../types/tournament';

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
const checkboxStyle: CSSProperties = { width: touchTargets.minimum, height: touchTargets.minimum };
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

const isValidLimit = (text: string): boolean => /^\d+$/.test(text.trim()) && Number(text) >= 1;

export function FoulLimitSection({ value, locked, onChange }: FoulLimitSectionProps) {
  const { t } = useTranslation('cockpit');
  // Eingabetext; `null` = unverändert, dann gilt der gespeicherte Wert.
  const [entwurf, setEntwurf] = useState<string | null>(null);
  const zeigeHinweis = entwurf !== null && !isValidLimit(entwurf);

  return (
    <section style={sectionStyle}>
      <h3 style={titleStyle}>{t('settings.foulLimit')}</h3>
      <div style={rowStyle}>
        <label htmlFor="settings-foul-limit-enabled" style={textStyle}>{t('settings.foulLimitEnable')}</label>
        <input
          id="settings-foul-limit-enabled"
          data-testid="settings-foul-limit-enabled"
          type="checkbox"
          role="switch"
          checked={value !== null}
          disabled={locked}
          style={checkboxStyle}
          onChange={(e) => { onChange(e.target.checked ? FOUL_LIMIT_SUGGESTION : null); }}
        />
      </div>
      {value !== null && (
        <>
          <div style={{ ...rowStyle, marginTop: cssVars.spacing.md }}>
            <label htmlFor="settings-foul-limit" style={textStyle}>{t('settings.foulLimitValue')}</label>
            <input
              id="settings-foul-limit"
              data-testid="settings-foul-limit"
              type="number"
              inputMode="numeric"
              value={entwurf ?? String(value)}
              disabled={locked}
              aria-invalid={zeigeHinweis}
              style={locked ? { ...inputStyle, ...lockedStyle } : inputStyle}
              onChange={(e) => {
                const text = e.target.value;
                setEntwurf(text);
                if (isValidLimit(text)) { onChange(Number(text)); }
              }}
              onBlur={() => { setEntwurf(null); }}
            />
          </div>
          {zeigeHinweis && <p style={hintStyle} role="alert" data-testid="settings-foul-limit-range">{t('settings.foulLimitInvalid')}</p>}
        </>
      )}
      <p style={textStyle}>{t('settings.foulLimitDesc')}</p>
    </section>
  );
}

export default FoulLimitSection;
