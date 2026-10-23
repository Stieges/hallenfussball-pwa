/**
 * restzeitSpielMs / restzeitText – Restzeit des ganzen Spiels für die Rückfrage beim Abpfiff von Hand (Plan LT-1).
 * Szenarien: @SL-010 (zweiter Abschnitt bei 2:48 von 2 × 6 Min → 3:12), @SL-133 (erster Abschnitt bei 4:00 → 8:00).
 */
import { describe, it, expect } from 'vitest';
import { restzeitSpielMs, restzeitText } from '../restzeit';
import { makePhaseView } from '../../__tests__/cockpitFixtures';

describe('restzeitSpielMs', () => {
  it('@SL-010 zweiter Abschnitt bei 2:48 von 2 × 6 Min → 192 000 ms (3:12)', () => {
    const view = makePhaseView({ section: 2, sections: 2, sectionElapsedMs: 168_000, sectionLimitMs: 360_000 });
    expect(restzeitSpielMs(view)).toBe(192_000);
    expect(restzeitText(restzeitSpielMs(view))).toBe('3:12');
  });

  it('@SL-133 erster Abschnitt bei 4:00 von 2 × 6 Min → 480 000 ms (8:00), der zweite Abschnitt zählt mit', () => {
    const view = makePhaseView({ section: 1, sections: 2, sectionElapsedMs: 240_000, sectionLimitMs: 360_000, isLastRegularSection: false });
    expect(restzeitSpielMs(view)).toBe(480_000);
    expect(restzeitText(restzeitSpielMs(view))).toBe('8:00');
  });

  it('Gegenbeispiel: Verlängerung 3 Min bei 1:00 → 120 000 ms, ohne reguläre Abschnitte', () => {
    const view = makePhaseView({ phase: 'overtime', section: 3, sections: 2, sectionElapsedMs: 60_000, sectionLimitMs: 180_000 });
    expect(restzeitSpielMs(view)).toBe(120_000);
  });

  it('Gegenbeispiel: ein einziger Abschnitt zählt nur dessen Rest (1 × 10 Min bei 4:00 → 6:00)', () => {
    const view = makePhaseView({ section: 1, sections: 1, sectionElapsedMs: 240_000, sectionLimitMs: 600_000 });
    expect(restzeitSpielMs(view)).toBe(360_000);
  });

  it('nie negativ: ein überzogener Abschnitt zählt als 0 Rest', () => {
    const view = makePhaseView({ section: 2, sections: 2, sectionElapsedMs: 370_000, sectionLimitMs: 360_000 });
    expect(restzeitSpielMs(view)).toBe(0);
  });
});

describe('restzeitText', () => {
  it.each([[192_000, '3:12'], [480_000, '8:00'], [59_000, '0:59'], [0, '0:00'], [191_001, '3:12']])('%i ms → %s (Sekunden aufgerundet wie die Uhr der Tafel)', (ms, text) => {
    expect(restzeitText(ms)).toBe(text);
  });
});
