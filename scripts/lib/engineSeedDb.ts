/**
 * scripts/lib/engineSeedDb.ts — datenbanknaher Teil des Engine-Seeds (A-23, übernimmt C3b-3a).
 *
 * Schreibt Spiele nur über `append_match_events` (Owner-JWT, S1) und prüft den Zustand danach
 * mit den reinen Bausteinen aus `engineSeed.ts`. Lesen geschieht mit dem Service-Role-Client
 * (`admin`). Kein Spalten-PATCH auf Engine-Spielen.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { mapMatchEventToSupabase } from '../../src/core/repositories/liveMatchMappers';
import { callAppendMatchEvents } from '../../src/core/repositories/appendMatchEventsRpc';
import type { MatchEvent } from '../../src/core/models/LiveMatch';
import type { Database } from '../../src/types/supabase';
import {
  assertAllAccepted,
  assertAutoSelectHitsEngineMatch,
  assertFinishedDuration,
  assertRunningDuration,
  assertStartAtNearSeed,
  assertStateAndEngineRows,
  assertTeamsSet,
  buildEngineEvents,
  type FieldMatchLike,
  type SeedEventInput,
} from './engineSeed';

/** Mindestformat der App (`MatchEngineProvider.tsx`, `20260928_001_match_event_log.sql`). */
const CLIENT_FORMAT = 1;

export type SeedForm = 'running' | 'finished' | 'untouched';

export interface EngineSeedDeps {
  admin: SupabaseClient;
  ownerClient: SupabaseClient<Database>;
  seedNow: number;
  log: (message: string) => void;
}

export interface EngineMatchSeed {
  slug: string;
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  form: SeedForm;
  specs: readonly SeedEventInput[];
  idFor: (key: string) => string;
  startOffsetMs: number;
  expected: { status: string; scoreA: number; scoreB: number };
}

interface MatchRow {
  team_a_id: string | null;
  team_b_id: string | null;
  match_status: string | null;
  score_a: number | null;
  score_b: number | null;
  live_state: unknown;
}

interface EngineRow {
  id: string;
  type: string;
  client_time: string | null;
  payload: unknown;
}

async function readMatch(admin: SupabaseClient, matchId: string): Promise<MatchRow> {
  const { data, error } = await admin
    .from('matches')
    .select('team_a_id,team_b_id,match_status,score_a,score_b,live_state')
    .eq('id', matchId)
    .single<MatchRow>();
  if (error) {
    throw new Error(`Spiel ${matchId}: lesen fehlgeschlagen: ${error.message}`);
  }
  return data;
}

async function readEngineRows(admin: SupabaseClient, matchId: string): Promise<EngineRow[]> {
  const { data, error } = await admin
    .from('match_events')
    .select('id,type,client_time,payload')
    .eq('match_id', matchId)
    .not('event_format', 'is', null)
    .order('seq', { ascending: true })
    .returns<EngineRow[]>();
  if (error) {
    throw new Error(`Spiel ${matchId}: Engine-Zeilen lesen fehlgeschlagen: ${error.message}`);
  }
  return data;
}

/** Seed-Assertionen und Ereignisse eines Engine-Spiels (S1-S4); wirft bei jeder Abweichung. */
export async function seedEngineMatch(deps: EngineSeedDeps, seed: EngineMatchSeed): Promise<void> {
  const { admin, ownerClient, seedNow, log } = deps;
  const row = await readMatch(admin, seed.matchId);
  assertTeamsSet(seed.slug, row, seed);
  log(`Spiel ${seed.slug}: Teams gesetzt.`);

  if (seed.form === 'untouched') {
    const engineRows = (await readEngineRows(admin, seed.matchId)).length;
    assertStateAndEngineRows(seed.slug, { status: row.match_status, engineRows }, { status: 'scheduled', engineRows: 0 });
    log(`Spiel ${seed.slug}: untouched (scheduled, keine Engine-Zeile).`);
    return;
  }

  const envelopes = buildEngineEvents(seed.specs, {
    slug: seed.slug,
    seedNow,
    homeTeamId: seed.homeTeamId,
    awayTeamId: seed.awayTeamId,
    idFor: seed.idFor,
  });
  const [start, ...rest] = envelopes;
  if (!start || start.type !== 'MATCH_START') {
    throw new Error(`Spiel ${seed.slug}: das erste Seed-Ereignis muss MATCH_START sein.`);
  }

  // MATCH_START in einem EIGENEN Aufruf (S4): danach live_state lesen, erst dann die Folge.
  const startResponse = await callAppendMatchEvents(ownerClient, seed.matchId, [start], { clientFormat: CLIENT_FORMAT });
  assertAllAccepted(seed.slug, [start], startResponse);
  const afterStart = await readMatch(admin, seed.matchId);
  const startRow = (await readEngineRows(admin, seed.matchId)).find((engineRow) => engineRow.type === 'MATCH_START');
  if (!startRow?.client_time) {
    throw new Error(`Spiel ${seed.slug}: gespeicherte MATCH_START-Zeile ohne client_time.`);
  }
  assertStartAtNearSeed(seed.slug, Date.parse(startRow.client_time), seedNow, seed.startOffsetMs);
  if (seed.form === 'running') {
    assertRunningDuration(seed.slug, afterStart.live_state);
    const live = afterStart.live_state as { durationSeconds?: number } | null;
    log(`Spiel ${seed.slug}: running, Dauer ${live?.durationSeconds ?? '?'} s, ein Abschnitt, MATCH_START bei seedNow-60 s.`);
  }

  if (rest.length > 0) {
    const restResponse = await callAppendMatchEvents(ownerClient, seed.matchId, rest, { clientFormat: CLIENT_FORMAT });
    assertAllAccepted(seed.slug, rest, restResponse);
  }

  if (seed.form === 'finished') {
    const stored = (await readEngineRows(admin, seed.matchId)).find((engineRow) => engineRow.type === 'MATCH_START');
    assertFinishedDuration(seed.slug, stored?.payload);
    log(`Spiel ${seed.slug}: finished, Dauer laut MATCH_START-Regeln >= 3600 s.`);
  }

  const final = await readMatch(admin, seed.matchId);
  if (final.match_status !== seed.expected.status || final.score_a !== seed.expected.scoreA || final.score_b !== seed.expected.scoreB) {
    throw new Error(
      `Spiel ${seed.slug}: Endstand ${final.match_status} ${final.score_a}:${final.score_b}, erwartet ${seed.expected.status} ${seed.expected.scoreA}:${seed.expected.scoreB}.`
    );
  }
}

/** S6/S7: Auto-Auswahl-Assertion für Turniere mit mehreren Spielen (Live-Cup, Public-Cup). */
export async function assertEngineAutoSelect(
  admin: SupabaseClient,
  cupName: string,
  tournamentId: string,
  engineMatchId: string
): Promise<void> {
  const { data, error } = await admin
    .from('matches')
    .select('id,field,slot,match_status')
    .eq('tournament_id', tournamentId)
    .returns<Array<{ id: string; field: number; slot: number; match_status: string | null }>>();
  if (error) {
    throw new Error(`${cupName}: Spiele lesen fehlgeschlagen: ${error.message}`);
  }
  const matches: FieldMatchLike[] = data.map((match) => ({ id: match.id, field: match.field, slot: match.slot, status: match.match_status }));
  assertAutoSelectHitsEngineMatch(cupName, matches, engineMatchId);
}

/** S8: Altspiel-Cups tragen keine Engine-Zeile und den erwarteten Rohstatus. */
export async function assertLegacyMatch(admin: SupabaseClient, slug: string, matchId: string, status: string): Promise<void> {
  const row = await readMatch(admin, matchId);
  const engineRows = (await readEngineRows(admin, matchId)).length;
  assertStateAndEngineRows(slug, { status: row.match_status, engineRows }, { status, engineRows: 0 });
}

/** Alt-Ereignisse (ohne event_format) für das Ghost-Altspiel, Muster des früheren Live-Cup-Seeds. */
export async function insertLegacyGhostEvents(
  admin: SupabaseClient,
  matchId: string,
  homeTeamId: string | null,
  idFor: (key: string) => string
): Promise<void> {
  const events: MatchEvent[] = [
    { id: idFor('legacy-goal'), matchId, timestampSeconds: 180, type: 'GOAL', payload: { team: 'home' }, scoreAfter: { home: 1, away: 0 } },
    { id: idFor('legacy-start'), matchId, timestampSeconds: 30, type: 'STATUS_CHANGE', payload: { toStatus: 'RUNNING' }, scoreAfter: { home: 0, away: 0 } },
  ];
  const rows = events.map((event) => {
    const eventRow = mapMatchEventToSupabase(event, matchId);
    if (event.payload.team === 'home') {
      eventRow.team_id = homeTeamId;
    }
    return eventRow;
  });
  const { error } = await admin.from('match_events').insert(rows);
  if (error) {
    throw new Error(`Altspiel-Ereignisse: ${error.message}`);
  }
}
