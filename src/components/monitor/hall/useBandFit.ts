/**
 * useBandFit – Breitenbegrenzung des Texts in der Mitte des Uhrbands (Profil „Halle (sehr fern)“, @ZM-213, @ZM-215).
 *
 * Restzeit, Anstoßzeit, „Endstand“ und „4 : 3 on penalties“ stehen groß in der Mitte, links und rechts daneben klein Abzeichen, Feld,
 * Gruppe, Abschnitt und das Wort zur Uhr. Der Text in der Mitte darf die Seitenspalten nie verdrängen oder überlappen: die Schrift wird so
 * klein gesetzt, wie sie neben den Seitenangaben passt (nie größer als die Vorgabe aus den Tokens). Gebraucht wird je Seite die Breite des
 * längsten Worts (die Seitentexte brechen an Leerzeichen um); beide Seiten bekommen dieselbe Breite, die Mitte bleibt mittig.
 * Misst im Browser am Layout (ohne Transformationen); ohne Layout (jsdom) bleibt die Vorgabe.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { displayHall } from '../../../design-tokens';

/**
 * Breite des längsten Worts in einer Seitenspalte. Gemessen an Kopien der Kinder (unsichtbar, absolut, `min-content`, ohne Breitenbegrenzung): ein Kind, das
 * die Spalte schon eingeengt hat (Abzeichen mit `max-width`), würde sonst zu schmal gemessen, und die Mitte bliebe zu breit.
 */
function laengstesWort(spalte: HTMLElement): number {
  let breite = 0;
  for (const kind of Array.from(spalte.children)) {
    if (!(kind instanceof HTMLElement)) { continue; }
    const kopie = kind.cloneNode(true);
    if (!(kopie instanceof HTMLElement)) { continue; }
    Object.assign(kopie.style, { position: 'absolute', visibility: 'hidden', pointerEvents: 'none', top: '0', left: '-10000px', width: 'min-content', minWidth: '0', maxWidth: 'none' });
    kopie.removeAttribute('data-testid');
    spalte.appendChild(kopie);
    breite = Math.max(breite, kopie.offsetWidth, kopie.scrollWidth);
    kopie.remove();
  }
  return breite;
}

function seitenInnenbreite(el: HTMLElement): number {
  const stil = getComputedStyle(el);
  return el.clientWidth - (parseFloat(stil.paddingLeft) || 0) - (parseFloat(stil.paddingRight) || 0);
}

export interface BandFitRefs {
  band: RefObject<HTMLElement | null>;
  slot: RefObject<HTMLElement | null>;
  text: RefObject<HTMLElement | null>;
  links: RefObject<HTMLElement | null>;
  rechts: RefObject<HTMLElement | null>;
}

const GRUNDSCHRIFT = new WeakMap<HTMLElement, string>();

/** Die Schrift der Seitenspalte aus den Tokens (Inline-Stil der Darstellung), vor jeder Verkleinerung gemerkt. */
function grundSchrift(spalte: HTMLElement): string {
  let wert = GRUNDSCHRIFT.get(spalte);
  if (wert === undefined) { wert = spalte.style.fontSize; GRUNDSCHRIFT.set(spalte, wert); }
  return wert;
}

/** Höhe der Zeilen einer Seitenspalte untereinander (Kinder und Abstand), wie sie nach dem Umbruch tatsächlich stehen. */
function spaltenHoehe(spalte: HTMLElement): number {
  const kinder = Array.from(spalte.children).filter((k): k is HTMLElement => k instanceof HTMLElement);
  const abstand = parseFloat(getComputedStyle(spalte).rowGap) || 0;
  return kinder.reduce((summe, k) => summe + k.offsetHeight, 0) + abstand * Math.max(0, kinder.length - 1);
}

/** Höhe des Uhrbands ohne Innenabstand. */
function bandHoehe(band: HTMLElement): number {
  const stil = getComputedStyle(band);
  return band.clientHeight - (parseFloat(stil.paddingTop) || 0) - (parseFloat(stil.paddingBottom) || 0);
}

/** Eine CSS-Länge (auch `max(…cqh, …vh)`) in Pixel, aufgelöst an einem unsichtbaren Messelement im Elternteil (dort gelten die Container-Einheiten der Folie). */
function pxVon(laenge: string, elternteil: HTMLElement): number {
  const messer = document.createElement('span');
  Object.assign(messer.style, { position: 'absolute', visibility: 'hidden', pointerEvents: 'none', fontSize: laenge });
  elternteil.appendChild(messer);
  const px = parseFloat(getComputedStyle(messer).fontSize);
  messer.remove();
  return px;
}

/** Höchstens so viele Schritte, eine zu hohe Seitenspalte zu verkleinern (der Umbruch ändert sich mit der Schrift). */
const HOEHEN_SCHRITTE = 4;
/** Kleine Reserve, damit die Zeilen nicht genau an die Kante stoßen. */
const HOEHEN_RESERVE = 0.98;

/**
 * Setzt die Schrift des Mittentexts (Pixel am Element) so, dass er zwischen die Seitenspalten passt, und verkleinert eine Seitenspalte, deren Zeilen
 * (Gruppe, Abschnitt, Wort, nach dem Umbruch auch mehrzeilig) höher wären als das Uhrband: dann ragt nichts in den Zeitbalken oder aus der Folie, und keine Angabe fällt weg.
 * Läuft, wenn sich `schluessel` (Texte und Aufbau) ändert, und bei Größenänderung, nicht bei jedem Uhrtakt.
 */
export function useBandFit({ band, slot, text, links, rechts }: BandFitRefs, schluessel: string): void {
  const inhalte = useRef<MutationObserver | null>(null);
  const messeUndPasseAn = useCallback(() => {
    const [b, s, t, l, r] = [band.current, slot.current, text.current, links.current, rechts.current];
    if (!b || !s || !l || !r) { return; }
    // Seitenspalten auf ihre Schrift aus den Tokens zurücksetzen (die Vorgabe steht als Inline-Stil, sie wird beim ersten Mal gemerkt)
    for (const spalte of [l, r]) {
      spalte.style.fontSize = grundSchrift(spalte);
      spalte.removeAttribute('data-schrift');
    }
    if (t) {
      t.style.removeProperty('font-size');
      const breite = t.offsetWidth;
      if (breite > 0) {
        const stilSlot = getComputedStyle(s);
        const slotRand = (parseFloat(stilSlot.paddingLeft) || 0) + (parseFloat(stilSlot.paddingRight) || 0);
        const verfuegbar = seitenInnenbreite(b) - 2 * Math.max(laengstesWort(l), laengstesWort(r)) - slotRand;
        if (breite > verfuegbar && verfuegbar > 0) {
          const px = parseFloat(getComputedStyle(t).fontSize);
          if (Number.isFinite(px)) { t.style.fontSize = `${String(Math.floor((px * verfuegbar) / breite))}px`; }
        }
      }
    }
    const hoehe = bandHoehe(b);
    if (!(hoehe > 0)) { return; }
    // Nichts fällt weg (@ZM-213: Feld, Gruppe und Abschnitt stehen neben der Restzeit): zu hohe Spalten werden kleiner, zuerst bis zur Nah-Grenze am Bildschirm
    // (`fontMin`, auch mit Bildrand mindestens 7,08 % der Bildschirmhöhe), nur als Notlösung bis `fontNot`
    const untergrenze = pxVon(displayHall.side.fontMin, b);
    const notgrenze = pxVon(displayHall.side.fontNot, b);
    for (const spalte of [l, r]) {
      for (const [grenze, art] of [[untergrenze, 'min'], [notgrenze, 'not']] as const) {
        for (let schritt = 0; schritt < HOEHEN_SCHRITTE; schritt++) {
          const noetig = spaltenHoehe(spalte);
          const px = parseFloat(getComputedStyle(spalte).fontSize);
          if (noetig <= hoehe || !Number.isFinite(px) || px <= grenze) { break; }
          spalte.style.fontSize = `${String(Math.max(grenze, Math.floor((px * hoehe * HOEHEN_RESERVE) / noetig)))}px`;
          spalte.setAttribute('data-schrift', art === 'min' ? 'verkleinert' : 'notloesung');
        }
        if (spaltenHoehe(spalte) <= hoehe) { break; }
      }
    }
  }, [band, slot, text, links, rechts]);
  const passeAn = useCallback(() => {
    try { messeUndPasseAn(); } finally { inhalte.current?.takeRecords(); } // die eigenen Messklone lösen keine neue Messung aus
  }, [messeUndPasseAn]);

  // nach jeder Darstellung, deren Texte oder Aufbau sich geändert haben: sofort messen, noch vor dem nächsten Bild
  useLayoutEffect(() => { passeAn(); }, [passeAn, schluessel]);

  useEffect(() => {
    const schrift = document.fonts;
    window.addEventListener('resize', passeAn);
    schrift?.addEventListener('loadingdone', passeAn);
    void schrift?.ready.then(passeAn);
    const el = band.current;
    let beobachter: ResizeObserver | undefined;
    if (el && typeof ResizeObserver !== 'undefined') {
      // Breite und Höhe: die Schrift hängt an der Höhe der Folie (cqh), der Platz an der Breite
      let groesse = `${String(el.clientWidth)}x${String(el.clientHeight)}`;
      beobachter = new ResizeObserver(() => {
        const neu = `${String(el.clientWidth)}x${String(el.clientHeight)}`;
        if (neu !== groesse) { groesse = neu; passeAn(); }
      });
      beobachter.observe(el);
    }
    // Inhalt der Seitenspalten ändert sich außerhalb des Schlüssels (z. B. Hinweis „ursprünglich 14:00“ vor dem Anpfiff): neu einpassen
    const spalten = [links.current, rechts.current].filter((e): e is HTMLElement => e !== null);
    if (typeof MutationObserver !== 'undefined') {
      inhalte.current = new MutationObserver(passeAn);
      for (const spalte of spalten) { inhalte.current.observe(spalte, { childList: true, characterData: true, subtree: true }); }
    }
    return () => {
      inhalte.current?.disconnect();
      inhalte.current = null;
      window.removeEventListener('resize', passeAn);
      schrift?.removeEventListener('loadingdone', passeAn);
      beobachter?.disconnect();
    };
  }, [passeAn, band, links, rechts]);
}
