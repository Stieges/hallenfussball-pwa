/**
 * ScoreDraftInput – Zahlenfeld für Tore, gedacht für `useScoreDraft` (@FU-101).
 * Mindestens 16 px Schrift und Touch-Höhe; Korrekturmodus und ungültige Eingabe sind am Rahmen sichtbar.
 */
import type { ChangeEvent, CSSProperties, FocusEvent, KeyboardEvent } from 'react';
import { cssVars } from '../../../design-tokens';

/** Was `useScoreDraft` je Feld liefert */
export interface ScoreFieldProps {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur: (event: FocusEvent<HTMLInputElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** Dieses Feld enthält keine ganze Zahl ab 0 */
  invalid: boolean;
  /** Id des Hinweises, solange er sichtbar ist */
  describedBy?: string;
}

export interface ScoreDraftInputProps extends ScoreFieldProps {
  ariaLabel: string;
  testId: string;
  inCorrectionMode?: boolean;
}

const baseStyle: CSSProperties = {
  width: cssVars.touchTargets.minimum,
  height: cssVars.touchTargets.minimum,
  padding: cssVars.spacing.xs,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.sm,
  fontSize: cssVars.fontSizes.lg,
  fontWeight: cssVars.fontWeights.bold,
  textAlign: 'center',
  backgroundColor: cssVars.colors.background,
  color: cssVars.colors.textPrimary,
};

const correctionStyle: CSSProperties = {
  border: `${cssVars.borderWidth.medium} solid ${cssVars.colors.warning}`,
  backgroundColor: cssVars.colors.warningLight,
};

const invalidStyle: CSSProperties = {
  border: `${cssVars.borderWidth.medium} solid ${cssVars.colors.error}`,
};

export const ScoreDraftInput: React.FC<ScoreDraftInputProps> = ({
  ariaLabel, testId, inCorrectionMode = false, invalid, describedBy, ...handlers
}) => (
  <input
    {...handlers}
    type="number"
    inputMode="numeric"
    min="0"
    step="1"
    placeholder="–"
    aria-label={ariaLabel}
    aria-invalid={invalid || undefined}
    aria-describedby={invalid ? describedBy : undefined}
    data-testid={testId}
    style={{ ...baseStyle, ...(inCorrectionMode ? correctionStyle : {}), ...(invalid ? invalidStyle : {}) }}
  />
);
