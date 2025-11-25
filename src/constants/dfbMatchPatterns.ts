/**
 * DFB Schlüsselzahlen-System für Turniere
 * Quelle: DFBnet Schlüsselzahlen-System (Stand: 15.12.2016)
 *
 * Die Schlüssel definieren die Ansetzungsreihenfolge für Round-Robin Turniere
 * Format: "Team1 - Team2" pro Spiel
 */

export interface DFBMatchPattern {
  code: string; // z.B. "1T06M"
  teams: number; // Anzahl Teams
  description: string;
  rounds: string[][]; // Array von Runden, jede Runde enthält Paarungen ["1-2", "3-4", ...]
}

/**
 * DFB Match Patterns für 2-11 Teams (Jeder gegen Jeden)
 */
export const DFB_ROUND_ROBIN_PATTERNS: DFBMatchPattern[] = [
  {
    code: '1T02M',
    teams: 2,
    description: '2 Teams - 1 Spiel',
    rounds: [
      ['1-2']
    ]
  },
  {
    code: '1T03M',
    teams: 3,
    description: '3 Teams - 3 Spiele',
    rounds: [
      ['2-3', '1-2'],
      ['1-3']
    ]
  },
  {
    code: '1T04M',
    teams: 4,
    description: '4 Teams - 6 Spiele',
    rounds: [
      ['2-4', '1-3'],
      ['3-4', '2-1'],
      ['4-1', '3-2']
    ]
  },
  {
    code: '1T05M',
    teams: 5,
    description: '5 Teams - 10 Spiele (1 Feld)',
    rounds: [
      ['1-5', '4-1', '2-4'],
      ['3-2', '5-3', '1-3'],
      ['4-5', '3-4', '2-1'],
      ['5-2']
    ]
  },
  {
    code: '1T06M',
    teams: 6,
    description: '6 Teams - 15 Spiele (Jeder gegen Jeden)',
    rounds: [
      ['1-5', '4-1', '1-3', '2-1'],
      ['4-6', '3-5', '2-4', '6-3', '5-2'],
      ['2-3', '6-2', '5-6', '4-5', '3-4']
    ]
  },
  {
    code: '1T07M',
    teams: 7,
    description: '7 Teams - 21 Spiele',
    rounds: [
      ['1-7', '6-1', '4-6', '6-2', '7-6', '6-5', '3-6'],
      ['5-2', '7-5', '1-5', '4-1', '2-4', '4-7', '5-4'],
      ['3-7', '5-3', '1-3', '2-1', '7-2']
    ]
  },
  {
    code: '1T08M',
    teams: 8,
    description: '8 Teams - 28 Spiele',
    rounds: [
      ['1-7', '6-1', '1-5', '4-1', '1-3', '2-1', '8-1'],
      ['6-8', '5-7', '4-6', '3-5', '2-4', '8-3', '7-2'],
      ['2-5', '8-4', '7-3', '6-2', '5-8', '4-7', '3-6'],
      ['4-3', '3-2', '2-8', '8-7', '7-6', '6-5', '5-4']
    ]
  },
  {
    code: '1T09M',
    teams: 9,
    description: '9 Teams - 36 Spiele',
    rounds: [
      ['1-9', '8-1', '6-8', '8-4', '2-8', '8-9', '7-8', '8-5', '3-8'],
      ['7-2', '9-7', '1-7', '6-1', '6-4', '6-2', '9-6', '6-7', '5-6'],
      ['5-4', '2-5', '5-9', '7-5', '1-5', '4-1', '2-4', '4-9', '7-4'],
      ['3-6', '4-3', '3-2', '9-3', '3-7', '5-3', '1-3', '2-1', '9-2']
    ]
  },
  {
    code: '1T10M',
    teams: 10,
    description: '10 Teams - 45 Spiele',
    rounds: [
      ['1-9', '8-1', '1-7', '6-1', '1-5', '4-1', '1-3', '2-1', '10-1'],
      ['8-10', '7-9', '6-8', '5-7', '4-6', '3-5', '2-4', '10-3', '9-2'],
      ['2-7', '10-6', '9-5', '8-4', '7-3', '6-2', '5-10', '4-9', '3-8'],
      ['6-3', '5-2', '4-10', '3-9', '2-8', '10-7', '9-6', '8-5', '7-4'],
      ['4-5', '3-4', '2-3', '10-2', '9-10', '8-9', '7-8', '6-7', '5-6']
    ]
  },
  {
    code: '1T11M',
    teams: 11,
    description: '11 Teams - 55 Spiele',
    rounds: [
      ['1-11', '10-1', '8-10', '10-6', '4-10', '10-2', '11-10', '10-9', '7-10', '10-5', '3-10'],
      ['9-2', '11-9', '1-9', '8-1', '6-8', '8-4', '2-8', '8-11', '9-8', '8-7', '5-8'],
      ['7-4', '2-7', '7-11', '9-7', '1-7', '6-1', '4-6', '6-2', '11-6', '6-9', '7-6'],
      ['5-6', '4-5', '5-2', '11-5', '5-9', '7-5', '1-5', '4-1', '2-4', '4-11', '9-4'],
      ['3-8', '6-3', '3-4', '2-3', '3-11', '9-3', '3-7', '5-3', '1-3', '2-1', '11-2']
    ]
  }
];

/**
 * Hilfsfunktion: Findet das passende DFB-Pattern basierend auf Teamanzahl
 */
export const getDFBPattern = (teamCount: number): DFBMatchPattern | undefined => {
  return DFB_ROUND_ROBIN_PATTERNS.find(p => p.teams === teamCount);
};

/**
 * Konvertiert DFB-Pattern in Match-Paarungen
 * Beispiel: "1-2" wird zu { home: 1, away: 2 }
 */
export const parseDFBMatches = (pattern: DFBMatchPattern) => {
  const allMatches: Array<{ round: number; home: number; away: number }> = [];

  pattern.rounds.forEach((round, roundIndex) => {
    round.forEach(pairing => {
      const [home, away] = pairing.split('-').map(n => parseInt(n.trim()));
      allMatches.push({
        round: roundIndex + 1,
        home,
        away
      });
    });
  });

  return allMatches;
};
