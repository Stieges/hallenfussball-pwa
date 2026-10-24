/**
 * useCockpitShortcuts – hängt die Tastenlogik (`tasteZuAktion`) an das Fenster (Plan Cockpit v2 K1, @SL-153, @SL-154).
 * Listener auf `window` in der Capture-Phase für `keydown` und `keyup`, damit auch die Leertaste auf einem angeklickten Knopf nichts auslöst.
 * Die Lage (Eingabefeld, offener Dialog (jede Rolle), Tastatur-Fokus auf „Abpfiff halten“) wird beim Tastendruck gelesen, nie vorab.
 */
import { useEffect, useRef } from 'react';
import { istModalerDialogOffen } from '../../ui/molecules/DialogSurface';
import { tasteZuAktion, type KurzAktion, type TastenLage } from '../model/shortcutKey';

export interface CockpitShortcutsParams {
  /** Nur mit Steuerrecht am Laptop und eingeschaltetem Schalter. Aus: kein Listener. */
  aktiv: boolean;
  /** Darf die Aktion jetzt wirken (Zustand, Recht)? Sonst bleibt die Taste ohne Wirkung. */
  darf: (aktion: KurzAktion) => boolean;
  aktionen: Readonly<Record<KurzAktion, () => void>>;
}

const istEingabeFeld = (ziel: EventTarget | null): boolean => {
  if (!(ziel instanceof HTMLElement)) { return false; }
  const tag = ziel.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(ziel.isContentEditable);
};

/**
 * Wie der Fokus zuletzt bewegt wurde: Mausklick/Berührung ('maus') oder Tab-Taste bzw. Programm ('tastatur'). Anfangs 'tastatur'.
 * `:focus-visible` allein reicht nicht: Chrome und Safari melden ihn nach einem Mausklick, sobald eine Taste gedrückt wird – auch die Leertaste.
 */
let fokusArt: 'maus' | 'tastatur' = 'tastatur';

/** Tastatur-Fokus auf „Abpfiff halten“ (mit Tab erreicht); nach einem Mausklick gilt er nicht. */
const istHalteFokus = (ziel: EventTarget | null): boolean =>
  ziel instanceof HTMLElement && ziel.matches('[data-halteknopf]') && fokusArt === 'tastatur';

export function lageVon(ziel: EventTarget | null): TastenLage {
  return {
    istEingabe: istEingabeFeld(ziel),
    dialogOffen: istModalerDialogOffen(),
    halteFokus: istHalteFokus(ziel),
  };
}

export function useCockpitShortcuts(p: CockpitShortcutsParams): void {
  const ref = useRef(p);
  ref.current = p;
  useEffect(() => {
    if (!p.aktiv) { return undefined; }
    const beiTaste = (e: KeyboardEvent): void => {
      const { darf, aktionen } = ref.current;
      const ergebnis = tasteZuAktion(
        { key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, shiftKey: e.shiftKey, repeat: e.repeat, isComposing: e.isComposing, type: e.type === 'keyup' ? 'keyup' : 'keydown' },
        lageVon(e.target),
      );
      if (ergebnis.verhindern) { e.preventDefault(); e.stopPropagation(); }
      if (ergebnis.aktion !== null && darf(ergebnis.aktion)) { aktionen[ergebnis.aktion](); }
    };
    fokusArt = 'tastatur'; // frischer Start je Cockpit: ohne Mausklick gilt der Fokus als Tastatur-Fokus
    // Ein Mausklick holt den Fokus im selben Ereignis-Durchlauf (pointerdown → focusin); jeder andere Fokuswechsel (Tab, Programm) gilt als Tastatur.
    let zeigerEben = false;
    const beiZeiger = (): void => { fokusArt = 'maus'; zeigerEben = true; setTimeout(() => { zeigerEben = false; }, 0); };
    const beiFokus = (): void => { if (!zeigerEben) { fokusArt = 'tastatur'; } };
    const beiFokusTaste = (e: KeyboardEvent): void => { if (e.key === 'Tab') { fokusArt = 'tastatur'; } };
    window.addEventListener('pointerdown', beiZeiger, true);
    window.addEventListener('focusin', beiFokus, true);
    window.addEventListener('keydown', beiFokusTaste, true);
    window.addEventListener('keydown', beiTaste, true);
    window.addEventListener('keyup', beiTaste, true);
    return () => {
      window.removeEventListener('pointerdown', beiZeiger, true);
      window.removeEventListener('focusin', beiFokus, true);
      window.removeEventListener('keydown', beiFokusTaste, true);
      window.removeEventListener('keydown', beiTaste, true);
      window.removeEventListener('keyup', beiTaste, true);
    };
  }, [p.aktiv]);
}
