/**
 * Auswahl aus wenigen Möglichkeiten in einer Reihe (A-18a, Mockup M4 `seg big`, z. B. „Feld 1 · Feld 2 · Ohne Feld“).
 * Fachfrei. Genau eine Möglichkeit ist gewählt (`role="radiogroup"`, je Knopf `role="radio"` mit `aria-checked`). Die Wahl
 * steht nie nur in der Farbe: der gewählte Knopf ist gefüllt (Farbe des Haupttons, Schrift darauf umgekehrt) UND fett, die
 * anderen sind leer und normal. Bis vier Möglichkeiten sitzen verbunden in einem Rahmen; ab fünf stehen sie als einzelne
 * Knöpfe in umbrechenden Zeilen, damit Beschriftungen nie gekürzt werden. Jeder Knopf mindestens `touchTargets.primary` hoch.
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedChoiceProps<T extends string> {
  legend: string;
  hint?: string;
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** `data-testid` des Behälters; die Knöpfe heißen `<testId>-<value>`. */
  testId?: string;
}

/** Bis zu dieser Anzahl sitzen die Möglichkeiten verbunden in einem Rahmen. */
const CONNECTED_MAX = 4;

const fieldset: CSSProperties = { border: 0, margin: 0, padding: 0, minWidth: 0 };
const legendStyle: CSSProperties = { padding: 0, margin: `0 0 ${cssVars.spacing.sm}`, fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd, color: cssVars.colors.textPrimary };
const hintStyle: CSSProperties = { margin: `${cssVars.spacing.xs} 0 0`, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };

function groupStyle(count: number): CSSProperties {
  if (count <= CONNECTED_MAX) {
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
      border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
      borderRadius: cssVars.borderRadius.md,
      overflow: 'hidden',
      background: cssVars.colors.background,
    };
  }
  return { display: 'flex', flexWrap: 'wrap', gap: cssVars.spacing.sm };
}

function optionStyle(selected: boolean, disabled: boolean, connected: boolean, first: boolean): CSSProperties {
  return {
    flex: connected ? undefined : '1 1 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: cssVars.touchTargets.primary,
    padding: `0 ${cssVars.spacing.xs}`,
    border: connected ? 0 : `${cssVars.borderWidth.thin} solid ${selected ? cssVars.colors.primary : cssVars.colors.borderControl}`,
    borderLeft: connected && !first ? `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}` : undefined,
    borderRadius: connected ? 0 : cssVars.borderRadius.md,
    background: selected ? cssVars.colors.primary : cssVars.colors.background,
    color: selected ? cssVars.colors.onPrimary : disabled ? cssVars.colors.textDisabled : cssVars.colors.textPrimary,
    fontFamily: 'inherit',
    fontSize: cssVars.fontSizes.lg,
    fontWeight: selected ? cssVars.fontWeights.bold : cssVars.fontWeights.medium,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

export function SegmentedChoice<T extends string>({ legend, hint, options, value, onChange, disabled = false, testId = 'segmented-choice' }: SegmentedChoiceProps<T>) {
  const connected = options.length <= CONNECTED_MAX;
  return (
    <fieldset style={fieldset} data-testid={testId}>
      <legend style={legendStyle}>{legend}</legend>
      <div role="radiogroup" aria-label={legend} style={groupStyle(options.length)}>
        {options.map((option, index) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            disabled={disabled}
            style={optionStyle(option.value === value, disabled, connected, index === 0)}
            data-testid={`${testId}-${option.value}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {hint ? <p style={hintStyle}>{hint}</p> : null}
    </fieldset>
  );
}
