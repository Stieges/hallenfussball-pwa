/**
 * Auswahl aus wenigen Möglichkeiten in einer Reihe (A-18a, Mockup M4 `seg big`, z. B. „Feld 1 · Feld 2 · Ohne Feld“).
 * Fachfrei. Genau eine Möglichkeit ist gewählt (`role="radiogroup"`, je Knopf `role="radio"` mit `aria-checked`). Die Wahl
 * steht nie nur in der Farbe: der gewählte Knopf ist gefüllt (Farbe des Haupttons, Schrift darauf umgekehrt) UND fett, die
 * anderen sind leer und normal. Bis vier Möglichkeiten sitzen verbunden in einem Rahmen; ab fünf stehen sie als einzelne
 * Knöpfe in umbrechenden Zeilen, damit Beschriftungen nie gekürzt werden. Jeder Knopf mindestens `touchTargets.primary` hoch.
 * Tastatur nach dem Radiogroup-Muster: ein Tab-Stopp für die Gruppe (der gewählte Knopf), Pfeiltasten wählen den nächsten oder
 * vorherigen (am Rand rundum), Pos1/Ende den ersten/letzten.
 */
import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
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
  /** Kleinere Schrift ohne inneren Rand, damit längere Wörter (z. B. „Erwachsene“) auf dem Handy nie umbrechen. */
  compact?: boolean;
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

function optionStyle(selected: boolean, disabled: boolean, connected: boolean, first: boolean, compact: boolean): CSSProperties {
  return {
    flex: connected ? undefined : '1 1 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: cssVars.touchTargets.primary,
    padding: compact ? 0 : `0 ${cssVars.spacing.xs}`,
    border: connected ? 0 : `${cssVars.borderWidth.thin} solid ${selected ? cssVars.colors.primary : cssVars.colors.borderControl}`,
    borderLeft: connected && !first ? `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}` : undefined,
    borderRadius: connected ? 0 : cssVars.borderRadius.md,
    background: selected ? cssVars.colors.primary : cssVars.colors.background,
    color: selected ? cssVars.colors.onPrimary : disabled ? cssVars.colors.textDisabled : cssVars.colors.textPrimary,
    fontFamily: 'inherit',
    fontSize: compact ? cssVars.fontSizes.md : cssVars.fontSizes.lg,
    fontWeight: selected ? cssVars.fontWeights.bold : cssVars.fontWeights.medium,
    textAlign: 'center',
    // verbunden darf die Beschriftung umbrechen (nie kürzen), einzeln bleibt sie einzeilig in umbrechenden Zeilen
    whiteSpace: connected ? 'normal' : 'nowrap',
    overflowWrap: connected ? 'anywhere' : undefined,
    minWidth: 0,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

export function SegmentedChoice<T extends string>({ legend, hint, options, value, onChange, disabled = false, testId = 'segmented-choice', compact = false }: SegmentedChoiceProps<T>) {
  const connected = options.length <= CONNECTED_MAX;
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }
    const current = options.findIndex((option) => option.value === value);
    const last = options.length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = current >= last ? 0 : current + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = current <= 0 ? last : current - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = options[next];
    if (target) {
      onChange(target.value);
      buttons.current[next]?.focus();
    }
  };
  return (
    <fieldset style={fieldset} data-testid={testId}>
      <legend style={legendStyle}>{legend}</legend>
      <div role="radiogroup" aria-label={legend} style={groupStyle(options.length)} onKeyDown={move}>
        {options.map((option, index) => (
          <button
            key={option.value}
            ref={(element) => { buttons.current[index] = element; }}
            type="button"
            role="radio"
            tabIndex={option.value === value ? 0 : -1}
            aria-checked={option.value === value}
            disabled={disabled}
            style={optionStyle(option.value === value, disabled, connected, index === 0, compact)}
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
