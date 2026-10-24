/**
 * useCockpitTasten – bindet die Tastenkürzel an die Befehle des Cockpits (Plan Cockpit v2 K1, @SL-153).
 *
 * Tor und Foul über dieselben Abläufe wie die Tasten der Spalten (`flows`), „links/rechts“ ist die **angezeigte** Seite (Seiten tauschen, RL4);
 * das Tor öffnet die Nummernauswahl im Tastatur-Modus (`perTaste`). Uhr über `onPauseResume`, Rückgängig über `onUndo` (dieselbe 1-s-Sperre wie
 * der Knopf, @SL-108), `?` über `onUebersicht`. Wirkung nur, wo auch der Knopf wirken dürfte (`darfAktion`).
 */
import { useMemo } from 'react';
import { darfAktion } from '../model/darf';
import type { CockpitPhase } from '../model/cockpitPhase';
import type { CockpitControls, Side } from '../model/cockpitTypes';
import type { KurzAktion } from '../model/shortcutKey';
import type { UseEntryFlowsReturn } from './useEntryFlows';
import { useCockpitShortcuts } from './useCockpitShortcuts';

export interface CockpitTastenParams {
  /** Schalter an, Steuerrecht und Laptop-Anordnung (`breit`). */
  aktiv: boolean;
  /** Die Übersicht mit `?` gibt es auch ohne Steuerrecht, solange der Schalter an ist. */
  uebersichtAktiv?: boolean;
  phase: CockpitPhase;
  kannSteuern: boolean;
  sides: { links: Side; rechts: Side };
  flows: Pick<UseEntryFlowsReturn, 'tippeTor' | 'tippeFoul'>;
  controls: Pick<CockpitControls, 'onPauseResume' | 'onUndo' | 'canUndo'>;
  onUebersicht?: () => void;
}

export function useCockpitTasten(p: CockpitTastenParams): void {
  const { phase, kannSteuern, sides, flows, controls, onUebersicht } = p;
  const aktionen = useMemo((): Record<KurzAktion, () => void> => ({
    uhr: () => { controls.onPauseResume(); },
    torLinks: () => { flows.tippeTor(sides.links, { perTaste: true }); },
    torRechts: () => { flows.tippeTor(sides.rechts, { perTaste: true }); },
    foulLinks: () => { flows.tippeFoul(sides.links); },
    foulRechts: () => { flows.tippeFoul(sides.rechts); },
    rueckgaengig: () => { controls.onUndo?.(); },
    uebersicht: () => { onUebersicht?.(); },
  }), [controls, flows, sides.links, sides.rechts, onUebersicht]);
  const darf = (aktion: KurzAktion): boolean => {
    switch (aktion) {
      case 'uhr': return darfAktion(phase, kannSteuern, 'pauseWeiter');
      case 'torLinks': case 'torRechts': return darfAktion(phase, kannSteuern, 'tor');
      case 'foulLinks': case 'foulRechts': return darfAktion(phase, kannSteuern, 'foul');
      case 'rueckgaengig': return kannSteuern && controls.onUndo !== undefined && controls.canUndo;
      case 'uebersicht': return onUebersicht !== undefined;
    }
  };
  useCockpitShortcuts({ aktiv: p.aktiv || p.uebersichtAktiv === true, darf: (a) => (a === 'uebersicht' ? darf(a) : p.aktiv && darf(a)), aktionen });
}
