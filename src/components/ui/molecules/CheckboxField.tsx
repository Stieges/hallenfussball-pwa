/**
 * Ankreuzfeld mit Beschriftung und optionalem Hinweis darunter (B-14, @W1-031: „am Häkchen steht vorher, wer die Angaben
 * sehen kann“). Die ganze Zeile ist Klickfläche, mindestens so hoch wie ein Touch-Ziel. Nur Design-Tokens.
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';

export interface CheckboxFieldProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Erklärung unter der Beschriftung, etwa wer die Angaben sieht */
  hint?: string;
  /** Gesperrt (etwa Regel nur für die Turnierleitung): nicht anklickbar, Zeiger ohne Hand */
  disabled?: boolean;
  /** Zugänglicher Name, wenn die sichtbare Beschriftung allein nicht genügt (mehrere gleiche Felder, etwa je Team); enthält den sichtbaren Text. */
  ariaLabel?: string;
  'data-testid'?: string;
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: cssVars.spacing.sm,
  minHeight: cssVars.touchTargets.minimum,
  paddingTop: cssVars.spacing.sm,
  paddingBottom: cssVars.spacing.sm,
  cursor: 'pointer',
};

const boxStyle: CSSProperties = {
  width: cssVars.iconSizes.sm,
  height: cssVars.iconSizes.sm,
  marginTop: cssVars.spacing.xs,
  flexShrink: 0,
  cursor: 'pointer',
  accentColor: cssVars.colors.primary,
};

const labelStyle: CSSProperties = {
  color: cssVars.colors.textPrimary,
  fontSize: cssVars.fontSizes.sm,
};

const hintStyle: CSSProperties = {
  display: 'block',
  marginTop: cssVars.spacing.xs,
  color: cssVars.colors.textSecondary,
  fontSize: cssVars.fontSizes.xs,
};

export function CheckboxField({ checked, onChange, label, hint, disabled = false, ariaLabel, 'data-testid': testId }: CheckboxFieldProps) {
  return (
    <label style={disabled ? { ...rowStyle, cursor: 'default' } : rowStyle}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        aria-label={ariaLabel}
        style={disabled ? { ...boxStyle, cursor: 'default' } : boxStyle}
        data-testid={testId}
      />
      <span>
        <span style={labelStyle}>{label}</span>
        {hint !== undefined && <span style={hintStyle}>{hint}</span>}
      </span>
    </label>
  );
}
