import { describe, expect, it } from 'vitest';
import {
  assertAllAccepted,
  assertAutoSelectHitsEngineMatch,
  assertFinishedDuration,
  assertRunningDuration,
  assertStartAtNearSeed,
  assertStateAndEngineRows,
  assertTeamsSet,
  buildEngineEvents,
  type SeedEventInput,
} from '../engineSeed';

/**
 * A-23 (C3b-3a Schritt 2): je Prüfung ein Positivfall und ein Gegenbeispiel (das Falsche geht
 * nicht durch). Kennung: @OB-029 (Durchstich-Gerüst, Engine-Seed als Grundlage).
 */
const SEED_NOW = 1_800_000_000_000;
const CTX = { slug: 'TOR', seedNow: SEED_NOW, homeTeamId: 'home-id', awayTeamId: 'away-id', idFor: (key: string) => `id-${key}` };
const START: SeedEventInput = { key: 'start', type: 'MATCH_START', atOffsetMs: -60_000 };
const GOAL: SeedEventInput = { key: 'goal', type: 'GOAL', side: 'home', atOffsetMs: -30_000, payload: { playerNumber: 7 } };

describe('buildEngineEvents (S3)', () => {
  it('baut aufsteigende Umschläge: MATCH_START section 1 / clockMs 0, Tor mit teamId und clockMs relativ zum Anpfiff', () => {
    const [start, goal] = buildEngineEvents([START, GOAL], CTX);
    expect(start).toMatchObject({ id: 'id-start', at: SEED_NOW - 60_000, section: 1, clockMs: 0, teamId: null, targetId: null, payload: {} });
    expect(goal).toMatchObject({ type: 'GOAL', at: SEED_NOW - 30_000, clockMs: 30_000, teamId: 'home-id', payload: { playerNumber: 7 } });
  });

  it('löst targetKey zur festen Ereignis-ID auf (RETRACT/AMEND)', () => {
    const [, , retract] = buildEngineEvents([START, GOAL, { key: 'r', type: 'RETRACT', atOffsetMs: -10_000, targetKey: 'goal' }], CTX);
    expect(retract.targetId).toBe('id-goal');
  });

  it('Gegenbeispiel: nicht aufsteigende Zeiten werden abgelehnt', () => {
    expect(() => buildEngineEvents([START, { ...GOAL, atOffsetMs: -60_000 }], CTX)).toThrow(/nicht streng aufsteigend/);
  });

  it('Gegenbeispiel: ein Ereignis nach der Serverzeit wird abgelehnt', () => {
    expect(() => buildEngineEvents([START, { ...GOAL, atOffsetMs: 1000 }], CTX)).toThrow(/nach der Serverzeit/);
  });

  it('Gegenbeispiel: ein Ereignis vor dem MATCH_START wird abgelehnt', () => {
    expect(() => buildEngineEvents([{ ...GOAL, atOffsetMs: -90_000 }, START], CTX)).toThrow(/vor dem MATCH_START/);
  });

  it('Gegenbeispiel: unbekanntes Ziel wird abgelehnt', () => {
    expect(() => buildEngineEvents([START, { key: 'r', type: 'RETRACT', atOffsetMs: -10_000, targetKey: 'gibt-es-nicht' }], CTX)).toThrow(/unbekanntes Ziel/);
  });
});

describe('assertAllAccepted (S2)', () => {
  const events = buildEngineEvents([START, GOAL], CTX);
  it('akzeptiert, wenn jedes Ergebnis accepted ist', () => {
    expect(() => assertAllAccepted('TOR', events, { results: [{ id: 'a', status: 'accepted' }, { id: 'b', status: 'accepted' }] })).not.toThrow();
  });
  it.each(['rejected', 'duplicate', 'noop', 'review'])('Gegenbeispiel: %s wirft mit Spiel, Typ und Code', (status) => {
    expect(() => assertAllAccepted('TOR', events, { results: [{ id: 'a', status: 'accepted' }, { id: 'b', status, code: 'FORBIDDEN_ACTOR' }] })).toThrow(
      /Spiel TOR: Ereignis GOAL.*FORBIDDEN_ACTOR/
    );
  });
  it('Gegenbeispiel: CLIENT_OUTDATED wirft', () => {
    expect(() => assertAllAccepted('TOR', events, { error: 'CLIENT_OUTDATED' })).toThrow(/CLIENT_OUTDATED/);
  });
  it('Gegenbeispiel: fehlende Ergebnisse werfen', () => {
    expect(() => assertAllAccepted('TOR', events, { results: [{ id: 'a', status: 'accepted' }] })).toThrow(/Ergebnisse erhalten/);
  });
});

describe('assertTeamsSet (S1)', () => {
  const expected = { homeTeamId: 'home-id', awayTeamId: 'away-id' };
  it('akzeptiert gesetzte, gleiche Team-IDs', () => {
    expect(() => assertTeamsSet('TOR', { team_a_id: 'home-id', team_b_id: 'away-id' }, expected)).not.toThrow();
  });
  it('Gegenbeispiel: NULL oder fremde ID bricht mit klarer Meldung ab', () => {
    expect(() => assertTeamsSet('TOR', { team_a_id: null, team_b_id: 'away-id' }, expected)).toThrow(/team_a_id\/team_b_id leer/);
    expect(() => assertTeamsSet('TOR', { team_a_id: 'home-id', team_b_id: 'fremd' }, expected)).toThrow(/abweichend/);
  });
});

describe('assertStartAtNearSeed (S3)', () => {
  it('akzeptiert innerhalb der Toleranz', () => {
    expect(() => assertStartAtNearSeed('TOR', SEED_NOW - 60_000 + 1500, SEED_NOW, -60_000)).not.toThrow();
  });
  it('Gegenbeispiel: Abweichung > 2 s bricht ab und nennt beide Werte', () => {
    expect(() => assertStartAtNearSeed('TOR', SEED_NOW - 60_000 + 5000, SEED_NOW, -60_000)).toThrow(/gespeichert bei \d+, erwartet \d+/);
  });
});

describe('Dauer-Assertionen (S4)', () => {
  it('running: akzeptiert 3600 s und 1 Abschnitt', () => {
    expect(() => assertRunningDuration('TOR', { durationSeconds: 3600, sections: 1 })).not.toThrow();
  });
  it('Gegenbeispiel running: Standarddauer (900 s) oder 2 Abschnitte brechen ab', () => {
    expect(() => assertRunningDuration('TOR', { durationSeconds: 900, sections: 1 })).toThrow(/Dauer-Assertion/);
    expect(() => assertRunningDuration('TOR', { durationSeconds: 3600, sections: 2 })).toThrow(/Dauer-Assertion/);
    expect(() => assertRunningDuration('TOR', null)).toThrow(/Dauer-Assertion/);
  });
  it('finished: prüft sections x sectionSeconds der MATCH_START-Zeile', () => {
    expect(() => assertFinishedDuration('H', { rules: { sections: 1, sectionSeconds: 3600 } })).not.toThrow();
    expect(() => assertFinishedDuration('H', { rules: { sections: 1, sectionSeconds: 600 } })).toThrow(/Dauer-Assertion/);
    expect(() => assertFinishedDuration('H', {})).toThrow(/Dauer-Assertion/);
  });
});

describe('assertStateAndEngineRows (S4 untouched, S8 Altspiel)', () => {
  it('akzeptiert erwarteten Status ohne Engine-Zeilen', () => {
    expect(() => assertStateAndEngineRows('GHOST', { status: 'running', engineRows: 0 }, { status: 'running', engineRows: 0 })).not.toThrow();
  });
  it('Gegenbeispiel: eine Engine-Zeile am Altspiel bricht ab', () => {
    expect(() => assertStateAndEngineRows('GHOST', { status: 'running', engineRows: 1 }, { status: 'running', engineRows: 0 })).toThrow(/Zustand weicht ab/);
  });
  it('Gegenbeispiel: falscher Status bricht ab', () => {
    expect(() => assertStateAndEngineRows('NSTART', { status: 'running', engineRows: 0 }, { status: 'scheduled', engineRows: 0 })).toThrow(/Zustand weicht ab/);
  });
});

describe('assertAutoSelectHitsEngineMatch (S6/S7)', () => {
  const done = (id: string, slot: number) => ({ id, field: 1, slot, status: 'finished' });
  it('akzeptiert, wenn alle früheren Feld-1-Slots beendet sind', () => {
    expect(() => assertAutoSelectHitsEngineMatch('Live-Cup', [done('m1', 1), done('m2', 2), { id: 'run', field: 1, slot: 3, status: null }], 'run')).not.toThrow();
  });
  it('Gegenbeispiel: ein früherer unbeendeter Slot bricht mit Auswahl-Meldung ab', () => {
    expect(() => assertAutoSelectHitsEngineMatch('Live-Cup', [{ id: 'm1', field: 1, slot: 1, status: 'scheduled' }, { id: 'run', field: 1, slot: 2, status: null }], 'run')).toThrow(
      /Auto-Auswahl träfe m1/
    );
  });
  it('Gegenbeispiel: Engine-Spiel nicht auf Feld 1 bricht ab', () => {
    expect(() => assertAutoSelectHitsEngineMatch('Live-Cup', [{ id: 'run', field: 2, slot: 1, status: null }], 'run')).toThrow(/Feld 1/);
  });
});
