/**
 * Auswahl „Diese Plätze müssen bei Gleichstand ausgespielt werden“ (Paket TB-B, TB-6d'; Mockup v3, @W2A-066, @W2A-073).
 * Ein Chip je angebotenem Platz (1 bis Teamzahl der größten Gruppe), jeder an- und abhakbar, auch Platz 1. Fachfrei: die
 * Plätze und ihre Beschriftung bekommt der Baustein vom Aufrufer. Chip ≥ `touchTargets.comfortable`, Breite
 * `touchTargets.primary + spacing.xl + spacing.sm` (zusammengesetzt wie das Zahlenfeld, kein neues Token). Das Kästchen mit Haken
 * trägt den Zustand neben der Farbe (Symbol, nie nur Farbe).
 */
import { useState, type CSSProperties, type FocusEvent } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../Icons';

export interface PlacesToPlayOutPickerProps {
  /** Angebotene Plätze, aufsteigend. */
  places: readonly number[];
  selected: readonly number[];
  onChange: (selected: number[]) => void;
  /** Beschriftung eines Chips („Platz 3“). */
  placeLabel: (place: number) => string;
  /** Für Bildschirmleser; sichtbar steht die Überschrift beim Aufrufer. */
  legend: string;
  disabled?: boolean;
}

const CHIP_MIN_WIDTH = `calc(${cssVars.touchTargets.primary} + ${cssVars.spacing.xl} + ${cssVars.spacing.sm})`;

const Chip = ({ place, checked, label, disabled, onToggle }: { place: number; checked: boolean; label: string; disabled: boolean; onToggle: () => void }) => {
  const [focusVisible, setFocusVisible] = useState(false);
  const chip: CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.sm,
    minHeight: cssVars.touchTargets.comfortable,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    border: `${cssVars.borderWidth.thin} solid ${checked ? cssVars.colors.primary : cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
    backgroundColor: cssVars.colors.background,
    backgroundImage: checked ? `linear-gradient(${cssVars.colors.primaryLight}, ${cssVars.colors.primaryLight})` : undefined,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    lineHeight: cssVars.lineHeights.bodyMd,
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: focusVisible ? `0 0 0 3px ${cssVars.colors.focusRing}` : 'none',
  };
  const box: CSSProperties = {
    flex: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: iconSizeValues.sm,
    height: iconSizeValues.sm,
    border: `${cssVars.borderWidth.medium} solid ${checked ? cssVars.colors.primary : cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.sm,
    background: checked ? cssVars.colors.primary : cssVars.colors.background,
    color: cssVars.colors.onPrimary,
  };
  const hidden: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, opacity: 0, cursor: 'inherit' };
  return (
    <label style={chip} data-testid={`playout-chip-${String(place)}`}>
      <input
        type="checkbox"
        style={hidden}
        checked={checked}
        disabled={disabled}
        data-testid={`playout-place-${String(place)}`}
        onChange={onToggle}
        onFocus={(e: FocusEvent<HTMLInputElement>) => setFocusVisible(e.target.matches(':focus-visible'))}
        onBlur={() => setFocusVisible(false)}
      />
      <span style={box} aria-hidden="true">{checked ? <Icons.Check size={iconSizeValues.xs} /> : null}</span>
      <span style={{ minWidth: 0, overflowWrap: 'break-word' }}>{label}</span>
    </label>
  );
};

export const PlacesToPlayOutPicker = ({ places, selected, onChange, placeLabel, legend, disabled = false }: PlacesToPlayOutPickerProps) => {
  const grid: CSSProperties = { display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${CHIP_MIN_WIDTH}, 1fr))`, gap: cssVars.spacing.sm };
  const toggle = (place: number) => () => {
    const next = selected.includes(place) ? selected.filter((p) => p !== place) : [...selected, place];
    onChange(next.sort((a, b) => a - b));
  };
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }} data-testid="playout-places">
      <legend style={{ position: 'absolute', width: cssVars.sizing.hairline, height: cssVars.sizing.hairline, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>{legend}</legend>
      <div style={grid}>
        {places.map((place) => (
          <Chip key={place} place={place} checked={selected.includes(place)} label={placeLabel(place)} disabled={disabled} onToggle={toggle(place)} />
        ))}
      </div>
    </fieldset>
  );
};
