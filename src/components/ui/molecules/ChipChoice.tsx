/**
 * Auswahl-Chips in einer wischbaren Reihe (Mockup „Altersklasse“, Variante B2). Fachfrei: kennt nur Wert und Beschriftung.
 * Genau ein Chip ist gewählt oder keiner; erneutes Antippen des gewählten ruft `onSelect` mit demselben Wert auf, der
 * Aufrufer entscheidet, ob er die Wahl aufhebt. Die Wahl steht nie nur in der Farbe: gewählt trägt Häkchen, Fettschrift und
 * gefüllten Grund. Der gewählte Chip wird in der Reihe sichtbar gehalten. Jeder Chip mindestens `touchTargets.minimum` hoch.
 * `role="group"` mit `aria-pressed` je Chip (kein Radio, weil die Wahl aufhebbar ist).
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import { ChipButton } from '../atoms/ChipButton';

export interface ChipOption {
  value: string;
  label: string;
}

export interface ChipChoiceProps {
  /** Gesprochener Name der Gruppe. */
  legend: string;
  options: ReadonlyArray<ChipOption>;
  /** Gewählter Wert; `null` oder ein unbekannter Wert wählt nichts. */
  value: string | null;
  onSelect: (value: string) => void;
  /** `data-testid` der Reihe; die Chips heißen `<testId>-<value>`. */
  testId?: string;
}

const rowStyle: CSSProperties = {
  // Bezugspunkt für `offsetLeft` der Chips beim Zentrieren des gewählten Chips
  position: 'relative',
  display: 'flex',
  gap: cssVars.spacing.sm,
  overflowX: 'auto',
  padding: `${cssVars.spacing.xs} 0`,
  // Schmale Leiste bleibt sichtbar: am Desktop sind sonst die hinteren Chips ohne Trackpad nicht erreichbar
  scrollbarWidth: 'thin',
  WebkitOverflowScrolling: 'touch',
};

export function ChipChoice({ legend, options, value, onSelect, testId = 'chip-choice' }: ChipChoiceProps) {
  const row = useRef<HTMLDivElement | null>(null);
  const selected = useRef<HTMLButtonElement | null>(null);

  // Den gewählten Chip in die Reihe holen, ohne die Seite selbst zu bewegen.
  useEffect(() => {
    const container = row.current;
    const chip = selected.current;
    if (!container || !chip) {
      return;
    }
    const left = chip.offsetLeft;
    const right = left + chip.offsetWidth;
    if (left < container.scrollLeft || right > container.scrollLeft + container.clientWidth) {
      container.scrollLeft = left - (container.clientWidth - chip.offsetWidth) / 2;
    }
  }, [value]);

  return (
    <div ref={row} role="group" aria-label={legend} style={rowStyle} data-testid={testId}>
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <ChipButton
            key={option.value}
            ref={isSelected ? selected : undefined}
            selected={isSelected}
            data-testid={`${testId}-${option.value}`}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </ChipButton>
        );
      })}
    </div>
  );
}
