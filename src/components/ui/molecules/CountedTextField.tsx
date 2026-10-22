/**
 * Einzeiliges Textfeld mit Zähler „n / max“ und Hinweis (A-17b, Mockup M-GA5 `.inp`): 56 px hoch (Haupttasten-Höhe),
 * 16 px Schrift (kein Zoom auf dem iPhone), Fehler mit Symbol und Wort (Farbe allein trägt nichts, VISUAL-DESIGN § 7).
 * Fachfrei: Texte und Beschriftung bestimmt der Aufrufer. Die Eingabe wird nicht verändert; `maxLength` begrenzt nativ.
 */
import { useId, type CSSProperties } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../Icons';

export interface CountedTextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  /** Zähler-Text, z. B. „4 / 40“. */
  counter: string;
  /** Hinweis unter dem Feld (z. B. „1 bis 40 Zeichen“). */
  hint?: string;
  /** Fehlertext; setzt `aria-invalid` und ersetzt den Hinweis. */
  error?: string;
  /** Eingabe sperren (z. B. während des Absendens). */
  disabled?: boolean;
  autoComplete?: string;
  'data-testid'?: string;
}

const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: cssVars.spacing.sm, marginBottom: cssVars.spacing.xs };
const labelStyle: CSSProperties = { fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary };
const counterStyle: CSSProperties = { color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs };
const hintStyle: CSSProperties = { margin: `${cssVars.spacing.xs} 0 0`, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.xs };
const errorStyle: CSSProperties = {
  display: 'flex',
  gap: cssVars.spacing.sm,
  alignItems: 'flex-start',
  margin: `${cssVars.spacing.sm} 0 0`,
  color: cssVars.colors.textPrimary,
  fontWeight: cssVars.fontWeights.semibold,
  fontSize: cssVars.fontSizes.sm,
};

export const CountedTextField = ({
  label, value, onChange, maxLength, counter, hint, error, disabled = false, autoComplete = 'off', 'data-testid': testId = 'counted-text-field',
}: CountedTextFieldProps) => {
  const id = useId();
  const messageId = `${id}-message`;
  const input: CSSProperties = {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    minHeight: cssVars.touchTargets.primary,
    padding: `0 ${cssVars.spacing.md}`,
    fontSize: cssVars.fontSizes.lg,
    fontFamily: cssVars.fontFamilies.body,
    color: cssVars.colors.textPrimary,
    background: cssVars.colors.inputBg,
    border: `${error ? cssVars.borderWidth.medium : cssVars.borderWidth.thin} solid ${error ? cssVars.colors.error : cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
  };
  return (
    <div>
      <div style={row}>
        <label htmlFor={id} style={labelStyle}>{label}</label>
        <span style={counterStyle} data-testid={`${testId}-counter`}>{counter}</span>
      </div>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        style={input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        data-testid={testId}
      />
      {error ? (
        <p id={messageId} role="alert" style={errorStyle} data-testid={`${testId}-error`}>
          <span style={{ color: cssVars.colors.error, display: 'flex' }}><Icons.AlertTriangle size={iconSizeValues.sm} /></span>
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={messageId} style={hintStyle}>{hint}</p>
      ) : null}
    </div>
  );
};
