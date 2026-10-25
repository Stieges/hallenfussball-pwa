/**
 * tournament-lifecycle-fixture.ts — Hilfe für scripts/tournament-lifecycle-check.sh (A-21a-S, Plan Endstand und
 * Abschluss P-5, Review B2).
 *
 * Baut den ECHTEN Speicherweg SupabaseRepository.save() für ein unverändertes Turnier nach: Cloud-Zeilen lesen
 * (mapTournamentFromSupabase), wieder schreiben (mapTournamentToSupabase), dann in Repository-Reihenfolge
 *   1. tournaments-UPDATE mit version + 1, gefiltert auf id und alte version (Optimistic Locking),
 *   2. teams-Upsert (PostgREST: INSERT … ON CONFLICT (id) DO UPDATE SET <jede gesendete Spalte> = EXCLUDED.<Spalte>),
 *   3. je Spiel ein UPDATE mit mapMatchToScheduleUpdate (gefiltert auf id und tournament_id).
 * Keine Verbindung zu irgendeiner Datenbank. Eingabe (stdin): {"tournament": <Zeile>, "teams": [...], "matches": [...]},
 * wie `SELECT to_jsonb(...)` sie liefert. Ausgabe (stdout): {"tournament": SQL, "teams": SQL, "matches": [SQL, …]}.
 *
 * Nutzung: npx tsx scripts/tournament-lifecycle-fixture.ts < zeilen.json
 */
import { readFileSync } from 'node:fs';
import {
  mapMatchToScheduleUpdate,
  mapTournamentFromSupabase,
  mapTournamentToSupabase,
} from '../src/core/repositories/supabaseMappers';

type Row = Record<string, unknown>;
interface Input { tournament: Row; teams: Row[]; matches: Row[] }

const DELIM = '$J$';

function json(value: unknown): string {
  const text = JSON.stringify(value);
  if (text.includes(DELIM)) { throw new Error('Trennzeichen $J$ im JSON'); }
  return `${DELIM}${text}${DELIM}::jsonb`;
}

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) { throw new Error(`Unerwarteter Spaltenname: ${name}`); }
  return `"${name}"`;
}

function updateSql(table: string, set: Row, where: string): string {
  const cols = Object.keys(set).filter((c) => set[c] !== undefined).map(quoteIdent);
  return `UPDATE public.${table} SET (${cols.join(', ')}) = (SELECT ${cols.join(', ')} FROM jsonb_populate_record(NULL::public.${table}, ${json(set)})) WHERE ${where};`;
}

function upsertSql(table: string, rows: Row[]): string {
  const cols = Object.keys(rows[0]).map(quoteIdent);
  const updates = cols.filter((c) => c !== '"id"').map((c) => `${c} = EXCLUDED.${c}`);
  return `INSERT INTO public.${table} (${cols.join(', ')}) SELECT ${cols.join(', ')} FROM jsonb_populate_recordset(NULL::public.${table}, ${json(rows)}) ON CONFLICT (id) DO UPDATE SET ${updates.join(', ')};`;
}

/**
 * Das Pruefskript spielt die Zielmigration in einem aelteren Schema-Stand ein (spaetere Migrationen folgen erst danach).
 * Der heutige Mapper kennt aber schon spaetere Spalten (z. B. matches.original_start); die gelesenen DB-Zeilen nennen
 * die Spalten, die es im Pruefstand wirklich gibt -- nur diese werden geschrieben.
 */
function known(set: Row, sample: Row | undefined): Row {
  if (!sample) { return set; }
  return Object.fromEntries(Object.entries(set).filter(([k]) => k in sample));
}

const input = JSON.parse(readFileSync(0, 'utf8')) as Input;
const owner = String(input.tournament.owner_id);
// Die Zeilentypen der App kennen die neuen Spalten (lifecycle_status, finished_at) erst nach dem Typen-PR; der Lese-Mapper
// liest nur, was er kennt – wie in der App.
const tournament = mapTournamentFromSupabase(
  input.tournament as never, input.teams as never, input.matches as never,
);
const { tournamentRow, teamRows, matchRows } = mapTournamentToSupabase(tournament, owner);
const version = Number(input.tournament.version);
const remote = new Map(input.matches.map((m) => [String(m.id), m]));

const out = {
  tournament: updateSql('tournaments', known({ ...tournamentRow, version: version + 1 }, input.tournament),
    `id = '${String(input.tournament.id)}' AND version = ${version}`),
  teams: teamRows.length > 0 ? upsertSql('teams', (teamRows as unknown as Row[]).map((r) => known(r, input.teams[0]))) : 'SELECT 1;',
  matches: matchRows.map((row) => updateSql('matches',
    known(mapMatchToScheduleUpdate(row, remote.get(String(row.id)) as never) as Row, input.matches[0]),
    `id = '${String(row.id)}' AND tournament_id = '${String(input.tournament.id)}'`)),
};
process.stdout.write(JSON.stringify(out));
