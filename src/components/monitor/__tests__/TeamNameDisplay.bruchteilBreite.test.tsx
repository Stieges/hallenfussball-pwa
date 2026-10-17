/**
 * Teamname xl misst mit der echten (gebrochenen) Breite des Namensfelds, nicht mit der aufgerundeten clientWidth
 * (CI Linux, 1366×768: sonst brach der 50-Zeichen-Name im Feld in 3 statt 2 Zeilen und überlappte die Uhr; @ZM-087, @ME-013).
 * jsdom hat kein Layout: Breite und Zeilenzahl werden nachgebildet (Name braucht 531,9 px für 2 Zeilen, sonst 3).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeamNameDisplay } from '../TeamNameDisplay';

const LANGER = 'Größenwahn Übungsteam Füßen Ösen Äpfel Ölkrug Ähre';
const NOETIG = 531.9;

afterEach(() => { vi.restoreAllMocks(); });

function layoutNachbilden(echteBreite: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(Math.round(echteBreite));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: echteBreite } as DOMRect);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    const px = parseFloat(this.style.fontSize);
    const breite = parseFloat(this.style.width);
    const zeilen = breite >= NOETIG ? 2 : 3;
    return Number.isFinite(px) && Number.isFinite(breite) ? zeilen * px * 1.2 : 0;
  });
}

describe('TeamNameDisplay xl – Bruchteil der Breite (@ZM-087)', () => {
  it('@ZM-087 bei 531,6 px echter Breite (clientWidth 532) wählt die Anpassung eine Schrift mit höchstens 2 Zeilen', () => {
    layoutNachbilden(531.6);
    render(<TeamNameDisplay name={LANGER} size="xl" fontSize="36px" />);
    // Im Messfeld mit der echten Breite bricht der Name in 3 Zeilen, also muss die Anpassung auf die Untergrenze gehen
    expect(parseFloat(screen.getByText(LANGER).style.fontSize)).toBeLessThan(36);
  });

  it('Gegenbeispiel: bei 532,4 px echter Breite passt der Name in 2 Zeilen, die Vorgabe 36 px bleibt', () => {
    layoutNachbilden(532.4);
    render(<TeamNameDisplay name={LANGER} size="xl" fontSize="36px" />);
    expect(parseFloat(screen.getByText(LANGER).style.fontSize)).toBe(36);
  });
});
