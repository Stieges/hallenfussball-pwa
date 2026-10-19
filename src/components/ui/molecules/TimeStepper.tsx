/**
 * TimeStepper (B-08d): fachfrei. Ein Zähler mit zwei Knöpfen, der einen Wert in Schritten verändert und
 * auf [min, max] begrenzt. Die Anzeige formatiert der Aufrufer (`format`), der Stepper kennt keine Spielzeit.
 * Der erste Schritt führt auf das Raster der Schrittweite (5:23 → 5:20 bzw. 5:30), danach in vollen Schritten.
 * Ein Knopf an der Grenze ist deaktiviert; über die Grenze hinaus meldet er nichts.
 */
import type { CSSProperties } from 'react';
import { cssVars, touchTargets } from '../../../design-tokens';

export interface TimeStepperProps {
  value: number;
  min: number;
  max: number;
  /** Schritt je Knopfdruck, in derselben Einheit wie `value`. */
  step: number;
  format: (value: number) => string;
  labelDecrease: string;
  labelIncrease: string;
  onChange: (value: number) => void;
  testId?: string;
}

const button: CSSProperties = {
  width: touchTargets.primary,
  height: touchTargets.primary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: cssVars.colors.surface,
  color: cssVars.colors.textPrimary,
  border: 'none',
  borderRadius: cssVars.borderRadius.md,
  fontSize: cssVars.fontSizes.xl,
  cursor: 'pointer',
};

const buttonDisabled: CSSProperties = { opacity: 0.4, cursor: 'not-allowed' };

const valueStyle: CSSProperties = {
  fontSize: cssVars.fontSizes.xl,
  fontWeight: 700,
  color: cssVars.colors.textPrimary,
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'center',
};

export function TimeStepper({ value, min, max, step, format, labelDecrease, labelIncrease, onChange, testId }: TimeStepperProps) {
  // Der erste Schritt springt aufs Raster (Vielfache von `step`): 323 → 320 / 330, danach volle Schritte.
  const weniger = Math.max(min, (Math.ceil(value / step) - 1) * step);
  const mehr = Math.min(max, (Math.floor(value / step) + 1) * step);
  const minusAus = value <= min;
  const plusAus = value >= max;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.md }} data-testid={testId}>
      <button
        type="button"
        aria-label={labelDecrease}
        disabled={minusAus}
        style={minusAus ? { ...button, ...buttonDisabled } : button}
        onClick={() => { if (!minusAus) { onChange(weniger); } }}
        data-testid={testId ? `${testId}-minus` : undefined}
      >
        −
      </button>
      <span style={valueStyle} aria-live="polite">{format(value)}</span>
      <button
        type="button"
        aria-label={labelIncrease}
        disabled={plusAus}
        style={plusAus ? { ...button, ...buttonDisabled } : button}
        onClick={() => { if (!plusAus) { onChange(mehr); } }}
        data-testid={testId ? `${testId}-plus` : undefined}
      >
        +
      </button>
    </div>
  );
}

export default TimeStepper;
