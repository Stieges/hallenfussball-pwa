/**
 * Regelzeilen des Spielplan-PDFs (B-28a3-3a, @DR-006, @DR-007, @DR-008, @DR-015, @DR-020, @DR-022).
 * Reine Logik mit der echten Ressource (`translatorFor`); kein Zeichnen. Die K.-o.-Runden kommen aus dem
 * erzeugten Plan (Fixliste B-28a3-3a, Punkt 1), nicht aus der Voreinstellung.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, type PlacementCriterion, type Team, type Tournament } from '../../../types/tournament';
import { koLines, pdfRuleLines, pdfRulesFrom, type PdfRules } from '../rules';
import { buildPdfTexts } from '../translations';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';
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

/** 16 Teams in vier Gruppen für die Achtelfinal-Konstellation (Plan über den echten Generator). */
const TEAMS_16: Team[] = Array.from({ length: 16 }, (_, i) => ({
  id: `team-${i + 1}`,
  name: `Team ${i + 1}`,
  group: 'ABCD'[i % 4],
}));

/**
 * Regeln des „Hallencup Nord“ mit Überschreibungen. Der Plan kommt aus dem echten Generator, damit die
 * K.-o.-Runden aus den erzeugten Spielen stammen. Das Regelwerk kommt nur, wenn es angegeben ist.
 */
function rulesOf(overrides: Partial<Tournament> = {}, rulebook?: string): PdfRules {
  const tournament = hallencupTournament({ placementLogic: PLACEMENT, ...overrides });
  return { ...pdfRulesFrom(tournament, hallencupSchedule(tournament)), rulebook };
}

describe('Adapter pdfRulesFrom (@DR-006)', () => {
  it('liest das Regelwerk, wenn das Feld am Turnier steht', () => {
    const tournament = Object.assign(hallencupTournament(), { rulebook: BFV });
    expect(pdfRulesFrom(tournament, hallencupSchedule(tournament)).rulebook).toBe(BFV);
  });

  it('liefert kein Regelwerk, solange das Feld fehlt (w1 noch nicht gemergt)', () => {
    const tournament = hallencupTournament();
    expect(pdfRulesFrom(tournament, hallencupSchedule(tournament)).rulebook).toBeUndefined();
  });
});

describe('Pflichtzeilen Kopf (@DR-006): Hallencup mit BFV-Regelwerk', () => {
  it('@DR-006 Modus, Platzierung, Spielzeit mit Zeitstrafe, Regelwerk in dieser Reihenfolge', () => {
    expect(pdfRuleLines(rulesOf({}, BFV), de)).toEqual([
      'Modus: Gruppen + Finale',
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

describe('Regeln folgen dem erzeugten Plan, nicht der Voreinstellung (Fixliste 1)', () => {
  it('jeder gegen jeden mit gespeicherter Voreinstellung top-4: keine K.-o.-Zeile, Spielzeit ohne Finalrunde', () => {
    const rules = rulesOf({ groupSystem: 'roundRobin', finalRoundGameDuration: 12, finalsConfig: { preset: 'top-4', tiebreaker: 'shootout' } });
    expect(koLines(rules, de)).toEqual([]);
    expect(pdfRuleLines(rules, de)).toContain('Spielzeit: 10 Min. · Zeitstrafe 2 Min.');
  });

  it('eine Gruppe mit top-4: keine K.-o.-Zeile, weil keine Finalrunde entsteht', () => {
    expect(koLines(rulesOf({ numberOfGroups: 1, finalsConfig: { preset: 'top-4', tiebreaker: 'shootout' } }), de)).toEqual([]);
  });

  it('top-8 mit zwei Gruppen und Viertelfinal-Regel: keine Zeile „Viertelfinale“', () => {
    const rules = rulesOf({
      finalsConfig: { preset: 'top-8', tiebreakerByRound: { quarterfinal: 'goldenGoal' } },
    });
    expect(koLines(rules, de).join('\n')).not.toContain('Viertelfinale');
  });

  it('genau ein Platzierungsspiel (Spiel um Platz 3) heißt auch in der K.-o.-Zeile so, nicht „Platzierungsspiele“', () => {
    const rules = rulesOf({ finalsConfig: { preset: 'top-4', tiebreakerByRound: { semifinal: 'goldenGoal' } } });
    expect(koLines(rules, de)).toEqual([
      'Halbfinale: bei Gleichstand Golden Goal',
      'Spiel um Platz 3 und Finale: bei Gleichstand Strafstoßschießen, 5 Schützen',
    ]);
  });

  it('@DR-015 Platzierungsspiele in mehreren Spielen (3/5/7) heißen „Platzierungsspiele“', () => {
    const rules = rulesOf({
      finalsConfig: { preset: 'all-places', tiebreakerByRound: { semifinal: 'goldenGoal' } },
    });
    expect(koLines(rules, de)).toEqual([
      'Halbfinale: bei Gleichstand Golden Goal',
      'Platzierungsspiele und Finale: bei Gleichstand Strafstoßschießen, 5 Schützen',
    ]);
  });

  it('top-16 gemischt: Aufzählung mit Komma und „und“, Viertelfinale und Platzierungsspiele in einer Zeile', () => {
    const tournament = hallencupTournament({
      groupSystem: 'groupsAndFinals',
      numberOfGroups: 4,
      numberOfTeams: 16,
      teams: TEAMS_16,
      placementLogic: PLACEMENT,
      finalsConfig: { preset: 'top-16', tiebreaker: 'goldenGoal', tiebreakerByRound: { semifinal: 'shootout' } },
    });
    const rules = { ...pdfRulesFrom(tournament, hallencupSchedule(tournament)), rulebook: undefined };
    expect(koLines(rules, de)).toEqual([
      'Viertelfinale, Platzierungsspiele und Finale: bei Gleichstand Golden Goal',
      'Halbfinale: bei Gleichstand Strafstoßschießen, 5 Schützen',
    ]);
  });
});

describe('Platzierungsspiel-Benennung und Wortlaute der Zweige (Fixliste 2 und 5)', () => {
  it('@DR-015 (a) nur Halbfinale und Finale weichen ab: Spiel um Platz 3 folgt dem Finale', () => {
    const rules = rulesOf({
      finalsConfig: {
        preset: 'top-4',
        tiebreakerByRound: { semifinal: 'shootout', final: 'overtime-then-shootout' },
      },
    });
    expect(koLines(rules, de)).toEqual([
      'Halbfinale: bei Gleichstand Strafstoßschießen, 5 Schützen',
      'Spiel um Platz 3 und Finale: bei Gleichstand Verlängerung, dann Strafstoßschießen, 5 Schützen',
    ]);
  });

  it('@DR-015 (b) Halbfinale und Platz-3-Spiel Strafstoß, Finale Verlängerung: zwei Zeilen', () => {
    const rules = rulesOf({
      finalsConfig: {
        preset: 'top-4',
        tiebreakerByRound: { semifinal: 'shootout', placement: 'shootout', final: 'overtime-then-shootout' },
      },
    });
    expect(koLines(rules, de)).toEqual([
      'Halbfinale und Spiel um Platz 3: bei Gleichstand Strafstoßschießen, 5 Schützen',
      'Finale: bei Gleichstand Verlängerung, dann Strafstoßschießen, 5 Schützen',
    ]);
  });

  it('@DR-015 (c) gleiche Regel in allen Runden: genau eine Zeile ohne Rundennamen', () => {
    const rules = rulesOf({ finalsConfig: { preset: 'top-4', tiebreaker: 'shootout' } });
    expect(koLines(rules, de)).toEqual(['K.-o.: bei Gleichstand Strafstoßschießen, 5 Schützen']);
  });

  it('Golden Goal als einzige Regel: Wortlaut in der K.-o.-Zeile', () => {
    const rules = rulesOf({ finalsConfig: { preset: 'top-4', tiebreaker: 'goldenGoal' } });
    expect(koLines(rules, de)).toEqual(['K.-o.: bei Gleichstand Golden Goal']);
  });

  it('Zeitstrafe in Sekunden: „Zeitstrafe 90 Sek.“', () => {
    const rules = rulesOf({
      matchCockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS, timePenaltyDurationSeconds: 90 },
    });
    expect(pdfRuleLines(rules, de)).toContain('Spielzeit: 10 Min. · Zeitstrafe 90 Sek.');
  });

  it('Niederlagenpunkte ungleich 0: Sieg 3, Unentschieden 2 Punkte, Niederlage 1 Punkt', () => {
    const rules = rulesOf({ pointSystem: { win: 3, draw: 2, loss: 1 } });
    expect(pdfRuleLines(rules, de)).toContain(
      'Platzierung: Sieg 3, Unentschieden 2 Punkte, Niederlage 1 Punkt · Punkte – Tordifferenz – Tore – direkter Vergleich',
    );
  });

  it('ein Schütze: „1 Schütze“ in der K.-o.-Zeile', () => {
    const rules = rulesOf({
      finalsConfig: { preset: 'top-4', tiebreaker: 'shootout' },
      matchCockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS, penaltyShootersPerTeam: 1 },
    });
    expect(koLines(rules, de)).toEqual(['K.-o.: bei Gleichstand Strafstoßschießen, 1 Schütze']);
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
  it('@DR-022 EN: Zeilen und Knockout-Zeile in Englisch', () => {
    const rules = rulesOf({ finalsConfig: { preset: 'top-4', tiebreaker: 'shootout' } }, BFV);
    expect(pdfRuleLines(rules, en)).toEqual([
      'Mode: Groups + Finals',
      'Placement: Points – Goal difference – Goals – head-to-head',
      'Game time: 10 min · Time penalty 2 min',
      `Rulebook: ${BFV}`,
    ]);
    expect(koLines(rules, en)).toEqual(['Knockout: if drawn, penalty shootout, 5 shooters']);
  });

  it('@DR-022 EN: Rundennamen klein in der Aufzählung, am Zeilenanfang groß', () => {
    const rules = rulesOf({
      finalsConfig: { preset: 'top-4', tiebreakerByRound: { semifinal: 'goldenGoal', final: 'shootout' } },
    });
    expect(koLines(rules, en)).toEqual([
      'Semi-finals: if drawn, golden goal',
      'Third-place match and final: if drawn, penalty shootout, 5 shooters',
    ]);
  });
});

describe('F6 N4 Test-Fixture nutzt die Produktions-ID „directComparison“', () => {
  it('die Factory trägt keine Kennung headToHead; die Regelzeile zeigt „direkter Vergleich“ klein', () => {
    const turnier = hallencupTournament();
    expect(turnier.placementLogic.map(criterion => criterion.id)).not.toContain('headToHead');
    const zeilen = pdfRuleLines(pdfRulesFrom(turnier, hallencupSchedule(turnier)), de);
    expect(zeilen.join('\n')).toContain('direkter Vergleich');
  });
});
