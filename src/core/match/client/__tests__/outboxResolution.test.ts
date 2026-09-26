/**
 * Task C2a-Fixrunde 1, Befund I2: `buildResolution` ordnet Ergebnisse ueber den
 * INDEX zu (`id` ist nur zur Kontrolle, Brief/Migration) -- und `review` landet
 * in der Liste `review`, nicht in `acked`.
 */
import { describe, it, expect } from 'vitest';
import { buildResolution, DEPENDS_ON_REJECTED } from '../outboxResolution';
import { ev } from './fixtures';

const NOW = 4711;

describe('buildResolution: Zuordnung ueber den Index', () => {
  it('I2a: id: null wird trotzdem korrekt ueber die Position zugeordnet', () => {
    const e1 = ev({ id: 'e1', type: 'GOAL', at: 1 });
    const e2 = ev({ id: 'e2', type: 'GOAL', at: 2 });
    const batch = [e1, e2];
    const results = [
      { id: null, status: 'accepted' as const },
      { id: null, status: 'rejected' as const, code: 'INVALID_TRANSITION' },
    ];

    const resolution = buildResolution(batch, results, batch, NOW);

    expect(resolution.ackedIds).toEqual(['e1']);
    expect(resolution.rejected.map((entry) => [entry.event.id, entry.code])).toEqual([['e2', 'INVALID_TRANSITION']]);
  });

  it('I2b: eine abweichende (nicht-null) id an der falschen Position aendert die Zuordnung NICHT -- Position entscheidet', () => {
    const e1 = ev({ id: 'e1', type: 'GOAL', at: 1 });
    const e2 = ev({ id: 'e2', type: 'GOAL', at: 2 });
    const batch = [e1, e2];
    // Vertauschte/abweichende ids: Position 0 traegt id 'e2', Position 1 traegt id null.
    const results = [
      { id: 'e2', status: 'accepted' as const },
      { id: null, status: 'rejected' as const, code: 'INVALID_TRANSITION' },
    ];

    const resolution = buildResolution(batch, results, batch, NOW);

    // Index-Zuordnung: Position 0 gehoert zu e1 (nicht e2, trotz der id im Ergebnis).
    expect(resolution.ackedIds).toEqual(['e1']);
    expect(resolution.rejected.map((entry) => entry.event.id)).toEqual(['e2']);
  });

  it('I2c: review -> Liste review, nicht acked, kein Fehler', () => {
    const e1 = ev({ id: 'e1', type: 'FOUL', at: 1 });
    const batch = [e1];
    const results = [{ id: e1.id, status: 'review' as const }];

    const resolution = buildResolution(batch, results, batch, NOW);

    expect(resolution.reviewIds).toEqual(['e1']);
    expect(resolution.ackedIds).toEqual([]);
    expect(resolution.rejected).toEqual([]);
  });

  it('Minor (c): W4 ueberschreibt den Server-Code eines im selben Stapel abgelehnten Eintrags NICHT', () => {
    const g1 = ev({ id: 'g1', type: 'GOAL', at: 1 });
    const r1 = ev({ id: 'r1', type: 'RETRACT', at: 2, targetId: 'g1' });
    const batch = [g1, r1];
    const results = [
      { id: g1.id, status: 'rejected' as const, code: 'INVALID_TRANSITION' },
      { id: r1.id, status: 'rejected' as const, code: 'UNKNOWN_TARGET' },
    ];

    const resolution = buildResolution(batch, results, batch, NOW);

    expect(resolution.rejected.map((entry) => [entry.event.id, entry.code])).toEqual([
      ['g1', 'INVALID_TRANSITION'],
      // Der eigentliche Server-Grund bleibt erhalten -- W4 haengt nur den Verweis an.
      ['r1', 'UNKNOWN_TARGET'],
    ]);
    const r1Entry = resolution.rejected.find((entry) => entry.event.id === 'r1');
    expect(r1Entry?.detail).toEqual({ dependsOnEventId: 'g1' });
  });

  it('Minor (c): ein NICHT gesendeter, kaskadierter Eintrag bekommt weiterhin DEPENDS_ON_REJECTED (kein Server-Code vorhanden)', () => {
    const start = ev({ id: 's1', type: 'MATCH_START', at: 1 });
    const goal = ev({ id: 'g1', type: 'GOAL', at: 2 });
    const batch = [start];
    const results = [{ id: start.id, status: 'rejected' as const, code: 'INVALID_TRANSITION' }];
    const pending = [start, goal]; // goal wurde gar nicht gesendet

    const resolution = buildResolution(batch, results, pending, NOW);

    const goalEntry = resolution.rejected.find((entry) => entry.event.id === 'g1');
    expect(goalEntry?.code).toBe(DEPENDS_ON_REJECTED);
    expect(goalEntry?.detail).toEqual({ dependsOnEventId: 's1' });
  });
});
