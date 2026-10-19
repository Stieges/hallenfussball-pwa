/**
 * ScoreDraftInput – Zahlenfeld für Tore, gedacht für `useScoreDraft` (@FU-101).
 * Mindestens 16 px Schrift und Touch-Höhe; Korrekturmodus und ungültige Eingabe sind am Rahmen sichtbar.
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import type { ScoreFieldProps } from '../molecules/useScoreDraft';

export interface ScoreDraftInputProps extends ScoreFieldProps {
  ariaLabel: string;
  testId: string;
  inCorrectionMode?: boolean;
  invalid?: boolean;
}

const baseStyle: CSSProperties = {
  width: cssVars.touchTargets.minimum,
  height: cssVars.touchTargets.minimum,
  padding: cssVars.spacing.xs,
  border: `1px solid ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.sm,
  fontSize: cssVars.fontSizes.lg,
  fontWeight: cssVars.fontWeights.bold,
  textAlign: 'center',
  backgroundColor: cssVars.colors.background,
  color: cssVars.colors.textPrimary,
};

const correctionStyle: CSSProperties = {
  border: `2px solid ${cssVars.colors.warning}`,
  backgroundColor: cssVars.colors.warningLight,
};

const invalidStyle: CSSProperties = {
  border: `2px solid ${cssVars.colors.error}`,
};

export const ScoreDraftInput: React.FC<ScoreDraftInputProps> = ({
  ariaLabel, testId, inCorrectionMode = false, invalid = false, ...fieldProps
}) => (
  <input
    {...fieldProps}
    type="number"
    inputMode="numeric"
    min="0"
    step="1"
    placeholder="–"
    aria-label={ariaLabel}
    aria-invalid={invalid || undefined}
    data-testid={testId}
    style={{ ...baseStyle, ...(inCorrectionMode ? correctionStyle : {}), ...(invalid ? invalidStyle : {}) }}
  />
);
