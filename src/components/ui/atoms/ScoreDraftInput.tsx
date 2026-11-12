/**
 * ScoreDraftInput – Feld für Tore, gedacht für `useScoreDraft` (@FU-101).
 * Ein Textfeld mit Ziffernblock (`inputMode="numeric"`, `pattern`), kein Zahlenfeld: Pfeiltasten und Mausrad ändern nichts, es gibt keine
 * nativen Pfeile, und nur Ziffern bleiben stehen (höchstens `MAX_GOAL_DIGITS` Stellen, also bis 99). So kann „-3“, „1e2“ oder „2,5“ nie im
 * Feld stehen. Mindestens 16 px Schrift und Touch-Höhe; ungültige Eingabe ist am Rahmen sichtbar. `large`: das große Feld des Blatts „Endergebnis“.
 */
import type { ChangeEvent, CSSProperties, FocusEvent, KeyboardEvent, Ref } from 'react';
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
  /** Ziffernblock-Taste: erstes Feld „next“, zweites „done“ (@FU-101) */
  enterKeyHint: 'next' | 'done';
  /** Ref auf das Eingabefeld (Enter im ersten Feld springt ins zweite) */
  inputRef: Ref<HTMLInputElement>;
}

/** Längste Eingabe: zwei Stellen, also bis 99 Tore */
const MAX_GOAL_DIGITS = 2;

export interface ScoreDraftInputProps extends ScoreFieldProps {
  ariaLabel: string;
  testId: string;
  /** Großes Feld (Blatt „Endergebnis“): `sizing.scoreField` Kantenlänge, große Ziffer */
  large?: boolean;
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

const largeStyle: CSSProperties = {
  width: cssVars.sizing.scoreField,
  height: cssVars.sizing.scoreField,
  fontSize: cssVars.fontSizes.xxl,
};

const invalidStyle: CSSProperties = {
  border: `${cssVars.borderWidth.medium} solid ${cssVars.colors.error}`,
};

export const ScoreDraftInput: React.FC<ScoreDraftInputProps> = ({
  ariaLabel, testId, invalid, describedBy, inputRef, large = false, onChange, ...handlers
}) => (
  <input
    {...handlers}
    ref={inputRef}
    type="text"
    inputMode="numeric"
    pattern="[0-9]*"
    maxLength={MAX_GOAL_DIGITS}
    autoComplete="off"
    onChange={(event) => {
      // Nur Ziffern, höchstens zwei Stellen: alles andere (Minus, „e“, Komma, Buchstaben) bleibt nicht stehen
      const digits = event.target.value.replace(/\D/g, '').slice(0, MAX_GOAL_DIGITS);
      if (digits !== event.target.value) { event.target.value = digits; }
      onChange(event);
    }}
    aria-label={ariaLabel}
    aria-invalid={invalid || undefined}
    aria-describedby={invalid ? describedBy : undefined}
    data-testid={testId}
    style={{ ...baseStyle, ...(large ? largeStyle : {}), ...(invalid ? invalidStyle : {}) }}
  />
);
