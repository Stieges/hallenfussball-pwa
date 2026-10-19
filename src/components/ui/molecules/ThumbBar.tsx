/**
 * ThumbBar – Leiste unten im Live-Cockpit (Plan Scheibe 3, Aufgabe 3.1).
 *
 * Slots in der Reihenfolge des Aufrufers (3 bis 5 Plätze): Rückgängig links, Mehr rechts, dazwischen die
 * Hauptaktion und Nebenaktionen; ein Slot kann ein Halteknopf sein (Abpfiff). Layout `daumen`: Raster mit
 * gleich breiten Zellen, Hauptaktion höher (56 px). Layout `breit` (Laptop): eine Reihe über die ganze Breite
 * mit Gewichten, „Mehr“ nur so breit wie nötig; Tasten-Hinweise erscheinen nur hier als `<kbd>`, `aria-keyshortcuts`
 * steht immer am Knopf (@SL-153). Ein Hinweis (@HE-043) steht als eigene Zeile über den Knöpfen.
 * Safe-Area unten, links und rechts (@OB-049).
 */
import type { CSSProperties, ReactNode } from 'react';
import { cssVars } from '../../../design-tokens';
import { HoldButton } from '../atoms/HoldButton';
import type { HoldButtonProps } from '../atoms/HoldButton';

export type ThumbBarRolle = 'haupt' | 'neben' | 'mehr';
export type ThumbBarSlot =
  | {
      art: 'aktion'; label: string; sublabel?: string; icon: ReactNode; onPress: () => void; rolle: ThumbBarRolle;
      testId: string; disabled?: boolean; gestrichelt?: boolean;
      /** sichtbarer Hinweis (nur Layout breit) + aria-keyshortcuts (immer), z. B. { text: 'Leertaste', aria: 'Space' } */
      taste?: { text: string; aria: string };
    }
  | { art: 'halten'; halten: HoldButtonProps };
export interface ThumbBarProps {
  ariaLabel: string;
  slots: ThumbBarSlot[];
  layout: 'daumen' | 'breit';
  hinweis?: { text: string; testId: string };
}

/** Breite Zellen: Gewichte haupt 2 · neben 1,2 · halten 1,4; „Mehr“ nimmt nur den eigenen Platz (feste Breite als Token mit LT-2). */
const GEWICHT: Record<ThumbBarRolle, string> = { haupt: '2 1 0', neben: '1.2 1 0', mehr: '0 0 auto' };
const HALTEN_GEWICHT = '1.4 1 0';

const leisteStil: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: cssVars.spacing.xs,
  paddingTop: cssVars.spacing.sm,
  paddingBottom: `calc(${cssVars.spacing.sm} + env(safe-area-inset-bottom, 0px))`,
  paddingLeft: `calc(${cssVars.spacing.md} + env(safe-area-inset-left, 0px))`,
  paddingRight: `calc(${cssVars.spacing.md} + env(safe-area-inset-right, 0px))`,
  background: cssVars.colors.surfaceSolid,
  borderTop: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
};

const hinweisStil: CSSProperties = { fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, textAlign: 'center' };

const kbdStil: CSSProperties = {
  padding: `0 ${cssVars.spacing.xs}`,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.sm,
  fontFamily: 'inherit',
  fontSize: cssVars.fontSizes.xs,
  color: cssVars.colors.textSecondary,
};

function reiheStil(layout: ThumbBarProps['layout'], anzahl: number): CSSProperties {
  return layout === 'daumen'
    ? { display: 'grid', gridTemplateColumns: `repeat(${anzahl}, minmax(0, 1fr))`, gap: cssVars.spacing.sm, alignItems: 'stretch' }
    : { display: 'flex', gap: cssVars.spacing.sm, alignItems: 'stretch' };
}

function knopfStil(slot: Extract<ThumbBarSlot, { art: 'aktion' }>, layout: ThumbBarProps['layout']): CSSProperties {
  const haupt = slot.rolle === 'haupt';
  return {
    display: 'flex',
    flexDirection: layout === 'daumen' ? 'column' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.xs,
    minHeight: haupt ? cssVars.touchTargets.primary : cssVars.touchTargets.minimum,
    minWidth: cssVars.touchTargets.minimum,
    boxSizing: 'border-box',
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.md,
    border: haupt ? 'none' : `${cssVars.borderWidth.thin} ${slot.gestrichelt ? 'dashed' : 'solid'} ${cssVars.colors.borderControl}`,
    background: haupt ? cssVars.gradients.primary : cssVars.colors.surface,
    color: haupt ? cssVars.colors.background : cssVars.colors.textPrimary,
    fontFamily: 'inherit',
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.bold,
    cursor: slot.disabled ? 'not-allowed' : 'pointer',
    opacity: slot.disabled ? 0.5 : 1,
    touchAction: 'manipulation',
    ...(layout === 'breit'
      ? { flex: GEWICHT[slot.rolle] }
      : {}),
  };
}

function Aktion({ slot, layout }: { slot: Extract<ThumbBarSlot, { art: 'aktion' }>; layout: ThumbBarProps['layout'] }) {
  return (
    <button
      type="button"
      data-testid={slot.testId}
      data-rolle={slot.rolle}
      disabled={slot.disabled}
      aria-keyshortcuts={slot.taste?.aria}
      onClick={slot.disabled ? undefined : slot.onPress}
      style={knopfStil(slot, layout)}
    >
      {slot.icon}
      <span>{slot.label}</span>
      {slot.sublabel && <small>{slot.sublabel}</small>}
      {layout === 'breit' && slot.taste && <kbd aria-hidden="true" style={kbdStil}>{slot.taste.text}</kbd>}
    </button>
  );
}

export function ThumbBar({ ariaLabel, slots, layout, hinweis }: ThumbBarProps) {
  return (
    <div role="toolbar" aria-label={ariaLabel} data-layout={layout} style={leisteStil}>
      {hinweis && <div data-testid={hinweis.testId} style={hinweisStil}>{hinweis.text}</div>}
      <div style={reiheStil(layout, slots.length)}>
        {slots.map((slot) =>
          slot.art === 'aktion' ? (
            <Aktion key={slot.testId} slot={slot} layout={layout} />
          ) : (
            <div key={slot.halten.testId} style={layout === 'breit' ? { flex: HALTEN_GEWICHT, display: 'flex' } : { display: 'flex' }}>
              <HoldButton {...slot.halten} />
            </div>
          ),
        )}
      </div>
    </div>
  );
}
