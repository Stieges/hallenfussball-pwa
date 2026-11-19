/**
 * @ZM-213 Breitenbegrenzung des Mittentexts im Uhrband (`useBandFit`): der Text darf die Seitenspalten nie verdrängen oder überlappen.
 * jsdom hat kein Layout: Breiten werden über `offsetWidth`/`clientWidth` nachgebaut; geprüft wird die Rechnung (Schrift so klein, dass der Text
 * zwischen die längsten Wörter der Seiten passt; nie größer als die Vorgabe). Die echte Geometrie misst die Playwright-Spec `monitor-profil-halle`.
 */
import { useRef } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { displayHall } from '../../../../design-tokens';
import { useBandFit } from '../useBandFit';

interface Breiten { band: number; text: number; links: number; rechts: number }

function Harness({ schluessel = 'a' }: { schluessel?: string }) {
  const refs = { band: useRef<HTMLDivElement>(null), slot: useRef<HTMLDivElement>(null), text: useRef<HTMLSpanElement>(null), links: useRef<HTMLDivElement>(null), rechts: useRef<HTMLDivElement>(null) };
  useBandFit(refs, schluessel);
  return (
    <div ref={refs.band} data-testid="band">
      <div ref={refs.links}><span data-testid="l">Live</span></div>
      <div ref={refs.slot}><span ref={refs.text} data-testid="text" style={{ fontSize: '' }}>4 : 3 on penalties</span></div>
      <div ref={refs.rechts}><span data-testid="r">angehalten</span></div>
    </div>
  );
}

function stelle(b: Breiten): void {
  // Die Seitenkinder werden als Kopien gemessen (ohne `data-testid`): sie sind am Text zu erkennen
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    if (this.getAttribute('data-testid') === 'text') { return b.text; }
    if (this.style.width === 'min-content') { return this.textContent === 'Live' ? b.links : this.textContent === 'angehalten' ? b.rechts : 0; }
    return 0;
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.getAttribute('data-testid') === 'band' ? b.band : 0; });
  vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({ fontSize: '200px', paddingLeft: '0px', paddingRight: '0px' }) as unknown as CSSStyleDeclaration);
}

afterEach(() => { vi.restoreAllMocks(); });

describe('@ZM-213 useBandFit', () => {
  it('ein Text, der zwischen die Seitenspalten nicht passt, bekommt eine kleinere Schrift (Breite = Band − 2 × längstes Seitenwort)', () => {
    stelle({ band: 1600, text: 1740, links: 150, rechts: 400 });
    const { getByTestId } = render(<Harness />);
    // verfügbar 1600 − 2 × 400 = 800; Schrift 200 px × 800 / 1740 = 91,95 → 91 px
    expect(getByTestId('text').style.fontSize).toBe('91px');
  });

  it('Gegenbeispiel: passt der Text, bleibt die Vorgabe (keine Schrift am Element gesetzt)', () => {
    stelle({ band: 1600, text: 700, links: 150, rechts: 400 });
    const { getByTestId } = render(<Harness />);
    expect(getByTestId('text').style.fontSize).toBe('');
  });

  it('N4: bei gleichem Schlüssel (Uhr tickt, Text und Aufbau gleich) wird nicht neu gemessen, bei neuem Schlüssel schon', () => {
    stelle({ band: 1600, text: 700, links: 150, rechts: 400 });
    const messungen = vi.spyOn(window, 'getComputedStyle');
    const { rerender } = render(<Harness schluessel="a" />);
    const nachErstem = messungen.mock.calls.length;
    rerender(<Harness schluessel="a" />);
    expect(messungen.mock.calls.length).toBe(nachErstem);
    rerender(<Harness schluessel="b" />);
    expect(messungen.mock.calls.length).toBeGreaterThan(nachErstem);
  });

  describe('Höhe der Seitenspalten (nichts fällt weg)', () => {
    function Hoehe({ schluessel = 'a' }: { schluessel?: string }) {
      const refs = { band: useRef<HTMLDivElement>(null), slot: useRef<HTMLDivElement>(null), text: useRef<HTMLSpanElement>(null), links: useRef<HTMLDivElement>(null), rechts: useRef<HTMLDivElement>(null) };
      useBandFit(refs, schluessel);
      return (
        <div ref={refs.band} data-testid="band">
          <div ref={refs.links}><span>Live</span></div>
          <div ref={refs.slot}><span ref={refs.text}>5:50</span></div>
          <div ref={refs.rechts} style={{ fontSize: '8cqh' }} data-testid="rechts"><span>Gruppe A</span><span>2. Halbzeit</span><span>angehalten</span></div>
        </div>
      );
    }

    /** Vier Zeilen zu 80 px = 320 px in einem Band von 263 px; die Schrift in Pixel folgt dem Inline-Stil der Spalte, Tokens lösen sich zu Pixeln auf. */
    function stelleHoehe(zeilenHoehe: number): void {
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) { return this.getAttribute('data-testid') === 'band' ? 263 : 0; });
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
        const schrift = this.parentElement?.style.fontSize ?? '';
        return this.parentElement?.getAttribute('data-testid') === 'rechts' ? (schrift.endsWith('px') ? (parseFloat(schrift) / 78) * zeilenHoehe : zeilenHoehe) : 0;
      });
      // die beiden Messelemente lösen sich nach der Länge auf, die sie messen (nicht nach der Reihenfolge der Aufrufe): Nah-Grenze 76 px, Notgrenze 54 px
      const messer: Record<string, number> = { [displayHall.side.fontMin]: 76, [displayHall.side.fontNot]: 54 };
      vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
        const stil = (el as HTMLElement).style;
        const px = stil.position === 'absolute' ? `${String(messer[stil.fontSize] ?? 0)}px` : stil.fontSize.endsWith('px') ? stil.fontSize : '78px';
        return { fontSize: px, paddingLeft: '0px', paddingRight: '0px', paddingTop: '0px', paddingBottom: '0px', rowGap: '0px' } as unknown as CSSStyleDeclaration;
      });
    }

    it('zu hohe Spalte: die Schrift wird kleiner (nie unter der Nah-Grenze 76 px), keine Zeile wird ausgeblendet; die Notlösung geht darunter, markiert', () => {
      stelleHoehe(80); // 3 Zeilen zu 80 px = 240 passen (Band 263): nichts ändert sich
      const { getByTestId, rerender } = render(<Hoehe />);
      expect(getByTestId('rechts').style.fontSize).toBe('8cqh');
      expect(getByTestId('rechts').hasAttribute('data-schrift')).toBe(false);
      vi.restoreAllMocks();
      stelleHoehe(100); // 300 px > 263 px: verkleinern, bis zur Nah-Grenze 76 px, dann Notlösung
      rerender(<Hoehe schluessel="b" />);
      const spalte = getByTestId('rechts');
      expect(spalte.style.fontSize).toMatch(/px$/);
      expect(parseFloat(spalte.style.fontSize)).toBeLessThan(78);
      expect(spalte.getAttribute('data-schrift')).toBe('notloesung');
      for (const zeile of Array.from(spalte.children) as HTMLElement[]) { expect(zeile.style.display, 'nichts wird ausgeblendet').toBe(''); }
    });

    it('Gegenbeispiel Wiederherstellen: passt es danach wieder, steht die Schrift aus den Tokens wieder da (nicht auf 16 px oder verkleinert)', () => {
      stelleHoehe(100);
      const { getByTestId, rerender } = render(<Hoehe />);
      expect(getByTestId('rechts').style.fontSize).toMatch(/px$/);
      vi.restoreAllMocks();
      stelleHoehe(60); // 3 × 60 = 180 passen
      rerender(<Hoehe schluessel="c" />);
      expect(getByTestId('rechts').style.fontSize).toBe('8cqh');
      expect(getByTestId('rechts').hasAttribute('data-schrift')).toBe(false);
    });
  });
});
