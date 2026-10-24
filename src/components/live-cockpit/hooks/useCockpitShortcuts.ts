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
 * Wie der Fokus zuletzt bewegt wurde: Mausklick/Berührung ('maus') oder Tab-Taste ('tastatur'). Anfangs 'tastatur'.
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
    const verschluckt = { uhr: false, rueckgaengig: false };
    const beiTaste = (e: KeyboardEvent): void => {
      const { darf, aktionen } = ref.current;
      const ergebnis = tasteZuAktion(
        { key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, shiftKey: e.shiftKey, repeat: e.repeat, isComposing: e.isComposing, type: e.type === 'keyup' ? 'keyup' : 'keydown' },
        lageVon(e.target),
      );
      // Die Taste gehört dem Cockpit nur, wo die Aktion jetzt wirken darf; sonst behält der Browser sie (Leertaste auf einem Knopf, Helfer ohne Steuerrecht).
      // Leertaste und Strg/Cmd+Z: die Entscheidung des keydown gilt für keyup und gehaltene Taste (sonst löst keyup einen fokussierten Knopf aus).
      const merkTaste = e.key === ' ' ? 'uhr' : (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' ? 'rueckgaengig' : null;
      let verhindern = false;
      if (ergebnis.aktion !== null) {
        const erlaubt = darf(ergebnis.aktion);
        verhindern = ergebnis.verhindern && erlaubt;
        if (merkTaste !== null) { verschluckt[merkTaste] = verhindern; }
        if (erlaubt) { aktionen[ergebnis.aktion](); }
      } else if (merkTaste !== null) {
        if (e.type === 'keydown' && !e.repeat) { verschluckt[merkTaste] = false; } // z. B. Leertaste auf „Abpfiff halten“: gehört dem Knopf
        verhindern = ergebnis.verhindern && verschluckt[merkTaste];
      }
      if (verhindern) { e.preventDefault(); e.stopPropagation(); }
    };
    fokusArt = 'tastatur'; // frischer Start je Cockpit: ohne Mausklick gilt der Fokus als Tastatur-Fokus
    // Die Fokusart folgt nur der letzten Eingabe: Zeiger → Maus, Tab → Tastatur. Fokus per Programm oder Fokusfalle (Dialog zu) ändert nichts.
    const beiZeiger = (): void => { fokusArt = 'maus'; };
    const beiFokusTaste = (e: KeyboardEvent): void => { if (e.key === 'Tab') { fokusArt = 'tastatur'; } };
    window.addEventListener('pointerdown', beiZeiger, true);
    window.addEventListener('keydown', beiFokusTaste, true);
    window.addEventListener('keydown', beiTaste, true);
    window.addEventListener('keyup', beiTaste, true);
    return () => {
      window.removeEventListener('pointerdown', beiZeiger, true);
      window.removeEventListener('keydown', beiFokusTaste, true);
      window.removeEventListener('keydown', beiTaste, true);
      window.removeEventListener('keyup', beiTaste, true);
    };
  }, [p.aktiv]);
}
