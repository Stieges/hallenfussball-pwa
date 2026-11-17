/**
 * useBandFit – Breitenbegrenzung des Texts in der Mitte des Uhrbands (Profil „Halle (sehr fern)“, @ZM-213, @ZM-215).
 *
 * Restzeit, Anstoßzeit, „Endstand“ und „4 : 3 on penalties“ stehen groß in der Mitte, links und rechts daneben klein Abzeichen, Feld,
 * Gruppe, Abschnitt und das Wort zur Uhr. Der Text in der Mitte darf die Seitenspalten nie verdrängen oder überlappen: die Schrift wird so
 * klein gesetzt, wie sie neben den Seitenangaben passt (nie größer als die Vorgabe aus den Tokens). Gebraucht wird je Seite die Breite des
 * längsten Worts (die Seitentexte brechen an Leerzeichen um); beide Seiten bekommen dieselbe Breite, die Mitte bleibt mittig.
 * Misst im Browser am Layout (ohne Transformationen); ohne Layout (jsdom) bleibt die Vorgabe.
 */
import { useCallback, useEffect, useLayoutEffect, type RefObject } from 'react';

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

/** Setzt die Schrift des Mittentexts (Pixel am Element) so, dass er zwischen die Seitenspalten passt; läuft nach jeder Darstellung und bei Größenänderung. */
export function useBandFit({ band, slot, text, links, rechts }: BandFitRefs): void {
  const passeAn = useCallback(() => {
    const [b, s, t, l, r] = [band.current, slot.current, text.current, links.current, rechts.current];
    if (!b || !s || !t || !l || !r) { return; }
    t.style.removeProperty('font-size');
    const breite = t.offsetWidth;
    if (breite <= 0) { return; }
    const stilSlot = getComputedStyle(s);
    const slotRand = (parseFloat(stilSlot.paddingLeft) || 0) + (parseFloat(stilSlot.paddingRight) || 0);
    const verfuegbar = seitenInnenbreite(b) - 2 * Math.max(laengstesWort(l), laengstesWort(r)) - slotRand;
    if (breite > verfuegbar && verfuegbar > 0) {
      const px = parseFloat(getComputedStyle(t).fontSize);
      if (Number.isFinite(px)) { t.style.fontSize = `${String(Math.floor((px * verfuegbar) / breite))}px`; }
    }
  }, [band, slot, text, links, rechts]);

  // nach jeder Darstellung (Uhr tickt, Zustand wechselt): sofort messen, noch vor dem nächsten Bild
  useLayoutEffect(() => { passeAn(); });

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
    return () => {
      window.removeEventListener('resize', passeAn);
      schrift?.removeEventListener('loadingdone', passeAn);
      beobachter?.disconnect();
    };
  }, [passeAn, band]);
}
