/**
 * A-04a – „Turnier kopieren“ (V14): Slots dürfen nicht auf alte Team-/Spiel-IDs stehen bleiben.
 * Vorgabe V14 (V-TEAM-Plan), keine Szenario-Kennung.
 */
import { describe, it, expect } from 'vitest';
import type { Match, Team, Tournament } from '../../../types/tournament';
import { copyTeamsAndMatches, buildCopiedTournament } from '../tournamentCopy';
import { teamSlot, pendingSlot } from '../matchSlot';
import { testUuid } from '../../../test/testIds';

const T1 = testUuid(1);
const T2 = testUuid(2);
const M_GROUP = testUuid(101);
const M_SEMI = testUuid(102);
const M_FINAL = testUuid(103);

const teams = [
  { id: T1, name: 'FC Nord' },
  { id: T2, name: 'VfB Ufer' },
] as Team[];

const groupRank = { kind: 'groupRank', group: 'A', rank: 1 } as const;
const matches = [
  { id: M_GROUP, round: 1, field: 1, slotA: teamSlot(T1), slotB: teamSlot(T2), scoreA: 3, scoreB: 1, matchStatus: 'finished' },
  // Seite wurde aus Gruppe A Rang 1 aufgelöst
  { id: M_SEMI, round: 2, field: 1, slotA: teamSlot(T1, groupRank), slotB: pendingSlot({ kind: 'groupRank', group: 'B', rank: 2 }) },
  { id: M_FINAL, round: 3, field: 1, slotA: pendingSlot({ kind: 'matchResult', matchId: M_SEMI, role: 'winner' }), slotB: pendingSlot({ kind: 'matchResult', matchId: M_GROUP, role: 'loser' }) },
] as Match[];

let counter = 1000;
const makeId = () => testUuid(counter++);

describe('copyTeamsAndMatches (V14)', () => {
  const copy = copyTeamsAndMatches({ teams, matches }, makeId);
  const [gruppe, semi, finale] = copy.matches;
  const [newT1, newT2] = copy.teams;

  it('V14 besetzte Seite zeigt auf die NEUE Team-ID, Namen bleiben', () => {
    expect(newT1.id).not.toBe(T1);
    expect(gruppe.slotA).toEqual(teamSlot(newT1.id));
    expect(gruppe.slotB).toEqual(teamSlot(newT2.id));
    expect(newT1.name).toBe('FC Nord');
  });

  it('V14 aufgelöste Seite wird in der Kopie wieder offen und behält ihre Herkunft', () => {
    expect(semi.slotA).toEqual(pendingSlot(groupRank));
    expect(semi.slotB).toEqual(pendingSlot({ kind: 'groupRank', group: 'B', rank: 2 }));
  });

  it('V14 Verweis auf ein Vorgängerspiel zeigt auf die NEUE Spiel-ID', () => {
    expect(finale.slotA).toEqual(pendingSlot({ kind: 'matchResult', matchId: semi.id, role: 'winner' }));
    expect(finale.slotB).toEqual(pendingSlot({ kind: 'matchResult', matchId: gruppe.id, role: 'loser' }));
  });

  it('V14 Gegenbeispiel: nirgends bleibt eine alte Team- oder Spiel-ID stehen', () => {
    const json = JSON.stringify(copy);
    for (const alt of [T1, T2, M_GROUP, M_SEMI, M_FINAL]) {
      expect(json).not.toContain(alt);
    }
  });

  it('Kopie hat keine Ergebnisse; das Übergangsfeld folgt dem Slot', () => {
    expect(gruppe).toMatchObject({ matchStatus: 'scheduled', scoreA: undefined, scoreB: undefined, events: [] });
    expect('teamA' in semi || 'teamB' in semi).toBe(false); // A-36a: kein Übergangsfeld mehr
  });

  it('A-25c: die Kopie eines gewerteten Spiels trägt kein Merkmal der Wertung (Ergebnisfeld)', () => {
    const awarded = { ...matches[0], scoreA: 0, scoreB: 0, decidedBy: 'forfeit', forfeitAbsent: 'both' } as Match;
    const [kopie] = copyTeamsAndMatches({ teams, matches: [awarded] }, makeId).matches;
    expect(kopie).toMatchObject({ matchStatus: 'scheduled', decidedBy: undefined, forfeitAbsent: undefined });
  });
});

describe('buildCopiedTournament (Verdrahtung „Turnier kopieren“ in App.tsx)', () => {
  const source = {
    id: 'alt-turnier', title: 'Hallencup', status: 'draft', lastVisitedStep: 5, deletedAt: '2026-01-01',
    createdAt: '2026-01-01', updatedAt: '2026-01-02', teams, matches,
  } as unknown as Tournament;
  const copy = buildCopiedTournament(source, { newId: testUuid(900), title: 'Hallencup (Kopie)', now: '2026-10-03T10:00:00.000Z', makeId });

  it('V14 ein Entwurf bleibt Entwurf, mit neuer ID, Titel und Zeitstempeln', () => {
    expect(copy).toMatchObject({ id: testUuid(900), title: 'Hallencup (Kopie)', status: 'draft', lastVisitedStep: 1, createdAt: '2026-10-03T10:00:00.000Z', updatedAt: '2026-10-03T10:00:00.000Z' });
    expect(copy.deletedAt).toBeUndefined();
  });

  it('V14 die gespeicherten Spiele sind die kopierten (echte Slots auf neuen IDs), nicht die des Originals', () => {
    const oldTeamIds = new Set(teams.map((team) => team.id));
    const newTeamIds = new Set(copy.teams.map((team) => team.id));
    for (const team of copy.teams) { expect(oldTeamIds.has(team.id)).toBe(false); }
    const gruppe = copy.matches.find((match) => match.round === 1);
    expect(gruppe?.slotA?.kind === 'team' && newTeamIds.has(gruppe.slotA.teamId)).toBe(true);
    expect(JSON.stringify(copy.matches)).not.toContain(M_SEMI);
  });
});

describe('A-13b-C: Abschlüsse und Verlauf wandern nicht in die Kopie', () => {
  const original = {
    id: 'orig', title: 'Orig', status: 'draft', teams, matches,
    groupCompletions: [{ groupId: 'A', ranking: [T1, T2], openRanks: [], stale: false }],
    decisionLog: [{ id: 1, kind: 'standing_decision', detail: { id: 'e-1' }, actorName: 'Olli', reason: 'Grund', at: '2026-12-06T10:00:00Z' }],
  } as unknown as Tournament;
  const options = { newId: 'neu', title: 'Kopie', now: '2026-12-07T10:00:00Z', makeId };

  it('die Kopie hat keine abgeschlossene Gruppe und keinen Verlauf mit Namen und Gründen', () => {
    const copy = buildCopiedTournament(original, options);
    expect(copy.groupCompletions).toBeUndefined();
    expect(copy.decisionLog).toBeUndefined();
    expect(JSON.stringify(copy)).not.toMatch(/Olli|Grund/);
  });

  it('Gegenbeispiel: das Original bleibt unverändert', () => {
    buildCopiedTournament(original, options);
    expect(original.groupCompletions).toHaveLength(1);
    expect(original.decisionLog).toHaveLength(1);
  });
});

