/**
 * Fixture für die Zuschauer-Seite (LiveViewScreen). Spiel-IDs stammen aus
 * generateFullSchedule(), damit tournament.matches und der Spielplan dieselben IDs haben.
 */
import { generateFullSchedule } from '../../core/generators';
import { createMockTeam, createMockTournament } from '../../test/factories';
import type { Match, Team, Tournament } from '../../types/tournament';

export const SHARE_CODE = 'ABC123';

const TEAMS: Team[] = [
  createMockTeam({ id: 'team-nord', name: 'FC Nord', group: 'A' }),
  createMockTeam({ id: 'team-sued', name: 'SV Süd', group: 'A' }),
  createMockTeam({ id: 'team-west', name: 'TSV West', group: 'A' }),
  createMockTeam({ id: 'team-ost', name: 'SC Ost', group: 'A' }),
  createMockTeam({ id: 'team-mitte', name: 'VfL Mitte', group: 'B' }),
  createMockTeam({ id: 'team-hafen', name: 'FC Hafen', group: 'B' }),
  createMockTeam({ id: 'team-berg', name: 'SV Berg', group: 'B' }),
  createMockTeam({ id: 'team-tal', name: 'TuS Tal', group: 'B' }),
];

export interface FixtureOptions {
  hideScoresForPublic?: boolean;
  hideRankingsForPublic?: boolean;
}

/**
 * Gruppenphase aus dem Generator; Spiel 1 beendet 2:0, Spiel 5 ausgefallen (skipped),
 * Spiel 7 läuft 1:0; dazu Halbfinale und Finale als feste Playoff-Spiele.
 */
export function buildLiveViewTournament(opts: FixtureOptions = {}): Tournament {
  const base = createMockTournament({
    id: 'tour-live',
    title: 'Hallencup Nord',
    teams: TEAMS,
    matches: [],
    numberOfGroups: 2,
    numberOfFields: 2,
    groupSystem: 'groupsAndFinals',
    shareCode: SHARE_CODE,
    isPublic: true,
    hideScoresForPublic: opts.hideScoresForPublic ?? false,
    hideRankingsForPublic: opts.hideRankingsForPublic ?? false,
  });

  const generated = generateFullSchedule(base);
  const groupMatches: Match[] = generated.allMatches.map((m) => {
    const slot = m.slot ?? 0;
    const match: Match = {
      id: m.id,
      teamA: m.originalTeamA,
      teamB: m.originalTeamB,
      group: m.group,
      round: slot + 1,
      field: m.field,
      slot,
      phase: 'groupStage',
      matchNumber: m.matchNumber,
    };
    if (m.matchNumber === 1) {
      return { ...match, matchStatus: 'finished', scoreA: 2, scoreB: 0 };
    }
    if (m.matchNumber === 5) {
      return { ...match, matchStatus: 'skipped' };
    }
    if (m.matchNumber === 7) {
      return { ...match, matchStatus: 'running', scoreA: 1, scoreB: 0 };
    }
    return { ...match, matchStatus: 'scheduled' };
  });

  const playoffMatches: Match[] = [
    { id: 'po-semi-1', teamA: 'group-a-1st', teamB: 'group-b-2nd', round: 5, field: 1, slot: 4, phase: 'semifinal', label: '1. Halbfinale', isFinal: true, matchNumber: 13, matchStatus: 'scheduled' },
    { id: 'po-semi-2', teamA: 'group-b-1st', teamB: 'group-a-2nd', round: 5, field: 2, slot: 4, phase: 'semifinal', label: '2. Halbfinale', isFinal: true, matchNumber: 14, matchStatus: 'scheduled' },
    { id: 'po-final', teamA: 'winner-semi-1', teamB: 'winner-semi-2', round: 6, field: 1, slot: 5, phase: 'final', finalType: 'final', label: 'Finale', isFinal: true, matchNumber: 15, matchStatus: 'scheduled' },
  ];

  return { ...base, matches: [...groupMatches, ...playoffMatches] };
}
