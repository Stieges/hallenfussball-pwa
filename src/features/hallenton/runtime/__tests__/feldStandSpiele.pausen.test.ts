/**
 * H4-12 Fixrunde: `istAngepfiffen` zählt die Pausen des Spiels (Halbzeit, Pause vor der Verlängerung, offene Entscheidung, Strafstoßschießen) als
 * angepfiffen (@HT-040 „im Spiel“, @HT-050); das Halten nach dem Spielwechsel (`erzeugeFeldWahl`, @HT-007) bleibt unverändert.
 */
import { describe, expect, it } from 'vitest';
import { HALTEN_NACH_WECHSEL_MS, erzeugeFeldWahl, istAngepfiffen, type PlanSpiel } from '../feldStandSpiele';

describe('@HT-040 istAngepfiffen', () => {
  it('Uhr läuft, angehalten und alle Pausen im Spiel → angepfiffen', () => {
    for (const status of ['running', 'paused', 'section_break', 'decision_pending', 'shootout', 'RUNNING', 'PAUSED'] as const) {
      expect(istAngepfiffen(status), status).toBe(true);
    }
  });

  it('Gegenbeispiel: nicht angepfiffen, beendet, übersprungen oder unbekannt → nicht angepfiffen', () => {
    for (const status of ['scheduled', 'finished', 'skipped', 'NOT_STARTED', 'FINISHED', undefined] as const) {
      expect(istAngepfiffen(status), String(status)).toBe(false);
    }
  });
});

describe('@HT-007 Halten nach dem Spielwechsel (unverändert)', () => {
  const spiel = (id: string, matchNumber: number, status: PlanSpiel['status']): PlanSpiel => ({
    id, field: 1, matchNumber, startTime: new Date(2026, 10, 21, 14, matchNumber), status, ctx: null,
  });

  it('der Plan meldet Spiel 11 beendet, Spiel 12 nicht angepfiffen → Spiel 11 bleibt 10 s das aktuelle, danach gilt die Wahl', () => {
    const wahl = erzeugeFeldWahl();
    const lauf = [spiel('s11', 11, 'RUNNING'), spiel('s12', 12, 'NOT_STARTED')];
    expect(wahl(lauf, [1], 1000).get('field-1')?.id).toBe('s11');
    const beendet = [spiel('s11', 11, 'FINISHED'), spiel('s12', 12, 'NOT_STARTED')];
    expect(wahl(beendet, [1], 2000).get('field-1')?.id).toBe('s11');
    expect(wahl(beendet, [1], 2000 + HALTEN_NACH_WECHSEL_MS + 1).get('field-1')?.id).toBe('s12');
  });

  it('ein angepfiffenes Spiel 12 übernimmt das Feld sofort', () => {
    const wahl = erzeugeFeldWahl();
    wahl([spiel('s11', 11, 'RUNNING'), spiel('s12', 12, 'NOT_STARTED')], [1], 1000);
    expect(wahl([spiel('s11', 11, 'FINISHED'), spiel('s12', 12, 'RUNNING')], [1], 2000).get('field-1')?.id).toBe('s12');
  });
});
