/**
 * Regelzeilen des Spielplan-PDFs (B-28a3-3a, @DR-006, @DR-007, @DR-008, @DR-015, @DR-020, @DR-022).
 * Reine Logik mit der echten Ressource (`translatorFor`); kein Zeichnen.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, type PlacementCriterion, type Tournament } from '../../../types/tournament';
import { koLines, pdfRuleLines, pdfRulesFrom, type PdfRules } from '../rules';
import { buildPdfTexts } from '../translations';
import { hallencupTournament } from './pdfFixture';
import { translatorFor } from './pdfText';

const de = buildPdfTexts(translatorFor('de'), 'de');
const en = buildPdfTexts(translatorFor('en'), 'en');

const BFV = 'BFV-Richtlinien für Futsal und private Hallenturniere';

/** Platzierungslogik mit den echten Kriterium-IDs des Turnier-Assistenten. */
const PLACEMENT: PlacementCriterion[] = [
  { id: 'points', enabled: true },
  { id: 'goalDifference', enabled: true },
  { id: 'goalsFor', enabled: true },
  { id: 'directComparison', enabled: true },
];

/** Regeln des „Hallencup Nord“ mit Überschreibungen. Das Regelwerk kommt nur, wenn es angegeben ist. */
function rulesOf(overrides: Partial<Tournament> = {}, rulebook?: string): PdfRules {
  return { ...pdfRulesFrom(hallencupTournament({ placementLogic: PLACEMENT, ...overrides })), rulebook };
}

describe('Adapter pdfRulesFrom (@DR-006)', () => {
  it('liest das Regelwerk, wenn das Feld am Turnier steht', () => {
    const tournament = Object.assign(hallencupTournament(), { rulebook: BFV });
    expect(pdfRulesFrom(tournament).rulebook).toBe(BFV);
  });

  it('liefert kein Regelwerk, solange das Feld fehlt (w1 noch nicht gemergt)', () => {
    expect(pdfRulesFrom(hallencupTournament()).rulebook).toBeUndefined();
  });
});

describe('Pflichtzeilen Kopf (@DR-006): Hallencup mit BFV-Regelwerk', () => {
  it('@DR-006 Modus, Platzierung, Spielzeit mit Zeitstrafe, Regelwerk in dieser Reihenfolge', () => {
    expect(pdfRuleLines(rulesOf({}, BFV), de)).toEqual([
      'Modus: Gruppen + Finals',
      'Platzierung: Punkte – Tordifferenz – Tore – direkter Vergleich',
      'Spielzeit: 10 Min. · Zeitstrafe 2 Min.',
      `Regelwerk: ${BFV}`,
    ]);
  });

  it('@DR-006 die K.-o.-Entscheidung steht als eine Zeile über der Finalrunde', () => {
    const rules = rulesOf({ finalsConfig: { preset: 'top-4', tiebreaker: 'shootout' } }, BFV);
    expect(koLines(rules, de)).toEqual(['K.-o.: bei Gleichstand Strafstoßschießen, 5 Schützen']);
  });
});

describe('Regelzeilen folgen den Einstellungen (@DR-020)', () => {
  const PRIMARY_ROWS: Array<[string, Partial<Tournament>, string]> = [
    [
      'keine Zeitstrafe',
      { matchCockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS, timePenaltyDurationSeconds: 0 } },
      'Spielzeit: 10 Min.',
    ],
    [
      'Gruppen 10 Min., Finalrunde 12 Min.',
      { finalRoundGameDuration: 12 },
      'Spielzeit: Gruppen 10 Min. · Finalrunde 12 Min. · Zeitstrafe 2 Min.',
    ],
    [
      'Sieg 2, Unentschieden 1',
      { pointSystem: { win: 2, draw: 1, loss: 0 } },
      'Platzierung: Sieg 2, Unentschieden 1 Punkt · Punkte – Tordifferenz – Tore – direkter Vergleich',
    ],
    [
      'direkter Vergleich vor Tordifferenz',
      {
        placementLogic: [
          { id: 'points', enabled: true },
          { id: 'directComparison', enabled: true },
          { id: 'goalDifference', enabled: true },
          { id: 'goalsFor', enabled: true },
        ],
      },
      'Platzierung: Punkte – direkter Vergleich – Tordifferenz – Tore',
    ],
    [
      'jeder gegen jeden ohne Finalrunde',
      { groupSystem: 'roundRobin', finalsConfig: { preset: 'none' } },
      'Modus: Jeder gegen jeden',
    ],
  ];

  it.each(PRIMARY_ROWS)('@DR-020 Zeile im Kopf für %s', (_name, overrides, line) => {
    expect(pdfRuleLines(rulesOf(overrides), de)).toContain(line);
  });

  it('@DR-020 jeder gegen jeden ohne Finalrunde: keine K.-o.-Zeile', () => {
    expect(koLines(rulesOf({ groupSystem: 'roundRobin', finalsConfig: { preset: 'none' } }), de)).toEqual([]);
  });

  it('@DR-020 Gegenbeispiel 3/1/0: kein Punkte-Zusatz in der Platzierung', () => {
    const lines = pdfRuleLines(rulesOf({ pointSystem: { win: 3, draw: 1, loss: 0 } }), de);
    expect(lines).toContain('Platzierung: Punkte – Tordifferenz – Tore – direkter Vergleich');
  });
});

describe('K.-o.-Zeilen je Runde (@DR-015)', () => {
  it('@DR-015 Halbfinale Strafstoßschießen, Finale Verlängerung: zwei Zeilen', () => {
    const rules = rulesOf({
      finalsConfig: {
        preset: 'top-4',
        tiebreakerByRound: { semifinal: 'shootout', final: 'overtime-then-shootout' },
      },
    });
    expect(koLines(rules, de)).toEqual([
      'Halbfinale: bei Gleichstand Strafstoßschießen, 5 Schützen',
      'Finale: bei Gleichstand Verlängerung, dann Strafstoßschießen, 5 Schützen',
    ]);
  });

  it('@DR-015 gleiche Regel in allen Runden: genau eine Zeile', () => {
    const rules = rulesOf({ finalsConfig: { preset: 'top-4', tiebreaker: 'shootout' } });
    expect(koLines(rules, de)).toHaveLength(1);
  });
});

describe('Schützenzahl folgt der Turnierkonfiguration (@DR-008)', () => {
  it('@DR-008 geänderte Schützenzahl 5 → 3 steht in der K.-o.-Zeile', () => {
    const rules = rulesOf({
      finalsConfig: { preset: 'top-4', tiebreaker: 'shootout' },
      matchCockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS, penaltyShootersPerTeam: 3 },
    });
    expect(koLines(rules, de)).toEqual(['K.-o.: bei Gleichstand Strafstoßschießen, 3 Schützen']);
  });
});

describe('Regelwerk nur wenn eingetragen (@DR-007)', () => {
  it.each([
    ['fehlt', undefined],
    ['leer', ''],
    ['nur Leerzeichen', '   '],
  ])('@DR-007 Regelwerk %s: keine Zeile „Regelwerk“', (_name, rulebook) => {
    const lines = pdfRuleLines(rulesOf({ title: 'Hallencup Ost' }, rulebook), de);
    expect(lines.some(line => line.startsWith('Regelwerk'))).toBe(false);
  });
});

describe('Englischer Wortlaut (@DR-022)', () => {
  it('@DR-022 EN: Zeilen und K.O.-Zeile in Englisch', () => {
    const rules = rulesOf({ finalsConfig: { preset: 'top-4', tiebreaker: 'shootout' } }, BFV);
    expect(pdfRuleLines(rules, en)).toEqual([
      'Mode: Groups + finals',
      'Placement: Points – Goal difference – Goals – head-to-head',
      'Game time: 10 min · Time penalty 2 min',
      `Rulebook: ${BFV}`,
    ]);
    expect(koLines(rules, en)).toEqual(['K.O.: if drawn, penalty shootout, 5 shooters']);
  });
});
