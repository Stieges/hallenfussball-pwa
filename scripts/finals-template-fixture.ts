/**
 * finals-template-fixture.ts — Hilfe für scripts/finals-template-check.sh (A-12a, Plan GA4 v2 § 5).
 *
 * Erzeugt „Hallencup Nord“ (2 Gruppen à 4 Teams, Vorlage „Alle Plätze“) über den echten App-Weg —
 * TournamentCreationService.publish() (Generator, Vorlage, Phase) → mapTournamentToSupabase() (Cloud-Zeilen) — und gibt
 * als JSON aus:
 *   { sqlBase: INSERTs für tournaments/teams/matches OHNE Platz 5/7, sqlPlaces57: INSERT der Spiele um Platz 5 und 7,
 *     tournamentId, finalCount, places57Count }
 * Platz 5/7 stehen getrennt, weil `matches_final_type_check` (Baseline :930) `fifthSixth`/`seventhEighth` bis G1 ablehnt
 * (Befund C-FINALTYPE-PLATZ5-7, Erweiterung in `20261110_005`). Keine Verbindung zu irgendeiner Datenbank.
 *
 * Nutzung: npx tsx scripts/finals-template-fixture.ts <owner-uuid>
 */
import { randomUUID, webcrypto } from 'node:crypto';
import { TournamentCreationService } from '../src/core/services/TournamentCreationService';
import { mapTournamentToSupabase } from '../src/core/repositories/supabaseMappers';
import type { ITournamentRepository } from '../src/core/repositories/ITournamentRepository';
import type { Tournament } from '../src/core/models/types';

// publish() erzeugt den Share-Code über window.crypto (src/utils/shareCode.ts).
(globalThis as unknown as { window: { crypto: typeof webcrypto } }).window = { crypto: webcrypto };

const ownerId = process.argv[2];
if (!ownerId) {
  process.stderr.write('Aufruf: npx tsx scripts/finals-template-fixture.ts <owner-uuid>\n');
  process.exit(2);
}

function insertSql(table: string, rows: object[]): string {
  if (rows.length === 0) { return ''; }
  // Spalten aller Zeilen: Gruppenspiele tragen kein origin_a/b (A-36a), Finalspiele schon
  const cols = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const list = cols.map((c) => `"${c}"`).join(', ');
  const json = JSON.stringify(rows);
  if (json.includes('$J$')) { throw new Error('Trennzeichen $J$ im JSON'); }
  return `INSERT INTO public.${table} (${list}) SELECT ${list} FROM jsonb_populate_recordset(NULL::public.${table}, $J$${json}$J$::jsonb);`;
}

async function main(): Promise<void> {
  let saved: Tournament | undefined;
  const repository = { save: (t: Tournament) => { saved = t; return Promise.resolve(); } } as unknown as ITournamentRepository;
  const names = ['FC Nord', 'SV Süd', 'DJK Berg', 'TuS Tal', 'TSV West', 'SC Ost', 'FC Mitte', 'SV Hof'];
  const teams = names.map((name, i) => ({ id: randomUUID(), name, group: i < 4 ? 'A' : 'B' }));

  const tournament = await new TournamentCreationService(repository).publish({
    title: 'A-12a Hallencup Nord',
    startTime: '13:00',
    numberOfFields: 2,
    numberOfTeams: teams.length,
    numberOfGroups: 2,
    groupSystem: 'groupsAndFinals',
    finalsConfig: { preset: 'all-places' },
    teams,
  });
  if (saved?.id !== tournament.id) { throw new Error('publish() hat nicht gespeichert'); }

  const { tournamentRow, teamRows, matchRows } = mapTournamentToSupabase(tournament, ownerId);
  const isPlace57 = (row: { final_type?: string | null }) => row.final_type === 'fifthSixth' || row.final_type === 'seventhEighth';
  const base = matchRows.filter((row) => !isPlace57(row));
  const places57 = matchRows.filter(isPlace57);

  process.stdout.write(JSON.stringify({
    sqlBase: [
      insertSql('tournaments', [{ ...tournamentRow, version: 1 }]),
      insertSql('teams', teamRows),
      insertSql('matches', base),
    ].join('\n'),
    sqlPlaces57: insertSql('matches', places57),
    tournamentId: tournament.id,
    finalCount: matchRows.filter((row) => row.is_final === true).length,
    places57Count: places57.length,
  }));
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
