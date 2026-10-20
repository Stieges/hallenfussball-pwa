/**
 * @W5-029: Anstoß als Zeitpunkt = Turnierdatum + Uhrzeit des Spiels (Hilfsfunktion hinter der Kopie fürs Proben).
 * Zeiten ohne Zeitzone gebaut (Ortszeit), das Gerät steht im Test fest auf Europe/Berlin.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { kickoffInstant } from '../time';

let vorherigeZeitzone: string | undefined;
beforeAll(() => { vorherigeZeitzone = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherigeZeitzone === undefined) { delete process.env.TZ; } else { process.env.TZ = vorherigeZeitzone; } });

describe('@W5-029 kickoffInstant', () => {
  it('nimmt das Datum des Turniers und die Uhrzeit des Spiels', () => {
    expect(kickoffInstant('2026-11-26', new Date('2026-11-28T16:30:00'))).toEqual(new Date('2026-11-26T16:30:00'));
  });

  it('liest eine Uhrzeit auch aus einem Text', () => {
    expect(kickoffInstant('2026-11-26', '16:30:00')).toEqual(new Date('2026-11-26T16:30:00'));
  });

  it('Datum mit Zeitanteil zählt als Tag (wie in der Cloud-Zeile)', () => {
    expect(kickoffInstant('2026-11-26T00:00:00.000Z', new Date('2026-11-28T16:30:00'))).toEqual(new Date('2026-11-26T16:30:00'));
  });

  it('Gegenbeispiel: liegt das Spiel schon am Turniertag, ändert sich nichts', () => {
    const am = new Date('2026-11-28T16:30:00');
    expect(kickoffInstant('2026-11-28', am)).toEqual(am);
  });

  it('Gegenbeispiel: ohne lesbares Turnierdatum bleibt der Anstoß des Spiels, ohne Anstoß gibt es keinen', () => {
    const am = new Date('2026-11-28T16:30:00');
    expect(kickoffInstant(undefined, am)).toEqual(am);
    expect(kickoffInstant('', am)).toEqual(am);
    expect(kickoffInstant('2026-11-26', undefined)).toBeUndefined();
    expect(kickoffInstant('2026-11-26', new Date('kaputt'))).toBeUndefined();
  });
});
