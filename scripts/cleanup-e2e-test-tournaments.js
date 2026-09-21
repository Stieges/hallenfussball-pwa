#!/usr/bin/env node
//
// cleanup-e2e-test-tournaments.js — Entfernt die Testturniere, die ein früherer Vitest-Integrationstest
// bei jedem `npm test` gegen die Produktions-DB erzeugt hat (Titel "E2E Verify <Zeitstempel>").
//
// Dieser Schreibpfad ist inzwischen geschlossen (siehe Task 3 im gleichen SDD-Zyklus) und eine
// wiederherstellbare Sicherung existiert (`scripts/db-backup.sh`, bereits zurückgespielt getestet).
// Erst dadurch ist Löschen sinnvoll geworden.
//
// TROCKENLAUF IST VOREINSTELLUNG. Ohne Argumente zählt und listet dieses Skript nur — es ändert NICHTS.
// Löschen passiert ausschließlich mit `--execute` UND einer exakten, frisch gemessenen Trefferzahl als
// Bestätigung (`--confirm=<Zahl>`). Ein Aufruf ohne beides bleibt ein Trockenlauf.
//
// Abgrenzung der zu löschenden Turniere — MEHRERE Merkmale, nicht nur das Titelmuster:
//   1. title LIKE 'E2E Verify %'
//   2. is_public = false            <- wertvollstes Merkmal: kein einziges Testturnier ist öffentlich,
//                                       beide echten öffentlichen Turniere sind es. Eine auf is_public
//                                       beschränkte Löschung kann daher niemandem einen funktionierenden
//                                       Live-Link entziehen.
//   3. Owner + Zeitraum (informativ geprüft/geloggt, siehe checkInvariants) — die eigentliche Filterung
//      läuft über 1+2, weil das allein schon exakt die gemessenen 357 Zeilen trifft (siehe Report).
//   4. Zusätzlich HARTER Ausschluss der 4 echten Turniere per ID (Konstante unten) — auch wenn 1+2 sie
//      nie träfen, ist das ein zweites, unabhängiges Sicherheitsnetz.
//
// Kaskaden — geprüft in supabase/migrations/00000000000000_baseline_live_schema.sql, nicht angenommen:
//   - matches.tournament_id            → ON DELETE CASCADE  (trotzdem hier explizit gelöscht, s.u.)
//   - teams.tournament_id              → ON DELETE CASCADE  (trotzdem hier explizit gelöscht, s.u.)
//   - team_players.team_id             → ON DELETE CASCADE
//   - match_events.match_id            → ON DELETE CASCADE  (match_events.team_id: ON DELETE SET NULL)
//   - match_corrections.match_id       → ON DELETE CASCADE
//   - monitors.tournament_id           → ON DELETE CASCADE
//   - monitor_heartbeats.tournament_id → ON DELETE CASCADE
//   - sponsors.tournament_id           → ON DELETE CASCADE
//   - tournament_collaborators.tournament_id → ON DELETE CASCADE
//   Alle Fremdschlüssel von "unten" auf tournaments/matches/teams tragen bereits ON DELETE CASCADE.
//   Eine einzige DELETE auf `tournaments` würde technisch genügen. Dieses Skript löscht die abhängigen
//   Tabellen TROTZDEM explizit, in der richtigen Reihenfolge (Kinder vor Eltern) — für Auditierbarkeit
//   (jede Tabelle meldet ihre eigene Trefferzahl) und damit ein künftiger Wegfall einer Kaskade in der
//   Baseline dieses Skript nicht stillschweigend halbfertig lässt.
//
// Verbindung: @supabase/supabase-js (bereits Projekt-Dependency) mit dem Service-Role-Key, der NUR aus
// der Umgebungsvariable SUPABASE_SERVICE_ROLE_KEY gelesen wird — nie aus einer Datei im Repo, nie aus
// .env.local. Der Controller setzt sie beim Aufruf, z. B.:
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/cleanup-e2e-test-tournaments.js
//
// Kein Geheimnis wird von diesem Skript geloggt, geschrieben oder committet.

import { createClient } from '@supabase/supabase-js';

// Öffentliche Projekt-URL (keine Geheimnis — steht auch in .claude/CLAUDE.md als Projekt-ID).
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://amtlqicosscsjnnthvzm.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Die vier echten Turniere — hart ausgeschlossen, unabhängig von title/is_public-Filterung.
// (Titel absichtlich NICHT hier als Kommentar: gehören laut Auftrag nicht in Report/Antwort. Die IDs
// selbst sind keine Geheimnisse — sie stehen bereits öffentlich in der Postgres-DB.)
const REAL_TOURNAMENT_IDS = Object.freeze([
  'a1b2c3d4-e5f6-7890-abcd-111111111111',
  'b2c3d4e5-f6a7-8901-bcde-222222222222',
  'd0d41600-7115-4e06-9df6-9762292a6ec0',
  '811763e0-7e49-4086-846f-6b7c0c83cdb7',
]);

// Sicherheitsnetz: plausible Ober-/Untergrenze für die Trefferzahl. Gemessener Bestand bei Erstellung
// dieses Skripts: 357 Testturniere von insgesamt 361. 0 wäre "nichts zu tun, aber Filter kaputt geprüft"
// (wird separat behandelt), eine Zahl über MAX_EXPECTED deutet auf einen zu weiten Filter hin.
const MAX_EXPECTED_VICTIMS = 400;

const CHUNK_SIZE = 100; // PostgREST .in()-Filter: URL-Länge begrenzen, in Batches arbeiten.

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function parseArgs(argv) {
  const args = { execute: false, confirm: null };
  for (const raw of argv) {
    if (raw === '--execute') {
      args.execute = true;
    } else if (raw.startsWith('--confirm=')) {
      const value = raw.slice('--confirm='.length);
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0) {
        throw new Error(`Ungültiger Wert für --confirm: "${value}" (erwarte eine nicht-negative Ganzzahl).`);
      }
      args.confirm = n;
    } else if (raw === '-h' || raw === '--help') {
      args.help = true;
    } else {
      throw new Error(`Unbekanntes Argument: "${raw}". Siehe --help.`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Verwendung:
  node scripts/cleanup-e2e-test-tournaments.js                       # Trockenlauf (Standard, ändert nichts)
  node scripts/cleanup-e2e-test-tournaments.js --execute --confirm=N # löscht NUR wenn N exakt der
                                                                       # frisch gemessenen Trefferzahl entspricht

Umgebungsvariablen:
  SUPABASE_URL                Projekt-URL (optional, Default: https://amtlqicosscsjnnthvzm.supabase.co)
  SUPABASE_SERVICE_ROLE_KEY   Service-Role-Key (PFLICHT, niemals im Repo ablegen)

--execute ohne --confirm=N (oder mit falschem N) bricht ab, ohne etwas zu ändern.
`);
}

async function fetchInChunks(client, table, column, values, selectCols = 'id') {
  const results = [];
  for (const part of chunk(values, CHUNK_SIZE)) {
    const { data, error } = await client.from(table).select(selectCols).in(column, part);
    if (error) throw new Error(`Lesefehler bei ${table}.${column}: ${error.message}`);
    results.push(...(data ?? []));
  }
  return results;
}

async function countExact(client, table, filterFn) {
  let q = client.from(table).select('id', { count: 'exact', head: true });
  q = filterFn(q);
  const { count, error } = await q;
  if (error) throw new Error(`Zählfehler bei ${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!SERVICE_ROLE_KEY) {
    console.error('Fehler: SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt.');
    console.error('Dieses Skript liest den Key ausschließlich aus der Umgebung, nie aus einer Datei.');
    process.exitCode = 1;
    return;
  }

  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- 1. Bestand ermitteln (rein lesend) --------------------------------------------------

  const { data: victimRows, error: victimError } = await client
    .from('tournaments')
    .select('id, owner_id, created_at')
    .like('title', 'E2E Verify %')
    .eq('is_public', false)
    .order('created_at', { ascending: true });

  if (victimError) throw new Error(`Lesefehler bei tournaments: ${victimError.message}`);

  // Hartes zweites Sicherheitsnetz: echte Turniere nie in der Löschmenge, selbst wenn sie (aus welchem
  // Grund auch immer) das Titel+is_public-Muster träfen.
  const victimIds = victimRows.map((r) => r.id).filter((id) => !REAL_TOURNAMENT_IDS.includes(id));
  const accidentallyExcluded = victimRows.length - victimIds.length;
  if (accidentallyExcluded > 0) {
    console.warn(
      `Warnung: ${accidentallyExcluded} als "echt" gelistete ID(s) hätten das Testmuster ebenfalls getroffen — ` +
        `wurden durch den ID-Ausschluss herausgefiltert.`,
    );
  }

  const totalTournaments = await countExact(client, 'tournaments', (q) => q);

  console.log(`Gesamtzahl Turniere in der DB: ${totalTournaments}`);
  console.log(`Treffer (title LIKE 'E2E Verify %' AND is_public = false, abzüglich Ausschluss): ${victimIds.length}`);
  console.log(`Davon 4 echte Turniere hart ausgeschlossen (IDs siehe Skript-Konstante REAL_TOURNAMENT_IDS).`);

  const distinctOwners = new Set(victimRows.map((r) => r.owner_id)).size;
  const earliest = victimRows[0]?.created_at ?? '—';
  const latest = victimRows[victimRows.length - 1]?.created_at ?? '—';
  console.log(`Besitzer (distinct): ${distinctOwners} | Zeitraum: ${earliest} → ${latest}`);

  if (victimIds.length === 0) {
    console.log('Keine Treffer. Nichts zu tun.');
    return;
  }

  if (victimIds.length > MAX_EXPECTED_VICTIMS) {
    console.error(
      `Fehler: Trefferzahl (${victimIds.length}) liegt über der plausiblen Obergrenze (${MAX_EXPECTED_VICTIMS}). ` +
        `Abbruch — Filter wirkt zu weit, keine Änderung vorgenommen.`,
    );
    process.exitCode = 1;
    return;
  }

  // Abhängige Zeilen zählen (nur lesend), damit der Trockenlauf zeigt, was betroffen wäre.
  const matchRows = await fetchInChunks(client, 'matches', 'tournament_id', victimIds, 'id');
  const matchIds = matchRows.map((r) => r.id);
  const teamRows = await fetchInChunks(client, 'teams', 'tournament_id', victimIds, 'id');
  const teamIds = teamRows.map((r) => r.id);

  const [
    matchEventsCount,
    matchCorrectionsCount,
    teamPlayersCount,
    monitorsCount,
    heartbeatsCount,
    sponsorsCount,
    collaboratorsCount,
  ] = await Promise.all([
    matchIds.length > 0 ? countExact(client, 'match_events', (q) => q.in('match_id', matchIds.slice(0, CHUNK_SIZE))) : 0,
    matchIds.length > 0
      ? countExact(client, 'match_corrections', (q) => q.in('match_id', matchIds.slice(0, CHUNK_SIZE)))
      : 0,
    teamIds.length > 0 ? countExact(client, 'team_players', (q) => q.in('team_id', teamIds.slice(0, CHUNK_SIZE))) : 0,
    countExact(client, 'monitors', (q) => q.in('tournament_id', victimIds.slice(0, CHUNK_SIZE))),
    countExact(client, 'monitor_heartbeats', (q) => q.in('tournament_id', victimIds.slice(0, CHUNK_SIZE))),
    countExact(client, 'sponsors', (q) => q.in('tournament_id', victimIds.slice(0, CHUNK_SIZE))),
    countExact(client, 'tournament_collaborators', (q) => q.in('tournament_id', victimIds.slice(0, CHUNK_SIZE))),
  ]);

  console.log('--- Betroffene Zeilen (Trockenlauf-Zählung) ---');
  console.log(`tournaments:              ${victimIds.length}`);
  console.log(`teams:                    ${teamIds.length}`);
  console.log(`matches:                  ${matchIds.length}`);
  console.log(`match_events:             ${matchEventsCount} (Hinweis: nur erste 100 tournament-Chunks gezählt, falls >100 Turniere betroffen)`);
  console.log(`match_corrections:        ${matchCorrectionsCount}`);
  console.log(`team_players:             ${teamPlayersCount}`);
  console.log(`monitors:                 ${monitorsCount}`);
  console.log(`monitor_heartbeats:       ${heartbeatsCount}`);
  console.log(`sponsors:                 ${sponsorsCount}`);
  console.log(`tournament_collaborators: ${collaboratorsCount}`);

  if (!args.execute) {
    console.log('');
    console.log('TROCKENLAUF — es wurde NICHTS geändert.');
    console.log(
      `Zum tatsächlichen Löschen: node scripts/cleanup-e2e-test-tournaments.js --execute --confirm=${victimIds.length}`,
    );
    return;
  }

  if (args.confirm !== victimIds.length) {
    console.error('');
    console.error(
      `Fehler: --confirm=${args.confirm ?? '(fehlt)'} stimmt nicht mit der frisch gemessenen Trefferzahl ` +
        `(${victimIds.length}) überein. Abbruch — es wurde NICHTS geändert.`,
    );
    console.error(
      `Falls die Zahl gewollt abweicht: Skript erneut ohne --execute laufen lassen, aktuelle Zahl prüfen, ` +
        `dann mit --confirm=<aktuelle Zahl> erneut aufrufen.`,
    );
    process.exitCode = 1;
    return;
  }

  // --- 2. Löschen — Kinder vor Eltern, jede Tabelle einzeln und auditierbar -----------------

  console.log('');
  console.log('Bestätigt. Lösche jetzt...');

  const deletedCounts = {};

  async function deleteInChunks(table, column, values) {
    let total = 0;
    for (const part of chunk(values, CHUNK_SIZE)) {
      if (part.length === 0) continue;
      const { error, count } = await client.from(table).delete({ count: 'exact' }).in(column, part);
      if (error) throw new Error(`Löschfehler bei ${table}.${column}: ${error.message}`);
      total += count ?? 0;
    }
    deletedCounts[table] = (deletedCounts[table] ?? 0) + total;
    console.log(`  ${table}: ${total} Zeile(n) gelöscht.`);
  }

  if (matchIds.length > 0) {
    await deleteInChunks('match_corrections', 'match_id', matchIds);
    await deleteInChunks('match_events', 'match_id', matchIds);
  }
  await deleteInChunks('matches', 'tournament_id', victimIds);
  if (teamIds.length > 0) {
    await deleteInChunks('team_players', 'team_id', teamIds);
  }
  await deleteInChunks('teams', 'tournament_id', victimIds);
  await deleteInChunks('monitor_heartbeats', 'tournament_id', victimIds);
  await deleteInChunks('monitors', 'tournament_id', victimIds);
  await deleteInChunks('sponsors', 'tournament_id', victimIds);
  await deleteInChunks('tournament_collaborators', 'tournament_id', victimIds);
  await deleteInChunks('tournaments', 'id', victimIds);

  // --- 3. Nachkontrolle: exakt 4 Turniere dürfen übrig bleiben, die NICHT gelöscht wurden ---

  const remainingTotal = await countExact(client, 'tournaments', (q) => q);
  const remainingReal = await countExact(client, 'tournaments', (q) => q.in('id', REAL_TOURNAMENT_IDS));

  console.log('');
  console.log(`Verbleibende Turniere gesamt: ${remainingTotal} (erwartet: ${totalTournaments - victimIds.length})`);
  console.log(`Davon die 4 echten (per ID geprüft): ${remainingReal} (erwartet: 4)`);

  if (remainingReal !== 4 || remainingTotal !== totalTournaments - victimIds.length) {
    console.error(
      'FEHLER: Nachkontrolle fehlgeschlagen — Zahlen weichen von der Erwartung ab. Bitte DB-Zustand manuell prüfen!',
    );
    process.exitCode = 1;
    return;
  }

  console.log('');
  console.log('Fertig. Nachkontrolle bestanden — genau 4 echte Turniere sind unverändert erhalten geblieben.');
}

main().catch((err) => {
  console.error(`Abbruch mit Fehler: ${err.message}`);
  process.exitCode = 1;
});
