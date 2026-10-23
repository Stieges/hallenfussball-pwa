/**
 * group-completion-fixture.ts — schreibt die Gleichlauf-Fixture src/core/standings/__fixtures__/group-state.json
 * (GA4 A-13b-S Punkt 3, task-GA4-plan-v2.md R-GA4v2-3/R-GA4v2-7, Review-Auflagen 1 und 7).
 *
 * Zeilen: echt erzeugt (src/test/groupCompletionRows.ts: publish → mapTournamentToSupabase), Nikolaus und Hallencup Nord.
 * Ergebnisse (`updates`): wie der Zwischenspeicher der Cloud nach append_match_events (score_a/score_b, match_status,
 * decided_by, forfeit_absent) – aus dem Gherkin (@W2A-067 Nikolaus-Lage, @W2A-048 Gruppe A) plus je ein laufendes,
 * ein nicht ausgetragenes, ein gewertetes und offene Spiele in Gruppe B.
 * Erwartung (`cases`): die Regel aus dem Plan, nicht aus dem SQL abgelesen –
 *   Gruppe '' ⇔ Spiel mit group_letter NULL, '' oder 'all' (R-GA4v2-7); je Gruppenspiel (nicht Finalrunde)
 *   {id, ta, tb, a, b, s, f} ohne null-Werte, s fehlend = 'scheduled', sortiert nach id (R-GA4v2-3, Fassung 2.1).
 * Zwillinge: SQL match_engine.group_state (scripts/group-completion-check.sh, Kategorie G), TS expectedState (A-13a).
 *
 * Nutzung: npx tsx scripts/group-completion-fixture.ts   (schreibt die Datei neu; IDs der Spiele ändern sich dabei)
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURE_OWNER_ID, generateRows, type GeneratedRows, type GeneratedTournamentKey } from '../src/test/groupCompletionRows';

type Row = Record<string, unknown>;

interface ResultSpec {
  a: string;
  b: string;
  scores?: readonly [number, number];
  status: 'finished' | 'running' | 'skipped';
  decidedBy?: 'regular' | 'forfeit';
  /** Wertung: wer fehlte, bezogen auf die Spalte (A = team_a). */
  forfeitAbsentOf?: string;
}

const NIKOLAUS: Record<string, string> = {
  K: 'DJK Kammer', R: 'TSV Waging rot', P: 'TSV Petting', D: 'DJK Otting', F: 'TSV 1921 Fridolfing', X: 'TSV Waging blau',
};
/** @W2A-067 (Nikolaus-Lage, wie src/core/standings/__tests__/fixtures.ts DATA.NIKOLAUS). */
const NIKOLAUS_RESULTS = 'K–R 2:1; K–P 2:2; D–K 2:1; K–F 2:0; K–X 3:0; R–D 2:2; R–P 4:0; R–F 3:0; R–X 3:0; P–D 1:1; P–F 3:1; P–X 3:1; D–X 3:1; F–D 4:1; F–X 1:1';

function parse(results: string, names: Record<string, string>): ResultSpec[] {
  return results.split(';').map((raw) => {
    const m = /^([A-Z])–([A-Z]) (\d+):(\d+)$/.exec(raw.trim());
    if (m === null) {
      throw new Error(`unlesbar: ${raw}`);
    }
    return { a: names[m[1]], b: names[m[2]], scores: [Number(m[3]), Number(m[4])] as const, status: 'finished', decidedBy: 'regular' };
  });
}

const HALLENCUP_RESULTS: ResultSpec[] = [
  // @W2A-048 Gruppe A: SV Süd und TSV West je 4 Punkte, 4:3 Tore
  { a: 'FC Nord', b: 'SV Süd', scores: [2, 1], status: 'finished', decidedBy: 'regular' },
  { a: 'FC Nord', b: 'TSV West', scores: [2, 1], status: 'finished', decidedBy: 'regular' },
  { a: 'FC Nord', b: 'SC Ost', scores: [0, 0], status: 'finished', decidedBy: 'regular' },
  { a: 'SV Süd', b: 'TSV West', scores: [1, 1], status: 'finished', decidedBy: 'regular' },
  { a: 'SV Süd', b: 'SC Ost', scores: [2, 0], status: 'finished', decidedBy: 'regular' },
  { a: 'TSV West', b: 'SC Ost', scores: [2, 0], status: 'finished', decidedBy: 'regular' },
  // Gruppe B: beendet, gewertet (TuS Tal fehlte, 2:0), nicht ausgetragen, laufend; zwei Spiele offen
  { a: 'SG Mitte', b: 'DJK Berg', scores: [2, 0], status: 'finished', decidedBy: 'regular' },
  { a: 'SG Mitte', b: 'TuS Tal', scores: [2, 0], status: 'finished', decidedBy: 'forfeit', forfeitAbsentOf: 'TuS Tal' },
  { a: 'VfB Ufer', b: 'TuS Tal', status: 'skipped' },
  { a: 'DJK Berg', b: 'VfB Ufer', scores: [1, 0], status: 'running' },
];

function teamIdByName(rows: GeneratedRows, name: string): string {
  const team = rows.teams.find((t) => t.name === name);
  if (team === undefined) {
    throw new Error(`Team fehlt: ${name}`);
  }
  return String(team.id);
}

function updatesFor(key: GeneratedTournamentKey, rows: GeneratedRows, specs: readonly ResultSpec[]): Row[] {
  return specs.map((spec) => {
    const a = teamIdByName(rows, spec.a);
    const b = teamIdByName(rows, spec.b);
    const match = rows.matches.find((m) => m.is_final === false
      && ((m.team_a_id === a && m.team_b_id === b) || (m.team_a_id === b && m.team_b_id === a)));
    if (match === undefined) {
      throw new Error(`Spiel fehlt: ${spec.a} – ${spec.b}`);
    }
    const flipped = match.team_a_id === b;
    const scoreA = spec.scores === undefined ? null : spec.scores[flipped ? 1 : 0];
    const scoreB = spec.scores === undefined ? null : spec.scores[flipped ? 0 : 1];
    const absent = spec.forfeitAbsentOf === undefined ? null
      : (teamIdByName(rows, spec.forfeitAbsentOf) === match.team_a_id ? 'A' : 'B');
    return {
      tournament: key,
      id: match.id,
      score_a: scoreA,
      score_b: scoreB,
      match_status: spec.status,
      decided_by: spec.status === 'finished' ? (spec.decidedBy ?? 'regular') : null,
      forfeit_absent: absent,
    };
  });
}

/** Regel aus dem Plan (siehe Kopf), unabhängig vom SQL. */
const groupKey = (letter: unknown): string => (letter === null || letter === undefined || letter === '' || letter === 'all' ? '' : String(letter));

function expectedState(rows: GeneratedRows, updates: readonly Row[], group: string): Row[] {
  return rows.matches
    .filter((m) => m.is_final !== true && groupKey(m.group_letter) === group)
    .map((m) => ({ ...m, ...(updates.find((u) => u.id === m.id) ?? {}) }))
    .map((m) => {
      const entry: Row = { id: m.id, ta: m.team_a_id, tb: m.team_b_id, a: m.score_a, b: m.score_b, s: m.match_status ?? 'scheduled', f: m.forfeit_absent };
      return Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== null && v !== undefined));
    })
    .sort((x, y) => (String(x.id) < String(y.id) ? -1 : String(x.id) > String(y.id) ? 1 : 0));
}

async function main(): Promise<void> {
  const nikolaus = await generateRows('nikolaus');
  const hallencup = await generateRows('hallencup');
  const updates = [
    ...updatesFor('nikolaus', nikolaus, parse(NIKOLAUS_RESULTS, NIKOLAUS)),
    ...updatesFor('hallencup', hallencup, HALLENCUP_RESULTS),
  ];
  const cases = [
    { tournament: 'nikolaus', group: '', note: 'Jeder gegen jeden: alle 15 Spiele (group_letter all)' },
    { tournament: 'nikolaus', group: 'all', note: "'all' ist keine eigene Gruppe (nur group_key bildet es ab)" },
    { tournament: 'nikolaus', group: 'A', note: 'kein Spiel' },
    { tournament: 'hallencup', group: 'A', note: '@W2A-048 Gruppe A, 6 Spiele beendet' },
    { tournament: 'hallencup', group: 'B', note: 'beendet, gewertet, nicht ausgetragen, laufend, offen' },
    { tournament: 'hallencup', group: '', note: 'Turnier mit Gruppen: Gruppe "" ohne Spiele (Finalrunde zählt nie)' },
  ].map((c) => ({
    ...c,
    expected: expectedState(c.tournament === 'nikolaus' ? nikolaus : hallencup, updates.filter((u) => u.tournament === c.tournament), c.group),
  }));
  const fixture = {
    $comment: 'Erzeugt von scripts/group-completion-fixture.ts (A-13b-S Punkt 3). Zwillinge: match_engine.group_state (scripts/group-completion-check.sh, Kategorie G) und expectedState aus A-13a (GroupCompletionService). Zeilen echt erzeugt (publish -> mapTournamentToSupabase), Ergebnisse = Zwischenspeicher nach append_match_events, Erwartung = Regel R-GA4v2-3/R-GA4v2-7.',
    owner: FIXTURE_OWNER_ID,
    tournaments: { nikolaus, hallencup },
    updates,
    cases,
  };
  const target = resolve(dirname(fileURLToPath(import.meta.url)), '../src/core/standings/__fixtures__/group-state.json');
  writeFileSync(target, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
  process.stdout.write(`geschrieben: ${target} (${updates.length} Ergebnisse, ${cases.length} Fälle)\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
