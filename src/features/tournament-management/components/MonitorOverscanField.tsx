/**
 * Regler für den Bildrand eines Monitors in Prozent je Seite (@ME-067, @ME-020).
 *
 * Wirkt am Monitor nach dessen nächstem Abruf (höchstens 10 Sekunden) auf alle Bildschirme, die dasselbe Bild zeigen.
 */
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import { MONITOR_OVERSCAN, istGueltigerRand } from '../../../types/monitor';

interface MonitorOverscanFieldProps {
  /** Gespeicherter Rand in Prozent; ohne Angabe gilt die Vorbelegung. */
  value: number | undefined;
  onChange: (prozent: number) => void;
}

const groupStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs };
const labelStyle: CSSProperties = { fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary };
const rangeLabelsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: cssVars.fontSizes.xs,
  color: cssVars.colors.textSecondary,
};

export function MonitorOverscanField({ value, onChange }: MonitorOverscanFieldProps) {
  const { t } = useTranslation('tournament');
  const prozent = istGueltigerRand(value) ? value : MONITOR_OVERSCAN.defaultPercent;
  const hinweisId = 'monitor-overscan-hint';

  return (
    <div style={groupStyle}>
      <label htmlFor="monitor-overscan-input" style={labelStyle}>
        {t('monitorEditor.settings.overscan', { prozent: t('monitorEditor.settings.overscanValue', { prozent }) })}
      </label>
      <input
        id="monitor-overscan-input"
        data-testid="monitor-overscan-input"
        type="range"
        min={MONITOR_OVERSCAN.minPercent}
        max={MONITOR_OVERSCAN.maxPercent}
        step={MONITOR_OVERSCAN.stepPercent}
        value={prozent}
        aria-describedby={hinweisId}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: cssVars.colors.primary }}
      />
      <div style={rangeLabelsStyle}>
        <span>{t('monitorEditor.settings.noMargin')}</span>
        <span>{t('monitorEditor.settings.overscanValue', { prozent: MONITOR_OVERSCAN.maxPercent })}</span>
      </div>
      <div id={hinweisId} style={rangeLabelsStyle}>{t('monitorEditor.settings.overscanHint', { prozent: MONITOR_OVERSCAN.defaultPercent })}</div>
    </div>
  );
}
