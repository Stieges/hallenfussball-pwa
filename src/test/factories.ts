import { Tournament, Team, Match, FinalsConfig, PointSystem, PlacementCriterion, LocationDetails, Finals } from '../types/tournament'

/**
 * Test Factory für Tournament-Objekte
 * Erstellt ein minimales Tournament-Objekt für Tests
 */
export function createMockTournament(overrides?: Partial<Tournament>): Tournament {
  const teams = overrides?.teams ?? createMockTeams(8)

  return {
    id: 'test-tournament-1',
    title: 'Test Turnier',
    date: '2025-01-15',
    timeSlot: '09:00 - 17:00',
    location: createMockLocation(),
    sport: 'football',
    tournamentType: 'classic',
    mode: 'classic',
    groupSystem: 'roundRobin',
    numberOfGroups: 2,
    numberOfFields: 2,
    numberOfTeams: teams.length,
    groupPhaseGameDuration: 7,
    groupPhaseBreakDuration: 3,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    teams,
    matches: [],
    ageClass: 'Herren',
    isKidsTournament: false,
    hideScoresForPublic: false,
    hideRankingsForPublic: false,
    resultMode: 'goals',
    pointSystem: createMockPointSystem(),
    placementLogic: createMockPlacementLogic(),
    finals: createMockFinals(),
    ...overrides,
  } as Tournament
}

/**
 * Test Factory für Team-Objekte
 */
export function createMockTeam(overrides?: Partial<Team>): Team {
  const id = overrides?.id ?? `team-${Math.random().toString(36).substr(2, 9)}`
  return {
    id,
    name: overrides?.name ?? `Team ${id.slice(-4)}`,
    group: overrides?.group ?? 'A',
    ...overrides,
  }
}

/**
 * Erstellt mehrere Mock-Teams
 */
export function createMockTeams(count: number, groupCount = 2): Team[] {
  const groups = 'ABCDEFGH'.split('').slice(0, groupCount)
  return Array.from({ length: count }, (_, i) =>
    createMockTeam({
      id: `team-${i + 1}`,
      name: `Team ${i + 1}`,
      group: groups[i % groupCount],
    })
  )
}

/**
 * Test Factory für Match-Objekte
 */
export function createMockMatch(overrides?: Partial<Match>): Match {
  return {
    id: `match-${Math.random().toString(36).substr(2, 9)}`,
    teamA: 'team-1',
    teamB: 'team-2',
    scoreA: undefined,
    scoreB: undefined,
    group: 'A',
    round: 1,
    field: 1,
    ...overrides,
  }
}

/**
 * Test Factory für LocationDetails
 */
export function createMockLocation(overrides?: Partial<LocationDetails>): LocationDetails {
  return {
    name: 'Sporthalle Test',
    street: 'Teststraße 1',
    postalCode: '12345',
    city: 'Teststadt',
    ...overrides,
  }
}

/**
 * Test Factory für PointSystem
 */
export function createMockPointSystem(overrides?: Partial<PointSystem>): PointSystem {
  return {
    win: 3,
    draw: 1,
    loss: 0,
    ...overrides,
  }
}

/**
 * Test Factory für PlacementLogic
 */
export function createMockPlacementLogic(): PlacementCriterion[] {
  return [
    { id: 'points', label: 'Punkte', enabled: true },
    { id: 'goalDifference', label: 'Tordifferenz', enabled: true },
    { id: 'goalsFor', label: 'Tore', enabled: true },
    { id: 'headToHead', label: 'Direkter Vergleich', enabled: true },
  ]
}

/**
 * Test Factory für Finals (Legacy)
 */
export function createMockFinals(overrides?: Partial<Finals>): Finals {
  return {
    final: false,
    thirdPlace: false,
    fifthSixth: false,
    seventhEighth: false,
    ...overrides,
  }
}

/**
 * Test Factory für FinalsConfig
 */
export function createMockFinalsConfig(overrides?: Partial<FinalsConfig>): FinalsConfig {
  return {
    preset: 'none',
    ...overrides,
  }
}

/**
 * Helper: Erstellt mehrere Matches für eine Gruppe
 */
export function createMockGroupMatches(groupTeams: Team[], group: string): Match[] {
  const matches: Match[] = []
  let matchIndex = 0

  for (let i = 0; i < groupTeams.length; i++) {
    for (let j = i + 1; j < groupTeams.length; j++) {
      matches.push(
        createMockMatch({
          id: `match-${group}-${matchIndex + 1}`,
          teamA: groupTeams[i].id,
          teamB: groupTeams[j].id,
          group,
          round: matchIndex + 1,
        })
      )
      matchIndex++
    }
  }

  return matches
}
