/**
 * Einpassen der Teamnamen mit Höhengrenze (Profil „Halle (sehr fern)“, @ZM-213): eine reine Höhenänderung des Namensfelds (Hinweisleiste, Bildrand)
 * misst neu, weil die Höhe dort eine Grenze ist. Gegenbeispiel: ohne Höhengrenze (bisherige Folien) ändert eine Höhenänderung nichts.
 * jsdom hat keine Geometrie: `ResizeObserver` und die Lage des Namensfelds sind nachgebaut, gezählt wird, wie oft ein Messfeld angelegt wird.
 */
import { useRef } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { useTeamNameFit } from '../teamNameFit';

type Rueckruf = () => void;
const beobachter: Rueckruf[] = [];
let feldHoehe = 100;

class RO {
  constructor(rueckruf: Rueckruf) { beobachter.push(rueckruf); }
  observe(): void { /* nachgebaut */ }
  disconnect(): void { /* nachgebaut */ }
  unobserve(): void { /* nachgebaut */ }
}

function Harness({ hoehe }: { hoehe?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useTeamNameFit(ref, ['TSV Fridolfing'], true, '20px', undefined, hoehe === undefined ? undefined : { hoehe, zeilenhoehe: 1 });
  return <div data-testid="feld"><div ref={ref}>TSV Fridolfing</div></div>;
}

function messungen(): { zaehler: () => number; stop: () => void } {
  let n = 0;
  const original = Element.prototype.appendChild;
  const spy = vi.spyOn(Element.prototype, 'appendChild').mockImplementation(function (this: Element, knoten: Node) {
    if (knoten instanceof HTMLElement && knoten.getAttribute('aria-hidden') === 'true') { n += 1; }
    return original.call(this, knoten);
  });
  return { zaehler: () => n, stop: () => spy.mockRestore() };
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); beobachter.length = 0; feldHoehe = 100; });

function aufbauen(hoehe?: string) {
  vi.stubGlobal('ResizeObserver', RO);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const hoch = this.getAttribute('data-testid') === 'feld' ? feldHoehe : 20;
    return { width: 200, height: hoch, top: 0, left: 0, right: 200, bottom: hoch, x: 0, y: 0, toJSON: () => ({}) };
  });
  render(<Harness hoehe={hoehe} />);
}

describe('@ZM-213 Neumessen der Namen bei Höhenänderung', () => {
  it('mit Höhengrenze: ändert sich nur die Höhe des Namensfelds, wird neu gemessen', () => {
    aufbauen('30px');
    const m = messungen();
    const vorher = m.zaehler();
    feldHoehe = 140;
    beobachter.forEach((r) => r());
    expect(m.zaehler()).toBeGreaterThan(vorher);
    m.stop();
  });

  it('Gegenbeispiel: ohne Höhengrenze (bisherige Folien) misst eine reine Höhenänderung nicht neu', () => {
    aufbauen();
    const m = messungen();
    const vorher = m.zaehler();
    feldHoehe = 140;
    beobachter.forEach((r) => r());
    expect(m.zaehler()).toBe(vorher);
    m.stop();
  });
});
