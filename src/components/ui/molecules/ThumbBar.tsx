/**
 * ThumbBar – Leiste unten im Live-Cockpit (Plan Scheibe 3, Aufgabe 3.1).
 *
 * Slots in der Reihenfolge des Aufrufers (3 bis 5 Plätze): Rückgängig links, Mehr rechts, dazwischen die
 * Hauptaktion und Nebenaktionen; ein Slot kann ein Halteknopf sein (Abpfiff). Layout `daumen`: Raster mit
 * gleich breiten Zellen, Hauptaktion höher (56 px). Layout `breit` (Laptop): eine Reihe über die ganze Breite
 * mit Gewichten, „Mehr“ nur so breit wie nötig; Tasten-Hinweise erscheinen nur hier als `<kbd>`, `aria-keyshortcuts`
 * steht immer am Knopf (@SL-153). Ein Hinweis (@HE-043) steht als eigene Zeile über den Knöpfen.
 * Safe-Area unten, links und rechts (@OB-049). Werkzeugleisten-Muster (S5): Pfeil links/rechts, Pos1 und Ende wechseln den
 * Fokus; nur ein Knopf ist per Tab erreichbar (Roving Tabindex), gesperrte Knöpfe werden übersprungen.
 */
import { useState } from 'react';
import type { CSSProperties, FocusEvent, KeyboardEvent, ReactNode } from 'react';
import { cssVars } from '../../../design-tokens';
import { HoldButton } from '../atoms/HoldButton';
import type { HoldButtonProps } from '../atoms/HoldButton';

export type ThumbBarRolle = 'haupt' | 'neben' | 'mehr';
export type ThumbBarSlot =
  | {
      art: 'aktion'; label: string; sublabel?: string; icon: ReactNode; onPress: () => void; rolle: ThumbBarRolle;
      testId: string; disabled?: boolean; gestrichelt?: boolean;
      /** Zugänglicher Name, wenn er mehr nennt als der sichtbare Text (muss den sichtbaren Text enthalten, WCAG 2.5.3) */
      ariaLabel?: string;
      /** sichtbarer Hinweis (nur Layout breit) + aria-keyshortcuts (immer), z. B. { text: 'Leertaste', aria: 'Space' } */
      taste?: { text: string; aria: string };
    }
  | { art: 'halten'; halten: HoldButtonProps };
export interface ThumbBarProps {
  ariaLabel: string;
  slots: ThumbBarSlot[];
  layout: 'daumen' | 'breit';
  hinweis?: { text: string; testId: string };
  /** Tasten-Hinweise (`<kbd>`) zeigen: nur mit Maus oder Trackpad (Tablet und Handy haben keine Tasten); Vorgabe: im Layout `breit` immer. */
  tastenChips?: boolean;
}

/** Breite Zellen: Gewichte haupt 2 · neben 1,2 · halten 1,4; „Mehr“ hat die feste Breite `cockpitMehrBreit`. */
const GEWICHT: Record<ThumbBarRolle, string> = { haupt: '2 1 0', neben: '1.2 1 0', mehr: '0 0 auto' };
const MEHR_BREIT = cssVars.sizing.cockpitMehrBreit;
const HALTEN_GEWICHT = '1.4 1 0';

function leisteStil(layout: ThumbBarProps['layout']): CSSProperties {
  // Handy: schmaler seitlicher Rand, damit fünf Plätze auch mit weiten Textabständen in 360 px passen (K13)
  const seite = layout === 'daumen' ? cssVars.spacing.xs : cssVars.spacing.md;
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs,
    paddingTop: cssVars.spacing.sm,
    paddingBottom: `calc(${cssVars.spacing.sm} + env(safe-area-inset-bottom, 0px))`,
    paddingLeft: `calc(${seite} + env(safe-area-inset-left, 0px))`,
    paddingRight: `calc(${seite} + env(safe-area-inset-right, 0px))`,
    background: cssVars.colors.surfaceSolid,
    borderTop: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  };
}

const hinweisStil: CSSProperties = { fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, textAlign: 'center' };

/** Auf der Hauptaktion (Vollfläche) erbt der Hinweis die Schriftfarbe der Fläche, sonst fiele er unter 4,5 : 1 (visuelle Prüfung, kontrast.text) */
function kbdStil(haupt: boolean): CSSProperties {
  return {
    padding: `0 ${cssVars.spacing.xs}`,
    border: `${cssVars.borderWidth.thin} solid ${haupt ? 'currentColor' : cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.sm,
    fontFamily: 'inherit',
    fontSize: cssVars.fontSizes.xs,
    color: haupt ? cssVars.colors.onPrimary : cssVars.colors.textSecondary,
  };
}

function reiheStil(layout: ThumbBarProps['layout'], anzahl: number): CSSProperties {
  return layout === 'daumen'
    // Handy: gleich breite Zellen, aber nie schmaler als ihr Inhalt (Text wird nie abgeschnitten, K13); kleinere Abstände, damit fünf Plätze in 360 px passen
    ? { display: 'grid', gridTemplateColumns: `repeat(${anzahl}, minmax(min-content, 1fr))`, gap: cssVars.spacing.xs, alignItems: 'stretch' }
    // Laptop: die Reihe hat die Höhe `cockpitLeisteBreit` (Mockup: 80 px mit dem Innenabstand der Leiste)
    : { display: 'flex', gap: cssVars.spacing.sm, alignItems: 'stretch', minHeight: cssVars.sizing.cockpitLeisteBreit };
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
    padding: layout === 'daumen' ? `${cssVars.spacing.xs} 0` : `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.md,
    border: haupt ? 'none' : `${cssVars.borderWidth.thin} ${slot.gestrichelt ? 'dashed' : 'solid'} ${cssVars.colors.borderControl}`,
    // K8 (C-PRIMAER-VERLAUF-KONTRAST): Vollfläche wie `Button` primary (#274), kein Verlauf
    background: haupt ? cssVars.colors.primary : cssVars.colors.surface,
    color: haupt ? cssVars.colors.onPrimary : cssVars.colors.textPrimary,
    fontFamily: 'inherit',
    fontSize: layout === 'daumen' ? cssVars.fontSizes.sm : cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.bold,
    cursor: slot.disabled ? 'not-allowed' : 'pointer',
    opacity: slot.disabled ? cssVars.opacity.disabled : 1,
    touchAction: 'manipulation',
    ...(layout === 'breit'
      ? { flex: GEWICHT[slot.rolle], ...(slot.rolle === 'mehr' ? { width: MEHR_BREIT } : {}) }
      : {}),
  };
}

function Aktion({ slot, layout, tabIndex, chip }: { slot: Extract<ThumbBarSlot, { art: 'aktion' }>; layout: ThumbBarProps['layout']; tabIndex: number; chip: boolean }) {
  return (
    <button
      type="button"
      data-testid={slot.testId}
      data-rolle={slot.rolle}
      disabled={slot.disabled}
      tabIndex={tabIndex}
      aria-label={slot.ariaLabel}
      aria-keyshortcuts={slot.taste?.aria}
      onClick={slot.disabled ? undefined : slot.onPress}
      style={knopfStil(slot, layout)}
    >
      {slot.icon}
      <span>{slot.label}</span>
      {slot.sublabel && <small>{slot.sublabel}</small>}
      {chip && slot.taste && <kbd aria-hidden="true" style={kbdStil(slot.rolle === 'haupt')}>{slot.taste.text}</kbd>}
    </button>
  );
}

const slotId = (slot: ThumbBarSlot): string => (slot.art === 'aktion' ? slot.testId : slot.halten.testId);
const slotGesperrt = (slot: ThumbBarSlot): boolean => (slot.art === 'aktion' ? slot.disabled === true : slot.halten.disabled === true);

export function ThumbBar({ ariaLabel, slots, layout, hinweis, tastenChips = true }: ThumbBarProps) {
  const [fokusId, setFokusId] = useState<string | null>(null);
  const frei = slots.filter((slot) => !slotGesperrt(slot)).map(slotId);
  // Tabstopp: der zuletzt fokussierte Knopf, solange er bedienbar ist, sonst der erste bedienbare
  const tabstopp = fokusId !== null && frei.includes(fokusId) ? fokusId : (frei[0] ?? null);

  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const id = e.target instanceof HTMLElement ? e.target.getAttribute('data-testid') : null;
    if (id !== null && frei.includes(id)) { setFokusId(id); }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const ziel = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'Home' ? 'anfang' : e.key === 'End' ? 'ende' : null;
    const aktuell = e.target instanceof HTMLElement ? frei.indexOf(e.target.getAttribute('data-testid') ?? '') : -1;
    if (ziel === null || aktuell === -1) { return; }
    e.preventDefault();
    const neu = ziel === 'anfang' ? 0 : ziel === 'ende' ? frei.length - 1 : Math.min(frei.length - 1, Math.max(0, aktuell + ziel));
    e.currentTarget.querySelector<HTMLElement>(`[data-testid="${frei[neu]}"]`)?.focus();
  };

  return (
    <div role="toolbar" aria-label={ariaLabel} data-layout={layout} style={leisteStil(layout)} onFocus={onFocus} onKeyDown={onKeyDown}>
      {hinweis && <div data-testid={hinweis.testId} style={hinweisStil}>{hinweis.text}</div>}
      <div style={reiheStil(layout, slots.length)}>
        {slots.map((slot) =>
          slot.art === 'aktion' ? (
            <Aktion key={slot.testId} slot={slot} layout={layout} chip={layout === 'breit' && tastenChips} tabIndex={slot.testId === tabstopp ? 0 : -1} />
          ) : (
            <div key={slot.halten.testId} style={layout === 'breit' ? { flex: HALTEN_GEWICHT, display: 'flex' } : { display: 'flex' }}>
              <HoldButton {...slot.halten} kompakt={layout === 'daumen'} fuellend tabIndex={slot.halten.testId === tabstopp ? 0 : -1} />
            </div>
          ),
        )}
      </div>
    </div>
  );
}
