/**
 * Teamnamen auf der Live-Folie passend setzen (B-17 Fixrunde, @ZM-087, @ZM-088, @ZM-125).
 *
 * Ein Name steht vollständig da (bis 50 Zeichen, ohne „…“), umbricht auf höchstens zwei Zeilen und passt seine
 * Schrift zwischen 3 % der Bildschirmhöhe und der heutigen Größe an. Passt auch das nicht, kommt der Kurzname,
 * und nur zuletzt wird gekürzt.
 */
import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

/** Höchstens so viele Zeilen darf ein Teamname umbrechen (@ZM-087). */
export const TEAM_NAME_MAX_ZEILEN = 2;

/** Kleinste Schrift: Anteil der Bildschirmhöhe (@ZM-125, 3 %). */
export const TEAM_NAME_MIN_ANTEIL_HOEHE = 0.03;

/** Zeilenhöhe als Faktor der Schriftgröße; muss mit dem Stil der Anzeige übereinstimmen. */
export const TEAM_NAME_ZEILENHOEHE = 1.2;

export interface TeamNameWahl {
  /** Gewählter Text (Vollname oder eine Kürzung). */
  text: string;
  /** Schriftgröße in px. */
  px: number;
}

/**
 * Wählt den ersten Kandidaten, der bei der kleinsten Schrift passt, und darin die größte Schrift bis `maxPx`.
 * Passt keiner, gilt der letzte Kandidat bei `minPx`. `passt` prüft Umbruch und Breite (reine Funktion, testbar).
 */
export function waehleTeamNameSchrift(
  kandidaten: readonly string[],
  passt: (text: string, px: number) => boolean,
  minPx: number,
  maxPx: number,
): TeamNameWahl {
  for (const text of kandidaten) {
    if (!passt(text, minPx)) { continue; }
    const obergrenze = Math.max(maxPx, minPx);
    if (passt(text, obergrenze)) { return { text, px: obergrenze }; }
    let lo = minPx;
    let hi = obergrenze;
    for (let i = 0; i < 14 && hi - lo > 0.5; i++) {
      const mitte = (lo + hi) / 2;
      if (passt(text, mitte)) { lo = mitte; } else { hi = mitte; }
    }
    return { text, px: lo };
  }
  return { text: kandidaten[kandidaten.length - 1] ?? '', px: minPx };
}

/**
 * Misst im Browser mit einem versteckten Messfeld derselben Breite und Schrift. Die größte Schrift ist der
 * berechnete Wert der CSS-Vorgabe (`vorgabe`, z. B. clamp(48px, 5vw, 72px)), gemessen am Messfeld, nicht am Inline-Stil
 * des Elements (B-17 Fixrunde 2: sonst erbt das Element 16 px und jeder Name wird auf die Untergrenze gedrückt).
 * Ohne Layout (jsdom) passt jeder Kandidat bei der größten Schrift; das prüft die Playwright-Spec.
 */
export function useTeamNameFit(
  ref: RefObject<HTMLDivElement | null>,
  kandidaten: readonly string[],
  aktiv: boolean,
  vorgabe: string,
): TeamNameWahl | null {
  const [wahl, setWahl] = useState<TeamNameWahl | null>(null);
  const [tick, setTick] = useState(0);
  const schluessel = kandidaten.join('\u0000');

  useEffect(() => {
    const neu = () => setTick(t => t + 1);
    const schrift = document.fonts;
    window.addEventListener('resize', neu);
    // Neu messen, sobald Inter geladen ist; sonst passt die Größe zur Ausweichschrift
    schrift?.addEventListener('loadingdone', neu);
    void schrift?.ready.then(neu);
    return () => {
      window.removeEventListener('resize', neu);
      schrift?.removeEventListener('loadingdone', neu);
    };
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!aktiv || !el) { return; }
    const liste = schluessel.split('\u0000');
    const stil = getComputedStyle(el);

    const messfeld = document.createElement('div');
    messfeld.setAttribute('aria-hidden', 'true');
    Object.assign(messfeld.style, {
      position: 'absolute',
      visibility: 'hidden',
      top: '-10000px',
      left: '0',
      width: `${el.clientWidth}px`,
      fontFamily: stil.fontFamily,
      fontWeight: stil.fontWeight,
      letterSpacing: stil.letterSpacing,
      lineHeight: String(TEAM_NAME_ZEILENHOEHE),
      whiteSpace: 'normal',
      overflowWrap: 'normal',
      overflow: 'hidden',
    });
    document.body.appendChild(messfeld);

    // Obergrenze: berechneter Wert der Vorgabe (clamp wird am Viewport aufgelöst)
    messfeld.style.fontSize = vorgabe;
    const maxPx = parseFloat(getComputedStyle(messfeld).fontSize);

    const passt = (text: string, px: number): boolean => {
      messfeld.style.fontSize = `${px}px`;
      messfeld.textContent = text;
      const zeilenHoehe = px * TEAM_NAME_ZEILENHOEHE;
      return messfeld.offsetHeight <= TEAM_NAME_MAX_ZEILEN * zeilenHoehe + 1
        && messfeld.scrollWidth <= messfeld.clientWidth + 1;
    };

    const minPx = window.innerHeight * TEAM_NAME_MIN_ANTEIL_HOEHE;
    const neu = waehleTeamNameSchrift(liste, passt, minPx, maxPx);
    messfeld.remove();

    el.style.fontSize = `${neu.px}px`;
    setWahl(prev => (prev?.text === neu.text && prev.px === neu.px ? prev : neu));
  }, [ref, schluessel, aktiv, vorgabe, tick]);

  return aktiv ? wahl : null;
}
