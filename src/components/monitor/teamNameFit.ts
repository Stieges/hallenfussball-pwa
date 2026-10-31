/**
 * Teamnamen auf der Live-Folie passend setzen (B-17 Fixrunde, @ZM-087, @ZM-088, @ZM-125).
 *
 * Der Anzeigetext kommt aus `monitorTeamName` (MS1, @ZM-149: Kurzname, sonst Vereinswörter nach Liste gekürzt).
 * Der Text steht vollständig da, ohne „…“, und passt seine Schrift zwischen 3 % der Bildschirmhöhe und der heutigen
 * Größe an. Passt auch die kleinste Schrift nicht, bleibt sie bei 3 % (nie kleiner); der Name umbricht dann weiter,
 * die Folien-Teilung dafür kommt mit MS3. Am Monitor wird nie mit „…“ gekürzt.
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
 * Berechnete Schriftgröße in px. Der Browser liefert immer px; eine Umgebung ohne Container-Abfragen (jsdom) lässt
 * `cqh` stehen – dann gilt wie im Browser ohne Größen-Container die Bildhöhe als Bezug (B-44a4).
 */
export function schriftPx(berechnet: string): number {
  const cq = /^([\d.]+)cqh$/.exec(berechnet.trim());
  return cq ? (parseFloat(cq[1]) / 100) * window.innerHeight : parseFloat(berechnet);
}

/**
 * B3 (@ZM-087, Ruhe): Beide Teamnamen stehen in derselben Größe, nämlich der kleineren der beiden passenden.
 * Solange ein Name noch nicht (gültig) gemessen ist, gibt es keine Vorgabe und jeder passt sich selbst an.
 */
export function gemeinsameNamenGroesse(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined || b === undefined || !Number.isFinite(a) || !Number.isFinite(b)) { return undefined; }
  return Math.min(a, b);
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
  /** B3: gemeinsame Größe in px; ersetzt die eigene, wenn sie kleiner ist (der Text wird nicht neu gewählt). */
  gemeinsamPx?: number,
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

  // Ändert sich die Breite des Namensfelds (z. B. schmaler neben dem Strafstoßergebnis, @ZM-087), wird neu gemessen
  useEffect(() => {
    const el = ref.current;
    if (!aktiv || !el || typeof ResizeObserver === 'undefined') { return; }
    let breite = el.getBoundingClientRect().width;
    const beobachter = new ResizeObserver(() => {
      const neu = el.getBoundingClientRect().width;
      if (Math.abs(neu - breite) > 0.5) { breite = neu; setTick(t => t + 1); }
    });
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, [ref, aktiv]);

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
      // Bruchteil der Breite zählt: clientWidth rundet auf, dann passt der Name im Messfeld, bricht im Feld aber um eine Zeile mehr (CI Linux, 1366×768)
      width: `${el.getBoundingClientRect().width}px`,
      fontFamily: stil.fontFamily,
      fontWeight: stil.fontWeight,
      letterSpacing: stil.letterSpacing,
      lineHeight: String(TEAM_NAME_ZEILENHOEHE),
      whiteSpace: 'normal',
      overflowWrap: 'normal',
      overflow: 'hidden',
    });
    // Unter `prefers-reduced-motion` setzt die Seite `transition-duration: 0.01ms !important`: die Schrift des Messfelds wäre beim Lesen noch
    // die vorige und jeder Name fiele auf die Untergrenze (@ZM-125). Inline `important` schlägt die Seitenregel.
    messfeld.style.setProperty('transition', 'none', 'important');
    // B-44a4: im Elternteil messen, damit Container-Einheiten (cqh) an der Folienfläche aufgelöst werden (@ME-020)
    (el.parentElement ?? document.body).appendChild(messfeld);

    // Obergrenze: berechneter Wert der Vorgabe (clamp wird am Viewport aufgelöst)
    messfeld.style.fontSize = vorgabe;
    const maxPx = schriftPx(getComputedStyle(messfeld).fontSize);

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

    el.style.fontSize = `${gemeinsamPx !== undefined ? Math.min(gemeinsamPx, neu.px) : neu.px}px`;
    setWahl(prev => (prev?.text === neu.text && prev.px === neu.px ? prev : neu));
  }, [ref, schluessel, aktiv, vorgabe, tick, gemeinsamPx]);

  return aktiv ? wahl : null;
}
