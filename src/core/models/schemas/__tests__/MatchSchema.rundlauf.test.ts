/**
 * C-SCHEMA-VERWIRFT-FELDER (Paket SK, Befund aus review-A-25a Abschnitt 6 b):
 * `MatchSchema` darf beim lokalen Laden kein Feld von `Match` verwerfen. Ein verworfenes `matchNumber` machte aus
 * „Spiel 11“ lokal „Spiel 1“ und schrieb beim Komplett-Speichern `match_number = NULL` in die Cloud.
 *
 * Die Feldliste kommt aus dem Typ, nicht von Hand: `FULL_MATCH` ist als `Required<Match>` typisiert – kommt ein Feld
 * zu `Match` hinzu, bricht `tsc` hier, bis das Beispiel es nennt, und der Rundlauf prüft es dann mit.
 */
import { describe, it, expect } from 'vitest';
import { MatchSchema, TournamentSchema } from '../TournamentSchema';
import { TeamIdSchema } from '../MatchSlotSchema';
import type { Match } from '../../../../types/tournament';

const TEAM_A = TeamIdSchema.parse('11111111-1111-4111-8111-111111111111');
const TEAM_B = TeamIdSchema.parse('22222222-2222-4222-8222-222222222222');
const PREV = '33333333-3333-4333-8333-333333333333';

const FULL_MATCH: Required<Match> = {
  id: 'm-11',
  round: 3,
  field: 2,
  slot: 4,
  slotA: { kind: 'team', teamId: TEAM_A, resolvedFrom: { kind: 'groupRank', group: 'A', rank: 1 }, assignedBy: 'decided' },
  slotB: { kind: 'pending', source: { kind: 'matchResult', matchId: PREV, role: 'winner' } },
  originA: { kind: 'groupRank', group: 'A', rank: 1 },
  originB: { kind: 'matchResult', matchId: PREV, role: 'winner' },
  scoreA: 2,
  scoreB: 2,
  group: 'A',
  isFinal: true,
  finalType: 'final',
  label: '1. Halbfinale',
  scheduledTime: new Date('2026-11-14T14:20:00.000Z'),
  matchNumber: 11,
  phase: 'semifinal',
  referee: 3,
  matchStatus: 'finished',
  finishedAt: '2026-11-14T14:40:00.000Z',
  correctionHistory: [
    {
      timestamp: '2026-11-14T14:45:00.000Z',
      previousScoreA: 1,
      previousScoreB: 2,
      newScoreA: 2,
      newScoreB: 2,
      reasonType: 'referee_decision',
      reason: 'Tor zählt',
      note: 'laut Schiedsrichter',
      userName: 'Olli',
    },
  ],
  timerStartTime: '2026-11-14T14:20:00.000Z',
  timerPausedAt: '2026-11-14T14:30:00.000Z',
  timerElapsedSeconds: 600,
  overtimeScoreA: 0,
  overtimeScoreB: 0,
  penaltyScoreA: 4,
  penaltyScoreB: 3,
  decidedBy: 'penalty',
  skippedReason: 'Team zurückgezogen',
  skippedAt: '2026-11-14T13:00:00.000Z',
  liveState: { engine: true, status: 'section_break', phase: 'regular', section: 1, sections: 2, sectionSeconds: 600, elapsedMs: 600000, anchorAt: null, sectionStartMs: 0, breakStartedAt: 601000, breakSeconds: 60 },
  kit: { a: '#CC0000', b: '#FFFFFF', bibSide: 'b' }, // A-30a: getragene Farben beim Anpfiff (@W3-028)
  events: [
    { id: 'e1', matchId: 'm-11', timestampSeconds: 12, type: 'GOAL', payload: { teamId: 'a', playerNumber: 7 }, scoreAfter: { home: 1, away: 0 } },
  ],
};

/** Alle Felder des Typs (Schlüssel des `Required<Match>`-Beispiels). */
const ALL_FIELDS = Object.keys(FULL_MATCH) as (keyof Match)[];

describe('C-SCHEMA-VERWIRFT-FELDER: MatchSchema verliert beim Laden kein Feld', () => {
  it('jedes Feld von Match übersteht parse(JSON-Rundlauf) unverändert', () => {
    const stored: unknown = JSON.parse(JSON.stringify(FULL_MATCH));
    const loaded = MatchSchema.parse(stored) as Record<string, unknown>;
    const missing = ALL_FIELDS.filter((field) => !(field in loaded));
    expect(missing, `verworfene Felder: ${missing.join(', ')}`).toEqual([]);
    expect(loaded).toEqual({ ...FULL_MATCH, scheduledTime: new Date(FULL_MATCH.scheduledTime) });
  });

  it('matchNumber bleibt (aus „Spiel 11“ wird nicht „Spiel 1“)', () => {
    const loaded = MatchSchema.parse(JSON.parse(JSON.stringify(FULL_MATCH)));
    expect((loaded as { matchNumber?: number }).matchNumber).toBe(11);
  });

  it('das Turnier-Schema lässt die Felder ebenfalls durch', () => {
    const tournament = TournamentSchema.parse({
      id: 't', title: 'T', sport: 's', sportId: 's', tournamentType: 'g', mode: 'm', teams: [],
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      matches: [JSON.parse(JSON.stringify(FULL_MATCH))],
    });
    const loaded = tournament.matches[0] as Record<string, unknown>;
    expect(ALL_FIELDS.filter((field) => !(field in loaded))).toEqual([]);
  });

  it('Gegenbeispiel: ein Spiel ohne die optionalen Felder bleibt gültig und bekommt keine dazu', () => {
    const minimal = {
      id: 'm-1', round: 1, field: 1,
      slotA: { kind: 'team', teamId: TEAM_A },
      slotB: { kind: 'team', teamId: TEAM_B },
    };
    const loaded = MatchSchema.parse(minimal) as Record<string, unknown>;
    expect(loaded.matchNumber).toBeUndefined();
    expect(loaded.correctionHistory).toBeUndefined();
    expect(Object.keys(loaded).sort()).toEqual(['field', 'id', 'round', 'slotA', 'slotB', 'finalType', 'decidedBy', 'scheduledTime'].sort().filter((k) => k in loaded));
  });
});
