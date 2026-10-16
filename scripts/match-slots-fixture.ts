/**
 * match-slots-fixture.ts — Hilfe für scripts/match-slots-check.sh (A-02, MVP-Bauplan Spur A).
 *
 * Erzeugt ein FRISCH ANGELEGTES Turnier über den echten App-Weg — TournamentCreationService.publish()
 * (Generator, Slots) → mapTournamentToSupabase() (Cloud-Zeilen) — und gibt als JSON aus:
 *   { sql: INSERTs für tournaments/teams/matches, groupMatchId, groupTeamAId, finalMatchId }
 * Die Zeilen sind genau das, was SupabaseRepository.save() an die Cloud schickt. Keine Verbindung zu
 * irgendeiner Datenbank — das Prüfskript spielt das SQL in seinen Wegwerf-Container ein.
 *
 * Nutzung: npx tsx scripts/match-slots-fixture.ts <owner-uuid>
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
  process.stderr.write('Aufruf: npx tsx scripts/match-slots-fixture.ts <owner-uuid>\n');
  process.exit(2);
}

function insertSql(table: string, rows: object[]): string {
  if (rows.length === 0) { return ''; }
  const cols = Object.keys(rows[0]);
  const list = cols.map((c) => `"${c}"`).join(', ');
  const json = JSON.stringify(rows);
  if (json.includes('$J$')) { throw new Error('Trennzeichen $J$ im JSON'); }
  return `INSERT INTO public.${table} (${list}) SELECT ${list} FROM jsonb_populate_recordset(NULL::public.${table}, $J$${json}$J$::jsonb);`;
}

async function main(): Promise<void> {
  let saved: Tournament | undefined;
  const repository = { save: (t: Tournament) => { saved = t; return Promise.resolve(); } } as unknown as ITournamentRepository;
  const teams = ['FC Nord', 'SV Süd', 'TuS Ost', 'SC West', 'VfB Mitte', 'SG Rand'].map((name, i) => ({
    id: randomUUID(),
    name,
    group: i < 3 ? 'A' : 'B',
  }));

  const tournament = await new TournamentCreationService(repository).publish({
    title: 'A-02 Hallencup',
    startTime: '09:00',
    numberOfFields: 2,
    numberOfTeams: 6,
    numberOfGroups: 2,
    groupSystem: 'groupsAndFinals',
    finalsConfig: { preset: 'top-4' },
    teams,
  });
  if (saved?.id !== tournament.id) { throw new Error('publish() hat nicht gespeichert'); }

  const { tournamentRow, teamRows, matchRows } = mapTournamentToSupabase(tournament, ownerId);
  const group = matchRows.find((m) => m.is_final === false);
  const final = matchRows.find((m) => m.is_final === true && m.team_a_id === null);
  if (!group || !final) { throw new Error('Gruppenspiel oder offenes Finalspiel fehlt'); }

  const sql = [
    insertSql('tournaments', [{ ...tournamentRow, version: 1 }]),
    insertSql('teams', teamRows),
    insertSql('matches', matchRows),
  ].join('\n');
  process.stdout.write(JSON.stringify({
    sql,
    tournamentId: tournament.id,
    groupMatchId: group.id,
    groupTeamAId: group.team_a_id,
    finalMatchId: final.id,
    matchCount: matchRows.length,
  }));
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
