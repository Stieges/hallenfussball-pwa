import { TournamentSchema, PlacementMatch } from '../types/tournamentSchema';

/**
 * Shared Placement Match Templates
 * Vermeidet Code-Duplikation über alle Cases hinweg
 */
export const SHARED_PLACEMENT_MATCHES = {
  thirdPlace: (SF1 = 'SF1', SF2 = 'SF2'): PlacementMatch => ({
    matchId: 'P3',
    description: 'Spiel um Platz 3',
    placementRange: '3-4',
    home: { source: 'loserOf', matchId: SF1 },
    away: { source: 'loserOf', matchId: SF2 },
  }),
  fifthSixth: (QF1 = 'QF1', QF2 = 'QF2'): PlacementMatch => ({
    matchId: 'P5',
    description: 'Spiel um Platz 5',
    placementRange: '5-6',
    home: { source: 'loserOf', matchId: QF1 },
    away: { source: 'loserOf', matchId: QF2 },
  }),
  seventhEighth: (QF3 = 'QF3', QF4 = 'QF4'): PlacementMatch => ({
    matchId: 'P7',
    description: 'Spiel um Platz 7',
    placementRange: '7-8',
    home: { source: 'loserOf', matchId: QF3 },
    away: { source: 'loserOf', matchId: QF4 },
  }),
};

/**
 * Fußball-Turnier Schema
 * Definiert alle möglichen Turnierkonfigurationen für Fußball
 */
export const FOOTBALL_TOURNAMENT_SCHEMA: TournamentSchema = {
  schema_version: '1.0',
  sport: 'football',
  inputs: [
    {
      name: 'groupCount',
      type: 'integer',
      description: 'Anzahl der Gruppen in der Gruppenphase',
    },
    {
      name: 'totalTeams',
      type: 'integer',
      description: 'Gesamtanzahl aller Teams',
    },
    {
      name: 'teamsPerGroup',
      type: 'integer',
      description: 'Anzahl Teams pro Gruppe',
    },
    {
      name: 'hasQuarterfinal',
      type: 'boolean',
      description: 'Ob ein Viertelfinale gespielt wird',
    },
    {
      name: 'hasSemifinal',
      type: 'boolean',
      description: 'Ob ein Halbfinale gespielt wird',
    },
    {
      name: 'hasFinal',
      type: 'boolean',
      description: 'Ob ein Finale gespielt wird',
    },
    {
      name: 'hasThirdPlace',
      type: 'boolean',
      description: 'Ob ein Spiel um Platz 3 gespielt wird',
    },
    {
      name: 'hasFifthSixth',
      type: 'boolean',
      description: 'Ob ein Spiel um Platz 5/6 gespielt wird',
    },
    {
      name: 'hasSeventhEighth',
      type: 'boolean',
      description: 'Ob ein Spiel um Platz 7/8 gespielt wird',
    },
  ],
  constraints: [
    {
      id: 'constraint_quarter_without_semi',
      description: 'Viertelfinale ohne Halbfinale ist nicht erlaubt',
      condition: {
        all: [
          { var: 'hasQuarterfinal', op: '=', value: true },
          { var: 'hasSemifinal', op: '=', value: false },
        ],
      },
      result: {
        valid: false,
        reason: 'Viertelfinale erfordert ein Halbfinale',
      },
    },
    {
      id: 'constraint_final_without_semi_for_many_groups',
      description: 'Bei mehr als 3 Gruppen und einem Finale muss ein Halbfinale existieren',
      condition: {
        all: [
          { var: 'groupCount', op: '>', value: 3 },
          { var: 'hasFinal', op: '=', value: true },
          { var: 'hasSemifinal', op: '=', value: false },
        ],
      },
      result: {
        valid: false,
        reason: 'Finale mit mehr als 3 Gruppen erfordert Halbfinale',
      },
    },
    {
      id: 'constraint_thirdplace_requires_semi',
      description: 'Spiel um Platz 3 erfordert Halbfinale',
      condition: {
        all: [
          { var: 'hasThirdPlace', op: '=', value: true },
          { var: 'hasSemifinal', op: '=', value: false },
        ],
      },
      result: {
        valid: false,
        reason: 'Spiel um Platz 3 kann nur mit Halbfinale gespielt werden',
      },
    },
    {
      id: 'constraint_placement_56_requires_quarterfinal',
      description: 'Spiel um Platz 5/6 erfordert Viertelfinale',
      condition: {
        all: [
          { var: 'hasFifthSixth', op: '=', value: true },
          { var: 'hasQuarterfinal', op: '=', value: false },
        ],
      },
      result: {
        valid: false,
        reason: 'Spiel um Platz 5/6 erfordert ein Viertelfinale',
      },
    },
    {
      id: 'constraint_placement_78_requires_quarterfinal',
      description: 'Spiel um Platz 7/8 erfordert Viertelfinale',
      condition: {
        all: [
          { var: 'hasSeventhEighth', op: '=', value: true },
          { var: 'hasQuarterfinal', op: '=', value: false },
        ],
      },
      result: {
        valid: false,
        reason: 'Spiel um Platz 7/8 erfordert ein Viertelfinale',
      },
    },
  ],
  cases: [
    {
      id: 'case_2groups_semi_and_final',
      description: '2 Gruppen, Halbfinale und Finale (Kreuz-Halbfinale)',
      condition: {
        all: [
          { var: 'groupCount', op: '=', value: 2 },
          { var: 'hasQuarterfinal', op: '=', value: false },
          { var: 'hasSemifinal', op: '=', value: true },
          { var: 'hasFinal', op: '=', value: true },
        ],
      },
      tournamentStructure: {
        phaseOrder: ['semifinal', 'placement', 'final'],
        phases: {
          semifinal: [
            {
              matchId: 'SF1',
              description: 'Halbfinale 1',
              home: {
                source: 'groupStanding',
                groupId: 'A',
                position: 1,
              },
              away: {
                source: 'groupStanding',
                groupId: 'B',
                position: 2,
              },
            },
            {
              matchId: 'SF2',
              description: 'Halbfinale 2',
              home: {
                source: 'groupStanding',
                groupId: 'B',
                position: 1,
              },
              away: {
                source: 'groupStanding',
                groupId: 'A',
                position: 2,
              },
            },
          ],
          placement: [
            {
              matchId: 'P3',
              description: 'Spiel um Platz 3',
              placementRange: '3-4',
              home: {
                source: 'loserOf',
                matchId: 'SF1',
              },
              away: {
                source: 'loserOf',
                matchId: 'SF2',
              },
            },
          ],
          final: [
            {
              matchId: 'F1',
              description: 'Finale',
              home: {
                source: 'winnerOf',
                matchId: 'SF1',
              },
              away: {
                source: 'winnerOf',
                matchId: 'SF2',
              },
            },
          ],
        },
      },
    },
    {
      id: 'case_2groups_final_only',
      description: '2 Gruppen, nur Finale (Gruppensieger)',
      condition: {
        all: [
          { var: 'groupCount', op: '=', value: 2 },
          { var: 'hasQuarterfinal', op: '=', value: false },
          { var: 'hasSemifinal', op: '=', value: false },
          { var: 'hasFinal', op: '=', value: true },
        ],
      },
      tournamentStructure: {
        phaseOrder: ['final'],
        phases: {
          final: [
            {
              matchId: 'F1',
              description: 'Finale',
              home: {
                source: 'groupStanding',
                groupId: 'A',
                position: 1,
              },
              away: {
                source: 'groupStanding',
                groupId: 'B',
                position: 1,
              },
            },
          ],
        },
      },
    },
    {
      id: 'case_2groups_quarter_semi_final',
      description: '2 Gruppen mit Viertelfinale, Halbfinale und Finale (je 4 Teams pro Gruppe)',
      condition: {
        all: [
          { var: 'groupCount', op: '=', value: 2 },
          { var: 'hasQuarterfinal', op: '=', value: true },
          { var: 'hasSemifinal', op: '=', value: true },
        ],
      },
      tournamentStructure: {
        phaseOrder: ['quarterfinal', 'semifinal', 'placement', 'final'],
        note: 'Platzierungsspiele 5/6 und 7/8 sind optional und werden nur gespielt wenn aktiviert',
        phases: {
          quarterfinal: [
            {
              matchId: 'QF1',
              description: 'Viertelfinale 1',
              home: {
                source: 'groupStanding',
                groupId: 'A',
                position: 1,
              },
              away: {
                source: 'groupStanding',
                groupId: 'B',
                position: 4,
              },
            },
            {
              matchId: 'QF2',
              description: 'Viertelfinale 2',
              home: {
                source: 'groupStanding',
                groupId: 'A',
                position: 2,
              },
              away: {
                source: 'groupStanding',
                groupId: 'B',
                position: 3,
              },
            },
            {
              matchId: 'QF3',
              description: 'Viertelfinale 3',
              home: {
                source: 'groupStanding',
                groupId: 'B',
                position: 1,
              },
              away: {
                source: 'groupStanding',
                groupId: 'A',
                position: 4,
              },
            },
            {
              matchId: 'QF4',
              description: 'Viertelfinale 4',
              home: {
                source: 'groupStanding',
                groupId: 'B',
                position: 2,
              },
              away: {
                source: 'groupStanding',
                groupId: 'A',
                position: 3,
              },
            },
          ],
          semifinal: [
            {
              matchId: 'SF1',
              description: 'Halbfinale 1',
              home: {
                source: 'winnerOf',
                matchId: 'QF1',
              },
              away: {
                source: 'winnerOf',
                matchId: 'QF2',
              },
            },
            {
              matchId: 'SF2',
              description: 'Halbfinale 2',
              home: {
                source: 'winnerOf',
                matchId: 'QF3',
              },
              away: {
                source: 'winnerOf',
                matchId: 'QF4',
              },
            },
          ],
          placement: [
            {
              matchId: 'P3',
              description: 'Spiel um Platz 3',
              placementRange: '3-4',
              home: {
                source: 'loserOf',
                matchId: 'SF1',
              },
              away: {
                source: 'loserOf',
                matchId: 'SF2',
              },
            },
          ],
          final: [
            {
              matchId: 'F1',
              description: 'Finale',
              home: {
                source: 'winnerOf',
                matchId: 'SF1',
              },
              away: {
                source: 'winnerOf',
                matchId: 'SF2',
              },
            },
          ],
        },
      },
    },
    {
      id: 'case_3groups_semi_final',
      description: '3 Gruppen mit Halbfinale und Finale (bester Zweiter)',
      condition: {
        all: [
          { var: 'groupCount', op: '=', value: 3 },
          { var: 'hasQuarterfinal', op: '=', value: false },
          { var: 'hasSemifinal', op: '=', value: true },
          { var: 'hasFinal', op: '=', value: true },
        ],
      },
      tournamentStructure: {
        phaseOrder: ['semifinal', 'placement', 'final'],
        phases: {
          semifinal: [
            {
              matchId: 'SF1',
              description: 'Halbfinale 1',
              home: {
                source: 'groupStanding',
                groupId: 'A',
                position: 1,
              },
              away: {
                source: 'groupStanding',
                groupId: 'bestSecond',
                position: 2,
              },
            },
            {
              matchId: 'SF2',
              description: 'Halbfinale 2',
              home: {
                source: 'groupStanding',
                groupId: 'B',
                position: 1,
              },
              away: {
                source: 'groupStanding',
                groupId: 'C',
                position: 1,
              },
            },
          ],
          placement: [
            {
              matchId: 'P3',
              description: 'Spiel um Platz 3',
              placementRange: '3-4',
              home: {
                source: 'loserOf',
                matchId: 'SF1',
              },
              away: {
                source: 'loserOf',
                matchId: 'SF2',
              },
            },
          ],
          final: [
            {
              matchId: 'F1',
              description: 'Finale',
              home: {
                source: 'winnerOf',
                matchId: 'SF1',
              },
              away: {
                source: 'winnerOf',
                matchId: 'SF2',
              },
            },
          ],
        },
        note: 'Der beste Zweitplatzierte wird über Platzierungslogik ermittelt',
      },
    },
    {
      id: 'case_4groups_semi_final_manual',
      description: '4 Gruppen mit Halbfinale und Finale (manuelle Paarungen)',
      condition: {
        all: [
          { var: 'groupCount', op: '=', value: 4 },
          { var: 'hasQuarterfinal', op: '=', value: false },
          { var: 'hasSemifinal', op: '=', value: true },
          { var: 'hasFinal', op: '=', value: true },
        ],
      },
      tournamentStructure: {
        phaseOrder: ['semifinal', 'placement', 'final'],
        phases: {
          semifinal: [],
          placement: [
            {
              matchId: 'P3',
              description: 'Spiel um Platz 3',
              placementRange: '3-4',
              home: {
                source: 'loserOf',
                matchId: 'SF1',
              },
              away: {
                source: 'loserOf',
                matchId: 'SF2',
              },
            },
          ],
          final: [
            {
              matchId: 'F1',
              description: 'Finale',
              home: {
                source: 'winnerOf',
                matchId: 'SF1',
              },
              away: {
                source: 'winnerOf',
                matchId: 'SF2',
              },
            },
          ],
        },
        note: 'Halbfinale-Paarungen müssen manuell konfiguriert werden',
      },
    },
    {
      id: 'case_4groups_quarter_semi_final',
      description: '4 Gruppen mit Viertelfinale, Halbfinale und Finale',
      condition: {
        all: [
          { var: 'groupCount', op: '=', value: 4 },
          { var: 'hasQuarterfinal', op: '=', value: true },
          { var: 'hasSemifinal', op: '=', value: true },
          { var: 'hasFinal', op: '=', value: true },
        ],
      },
      tournamentStructure: {
        phaseOrder: ['quarterfinal', 'semifinal', 'placement', 'final'],
        phases: {
          quarterfinal: [
            {
              matchId: 'QF1',
              description: 'Viertelfinale 1',
              home: {
                source: 'groupStanding',
                groupId: 'A',
                position: 1,
              },
              away: {
                source: 'groupStanding',
                groupId: 'D',
                position: 2,
              },
            },
            {
              matchId: 'QF2',
              description: 'Viertelfinale 2',
              home: {
                source: 'groupStanding',
                groupId: 'B',
                position: 1,
              },
              away: {
                source: 'groupStanding',
                groupId: 'C',
                position: 2,
              },
            },
            {
              matchId: 'QF3',
              description: 'Viertelfinale 3',
              home: {
                source: 'groupStanding',
                groupId: 'C',
                position: 1,
              },
              away: {
                source: 'groupStanding',
                groupId: 'B',
                position: 2,
              },
            },
            {
              matchId: 'QF4',
              description: 'Viertelfinale 4',
              home: {
                source: 'groupStanding',
                groupId: 'D',
                position: 1,
              },
              away: {
                source: 'groupStanding',
                groupId: 'A',
                position: 2,
              },
            },
          ],
          semifinal: [
            {
              matchId: 'SF1',
              description: 'Halbfinale 1',
              home: {
                source: 'winnerOf',
                matchId: 'QF1',
              },
              away: {
                source: 'winnerOf',
                matchId: 'QF2',
              },
            },
            {
              matchId: 'SF2',
              description: 'Halbfinale 2',
              home: {
                source: 'winnerOf',
                matchId: 'QF3',
              },
              away: {
                source: 'winnerOf',
                matchId: 'QF4',
              },
            },
          ],
          placement: [
            {
              matchId: 'P3',
              description: 'Spiel um Platz 3',
              placementRange: '3-4',
              home: {
                source: 'loserOf',
                matchId: 'SF1',
              },
              away: {
                source: 'loserOf',
                matchId: 'SF2',
              },
            },
          ],
          final: [
            {
              matchId: 'F1',
              description: 'Finale',
              home: {
                source: 'winnerOf',
                matchId: 'SF1',
              },
              away: {
                source: 'winnerOf',
                matchId: 'SF2',
              },
            },
          ],
        },
      },
    },
  ],
};

/**
 * Andere Sportarten Schema (vereinfacht)
 */
export const OTHER_TOURNAMENT_SCHEMA: TournamentSchema = {
  schema_version: '1.0',
  sport: 'other',
  inputs: [
    {
      name: 'groupCount',
      type: 'integer',
      description: 'Anzahl der Gruppen',
    },
    {
      name: 'hasFinal',
      type: 'boolean',
      description: 'Ob ein Finale gespielt wird',
    },
  ],
  constraints: [],
  cases: [
    {
      id: 'case_other_final',
      description: 'Finale zwischen Gruppensiegern',
      condition: {
        all: [
          { var: 'groupCount', op: '=', value: 2 },
          { var: 'hasFinal', op: '=', value: true },
        ],
      },
      tournamentStructure: {
        phaseOrder: ['final'],
        phases: {
          final: [
            {
              matchId: 'F1',
              description: 'Finale',
              home: {
                source: 'groupStanding',
                groupId: 'A',
                position: 1,
              },
              away: {
                source: 'groupStanding',
                groupId: 'B',
                position: 1,
              },
            },
          ],
        },
      },
    },
  ],
};

/**
 * Helper: Schema basierend auf Sportart abrufen
 */
export const getTournamentSchema = (sport: 'football' | 'other'): TournamentSchema => {
  return sport === 'football' ? FOOTBALL_TOURNAMENT_SCHEMA : OTHER_TOURNAMENT_SCHEMA;
};
