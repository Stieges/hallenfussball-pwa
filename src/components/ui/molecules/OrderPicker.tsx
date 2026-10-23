/**
 * Reihenfolge mit Pfeiltasten (Paket TB-B, TB-6c; Mockup v3): Zeile je Eintrag mit Platzziffer, Name und je einer Taste
 * nach oben und unten (44 px). Fachfrei. Die erste Zeile hat keine Taste nach oben, die letzte keine nach unten
 * (`disabled`, gestrichelter Rand). Der Name trägt `data-teamname`, bricht an Leerzeichen um und wird nie gekürzt.
 */
import type { CSSProperties } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../Icons';

export interface OrderPickerItem {
  id: string;
  label: string;
}

export interface OrderPickerProps {
  legend: string;
  items: readonly OrderPickerItem[];
  /** Platzziffer der ersten Zeile (z. B. 3 bei Platz 3 bis 5). */
  firstPlace: number;
  onMove: (index: number, direction: -1 | 1) => void;
  moveUpLabel: (label: string) => string;
  moveDownLabel: (label: string) => string;
}

const arrowButton = (disabled: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: cssVars.touchTargets.minimum,
  height: cssVars.touchTargets.minimum,
  padding: 0,
  background: cssVars.colors.surface,
  color: disabled ? cssVars.colors.textSecondary : cssVars.colors.textPrimary,
  border: `${cssVars.borderWidth.thin} ${disabled ? 'dashed' : 'solid'} ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.md,
  cursor: disabled ? 'not-allowed' : 'pointer',
});

export const OrderPicker = ({ legend, items, firstPlace, onMove, moveUpLabel, moveDownLabel }: OrderPickerProps) => {
  const list: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: cssVars.spacing.sm };
  const row: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `minmax(0, 1fr) ${cssVars.touchTargets.minimum} ${cssVars.touchTargets.minimum}`,
    gap: cssVars.spacing.xs,
    alignItems: 'center',
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.xs} ${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
    background: cssVars.colors.background,
  };
  const name: CSSProperties = { minWidth: 0, fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.lg, lineHeight: cssVars.lineHeights.bodyLg, overflowWrap: 'break-word', hyphens: 'manual' };
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }} data-testid="tie-order">
      <legend style={{ padding: 0, marginBottom: cssVars.spacing.sm, fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md }}>{legend}</legend>
      <ol style={list}>
        {items.map((item, index) => {
          const first = index === 0;
          const last = index === items.length - 1;
          return (
            <li key={item.id} style={row} data-testid={`tie-order-row-${item.id}`}>
              <span style={name} data-teamname>{firstPlace + index}. {item.label}</span>
              <button type="button" style={arrowButton(first)} disabled={first} aria-label={moveUpLabel(item.label)} data-testid={`tie-order-up-${item.id}`} onClick={() => onMove(index, -1)}>
                <Icons.ArrowUp size={iconSizeValues.sm} />
              </button>
              <button type="button" style={arrowButton(last)} disabled={last} aria-label={moveDownLabel(item.label)} data-testid={`tie-order-down-${item.id}`} onClick={() => onMove(index, 1)}>
                <Icons.ArrowDown size={iconSizeValues.sm} />
              </button>
            </li>
          );
        })}
      </ol>
    </fieldset>
  );
};
