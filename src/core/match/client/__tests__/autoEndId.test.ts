/**
 * autoEndEventId (B-08b): dieselbe Grenze desselben Spiels ergibt auf jedem Gerät dieselbe Ereignis-ID
 * (Server: gleiche ID + gleicher Inhalt = duplicate), jede andere Grenze eine andere.
 * Werte: Spiel 11, erster Abschnitt 2 x 6 Minuten (@SL-005), zweites Ende bei 720000 (@SL-009).
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { autoEndEventId, type AutoEndSeed } from '../autoEndId';

const BASIS: AutoEndSeed = { matchId: 'match-11', kind: 'SECTION_END', section: 1, limitClockMs: 360_000, reopenCount: 0 };

describe('autoEndEventId', () => {
  it('gleiche Grenze, gleiche ID (zwei Geräte)', () => {
    expect(autoEndEventId({ ...BASIS })).toBe(autoEndEventId({ ...BASIS }));
  });

  it('ist eine gültige UUID (Umschlag des Servers verlangt eine)', () => {
    expect(z.uuid().safeParse(autoEndEventId(BASIS)).success).toBe(true);
  });

  it.each([
    ['anderes Spiel', { matchId: 'match-12' }],
    ['anderer Typ', { kind: 'MATCH_END' as const }],
    ['anderer Abschnitt', { section: 2 }],
    ['andere Grenze', { limitClockMs: 720_000 }],
    ['nach Wiedereröffnen', { reopenCount: 1 }],
  ])('Gegenbeispiel: %s ergibt eine andere ID', (_name, abweichung) => {
    expect(autoEndEventId({ ...BASIS, ...abweichung })).not.toBe(autoEndEventId(BASIS));
  });
});
