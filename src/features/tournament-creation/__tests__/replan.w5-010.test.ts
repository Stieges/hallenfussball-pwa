import { describe, it, expect } from 'vitest';
import type { Match, Tournament } from '../../../types/tournament';
import { generateFullSchedule } from '../../../core/generators';
import { replaceTeam } from '../utils/replan';
import { testUuid } from '../../../test/testIds';
import { matchInvolvesTeam, matchSideTeamId } from '../../../core/models/matchSlot';
import { mapMatchFromSupabase, mapMatchUpdateToSupabase } from '../../../core/repositories/supabaseMappers';

const baseTournament = (): Tournament =>
  ({
    id: 't1',
    title: 'Test Cup',
    ageClass: 'U13',
    sport: 'football',
    tournamentType: 'classic',
    mode: 'roundRobin',
    groupSystem: 'roundRobin',
    date: '2030-01-01',
    timeSlot: '09:00',
    startDate: '2030-01-01',
    startTime: '09:00',
    numberOfTeams: 4,
    numberOfFields: 2,
    numberOfGroups: 1,
    groupPhaseGameDuration: 10,
    groupPhaseBreakDuration: 2,
    finalRoundGameDuration: 10,
    finalRoundBreakDuration: 2,
    breakBetweenPhases: 0,
    placementLogic: [],
    teams: [
      { id: testUuid(1), name: 'A' },
      { id: testUuid(2), name: 'B' },
      { id: testUuid(3), name: 'C' },
      { id: testUuid(4), name: 'D' },
    ],
    matches: [],
    status: 'published',
    publishedAt: '2026-10-04T08:00:00Z',
    isKidsTournament: false,
    hideScoresForPublic: false,
    hideRankingsForPublic: false,
    resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 },
    finals: { final: true, thirdPlace: false, fifthSixth: false, seventhEighth: false },
    location: { name: 'Halle' },
    createdAt: '2026-10-04T08:00:00Z',
    updatedAt: '2026-10-04T08:00:00Z',
  }) as unknown as Tournament;

describe('Team ersetzen', () => {
  it('@W5-010 – Team N übernimmt Platz, Spiele und Ergebnisse von Team C, ohne Neulosen', () => {
    const established: Tournament = {
      ...baseTournament(),
      matches: generateFullSchedule(baseTournament()).allMatches.map((m, index) => ({
        id: m.id,
        round: index + 1,
        field: m.field,
        slotA: m.slotA,
        slotB: m.slotB,
        scheduledTime: m.startTime,
      })),
    };
    const playedOfC: Match[] = established.matches
      .filter((m) => matchInvolvesTeam(m, testUuid(3)))
      .slice(0, 2)
      .map((m) => ({
        ...m,
        scoreA: 2,
        scoreB: 0,
        matchStatus: 'finished' as const,
      }));
    const withPlayed: Tournament = {
      ...established,
      matches: established.matches.map(
        (m) => playedOfC.find((p) => p.id === m.id) ?? m
      ),
    };
    const before = structuredClone(withPlayed);

    const result = replaceTeam(withPlayed, {
      fromTeamId: testUuid(3),
      toTeam: { id: testUuid(9), name: 'N' },
      person: 'Helferin Mia',
    });

    const idx = before.teams.findIndex((t) => t.id === testUuid(3));
    expect(result.tournament.teams[idx]).toMatchObject({ id: testUuid(9), name: 'N' });
    expect(result.tournament.teams.map((t) => t.id)).not.toContain(testUuid(3));

    expect(result.tournament.matches.length).toBe(before.matches.length);
    result.tournament.matches.forEach((m, i) => {
      const b = before.matches[i];
      expect(m.id).toBe(b.id);
      expect(m.scheduledTime).toEqual(b.scheduledTime);
      const replaced = (id: string | undefined) => (id === testUuid(3) ? testUuid(9) : id);
      expect(matchSideTeamId(m, 'A')).toBe(replaced(matchSideTeamId(b, 'A')));
      expect(matchSideTeamId(m, 'B')).toBe(replaced(matchSideTeamId(b, 'B')));
    });

    const inherited = result.tournament.matches.filter(
      (m) => matchInvolvesTeam(m, testUuid(9)) && m.scoreA !== undefined
    );
    expect(inherited.length).toBe(2);
    expect(inherited.every((m) => m.scoreA === 2 && m.scoreB === 0)).toBe(true);

    expect(result.logEntry).toMatchObject({
      person: 'Helferin Mia',
    });
    expect(result.logEntry.label).toContain('Team C durch Team N ersetzt');
    expect(result.logEntry.timestamp).toBeTruthy();
  });

  it('@W5-010 – der Team-Wechsel steht in den Slots und geht über den Cloud-Mapper nicht verloren', () => {
    const base = baseTournament();
    const established: Tournament = {
      ...base,
      matches: generateFullSchedule(base).allMatches.map((m, index) => ({
        id: m.id,
        round: index + 1,
        field: m.field,
        slotA: m.slotA,
        slotB: m.slotB,
        scheduledTime: m.startTime,
      })),
    };
    const result = replaceTeam(established, {
      fromTeamId: testUuid(3),
      toTeam: { id: testUuid(9), name: 'N' },
      person: 'Helferin Mia',
    });

    const involvedC = established.matches.filter((m) => matchInvolvesTeam(m, testUuid(3)));
    const replaced = result.tournament.matches.filter((m) => matchInvolvesTeam(m, testUuid(9)));
    expect(replaced.length).toBe(involvedC.length);

    // Der Slot zeigt das neue Team; ein Übergangsfeld gibt es seit A-36a nicht mehr.
    replaced.forEach((m) => {
      expect(matchSideTeamId(m, 'A') === testUuid(9) || matchSideTeamId(m, 'B') === testUuid(9)).toBe(true);
      expect('teamA' in m || 'teamB' in m).toBe(false);
    });

    // Cloud-Mapper schreibt die Slots, Rücklesen liefert das neue Team wieder.
    result.tournament.matches.forEach((m) => {
      const update = mapMatchUpdateToSupabase(m);
      const row = {
        id: m.id,
        round: m.round,
        field: m.field,
        team_a_id: update.team_a_id ?? null,
        team_b_id: update.team_b_id ?? null,
        slot_a_source: update.slot_a_source ?? null,
        slot_b_source: update.slot_b_source ?? null,
      } as unknown as Parameters<typeof mapMatchFromSupabase>[0];
      const back = mapMatchFromSupabase(row);
      expect(back.slotA).toEqual(m.slotA);
      expect(back.slotB).toEqual(m.slotB);
    });

    // Die Seite bleibt gleich (A bleibt A, B bleibt B), nur das Team wird getauscht.
    const replacedId = (id: string | undefined) => (id === testUuid(3) ? testUuid(9) : id);
    established.matches.forEach((b) => {
      const after = result.tournament.matches.find((m) => m.id === b.id);
      expect(matchSideTeamId(after!, 'A')).toBe(replacedId(matchSideTeamId(b, 'A')));
      expect(matchSideTeamId(after!, 'B')).toBe(replacedId(matchSideTeamId(b, 'B')));
    });

    // Unbeteiligte Spiele behalten ihre Slots unverändert.
    established.matches
      .filter((m) => !matchInvolvesTeam(m, testUuid(3)))
      .forEach((b) => {
        const after = result.tournament.matches.find((m) => m.id === b.id);
        expect(after?.slotA).toEqual(b.slotA);
        expect(after?.slotB).toEqual(b.slotB);
      });
  });
});
