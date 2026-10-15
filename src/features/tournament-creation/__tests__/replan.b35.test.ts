import { describe, it, expect } from 'vitest';
import type { Match, Tournament } from '../../../types/tournament';
import { generateFullSchedule } from '../../../core/generators';
import { buildReplanPreview, applyReplan } from '../utils/replan';
import { testUuid } from '../../../test/testIds';
import { matchSideTeamId, resolveSlot } from '../../../core/models/matchSlot';
import { sideLabel } from '../utils/matchSides';

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


/** Köder: Das Übergangsfeld trägt Unsinn. Wer es liest, findet keine Paarung. */
const generatedWithDecoy = (tournament: Tournament): Match[] =>
  generateFullSchedule(tournament).allMatches.map((m, index) => ({
    id: m.id,
    round: index + 1,
    field: m.field,
    teamA: 'KOEDER-A',
    teamB: 'KOEDER-B',
    slotA: m.slotA,
    slotB: m.slotB,
  }));

const slotPairing = (m: Pick<Match, 'slotA' | 'slotB'>): string =>
  [matchSideTeamId(m, 'A'), matchSideTeamId(m, 'B')].map(String).sort().join(':');

describe('B-35 – Neuplanung liest nur Slots (@TM-015)', () => {
  it('behaltenes Spiel findet sein Gegenstück über die Slots, nicht über teamA/teamB', () => {
    const established = baseTournament();
    const all = generatedWithDecoy(established);
    const played: Match = { ...all[0], scoreA: 1, scoreB: 0, matchStatus: 'finished' };
    const withPlayed: Tournament = {
      ...established,
      numberOfTeams: 5,
      teams: [...established.teams, { id: testUuid(5), name: 'E' }],
      matches: [played, ...all.slice(1)],
    };
    const preview = buildReplanPreview(withPlayed);
    expect(preview.status).toBe('preview');
    if (preview.status !== 'preview') { return; }
    expect(preview.conflictMatchIds).toEqual([]);
    const updated = applyReplan(withPlayed, preview);
    expect(updated.matches.filter((m) => slotPairing(m) === slotPairing(played))).toHaveLength(1);
  });

  it('behaltenes Spiel behält besetzte Plätze und Herkunft (resolvedFrom) unverändert', () => {
    const established = baseTournament();
    const origin = { kind: 'groupRank', group: 'A', rank: 1 } as const;
    const all = generatedWithDecoy(established);
    const teamIdA = String(matchSideTeamId(all[0], 'A'));
    const played: Match = {
      ...all[0],
      slotA: resolveSlot(origin, teamIdA),
      scoreA: 3,
      scoreB: 2,
      matchStatus: 'finished',
    };
    const withPlayed: Tournament = { ...established, matches: [played, ...all.slice(1)] };
    const preview = buildReplanPreview(withPlayed);
    expect(preview.status).toBe('preview');
    if (preview.status !== 'preview') { return; }
    expect(preview.conflictMatchIds).toEqual([]);
    const updated = applyReplan(withPlayed, preview);
    const kept = updated.matches.find((m) => m.id === played.id);
    expect(kept?.slotA).toEqual({ kind: 'team', teamId: teamIdA, resolvedFrom: origin });
    expect(kept?.slotB).toEqual(played.slotB);
    const merged = preview.schedule.allMatches.find((m) => m.id === played.id);
    expect(merged?.slotA).toEqual(played.slotA);
  });

  it('sideLabel (Wizard) zeigt den Namen aus dem Slot, nicht aus teamA/teamB', () => {
    const [m] = generatedWithDecoy(baseTournament());
    expect(sideLabel(m, 'A', baseTournament().teams)).not.toContain('KOEDER');
    expect(sideLabel(m, 'A', baseTournament().teams)).toMatch(/^[A-D]$/);
  });
});
