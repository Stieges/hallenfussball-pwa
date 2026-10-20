/**
 * SupabaseRepository - Supabase implementation of ITournamentRepository
 *
 * Stores tournaments, teams, and matches in Supabase PostgreSQL.
 * Supports real-time subscriptions and optimistic concurrency control.
 *
 * @see ITournamentRepository for interface documentation
 * @see supabaseMappers.ts for type conversion logic
 */

import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ITournamentRepository } from './ITournamentRepository';
import { Tournament, MatchUpdate } from '../models/types';
import { OptimisticLockError, TeamStillReferencedError, RepositoryError, AuthenticationError, UnreadableResponseError, isAbortError, toOriginImmutableError } from '../errors';
import { notifyMatchesProtected } from '../services/matchProtectionNotices';
import type { Database } from '../../types/supabase';
import type { StandingDecision } from '../../types/tournament';
import { writeStandingDecisionsToCloud, writePlacementsToPlayOutToCloud } from './standingDecisionsCloud';
import {
  mapTournamentFromSupabase,
  mapTournamentToSupabase,
  mapMatchUpdateToSupabase,
  mapMatchToScheduleUpdate,
  mapTeamToSupabase,
  type TournamentUpdate,
} from './supabaseMappers';

/**
 * Gets the Supabase client or throws an error if not configured.
 * This is used by SupabaseRepository to ensure Supabase is available.
 */
function getSupabase() {
  if (!supabase) {
    throw new Error(
      'SupabaseRepository requires Supabase to be configured. ' +
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.'
    );
  }
  return supabase;
}

/** A-08f3a: Cloud-Stand eines Turniers mit Revision je Spiel. */
export interface CloudReadWithRevisions {
  tournament: Tournament;
  matchRevisions: Map<string, number>;
}

export class SupabaseRepository implements ITournamentRepository {
  constructor() {
    if (!isSupabaseConfigured) {
      throw new Error(
        'Cannot create SupabaseRepository: Supabase is not configured. ' +
        'Use LocalStorageRepository instead or configure Supabase environment variables.'
      );
    }
  }
  /**
   * Loads a tournament by ID with all related data (teams, matches)
   */
  async get(id: string): Promise<Tournament | null> {
    return (await this.getWithMatchRevisions(id))?.tournament ?? null;
  }

  /**
   * A-08f3a: wie `get`, dazu die Server-Revision je Spiel (`matches.version`, nur durch Einträge erhöht).
   * Grundlage für den Feldweg in `OfflineRepository` (Regel S, Monotonie je Spiel).
   */
  async getWithMatchRevisions(id: string): Promise<CloudReadWithRevisions | null> {
    // Fetch tournament
    const { data: tournamentRow, error: tournamentError } = await getSupabase()
      .from('tournaments')
      .select('*')
      .eq('id', id)
      .single();

    if (tournamentError) {
      if (tournamentError.code === 'PGRST116') {
        // Not found
        return null;
      }
      // AbortError is expected during navigation, StrictMode unmount, etc.
      if (isAbortError(tournamentError)) {
        return null;
      }
      console.error('Failed to fetch tournament:', tournamentError);
      throw new RepositoryError('get', tournamentError.message, tournamentError);
    }

    // Fetch teams
    const { data: teamRows, error: teamsError } = await getSupabase()
      .from('teams')
      .select('*')
      .eq('tournament_id', id)
      .order('sort_order', { ascending: true });

    if (teamsError) {
      if (isAbortError(teamsError)) {
        return null;
      }
      console.error('Failed to fetch teams:', teamsError);
      throw new RepositoryError('get', teamsError.message, teamsError);
    }

    // Fetch matches
    const { data: matchRows, error: matchesError } = await getSupabase()
      .from('matches')
      .select('*')
      .eq('tournament_id', id)
      .order('match_number', { ascending: true });

    if (matchesError) {
      if (isAbortError(matchesError)) {
        return null;
      }
      console.error('Failed to fetch matches:', matchesError);
      throw new RepositoryError('get', matchesError.message, matchesError);
    }

    // Convert to frontend types. B-19b (@ME-032): lässt sich die empfangene Antwort nicht abbilden, ist sie
    // „unlesbar“ (kein Netzfehler); der Monitor lädt dann neu.
    try {
      return {
        tournament: mapTournamentFromSupabase(tournamentRow, teamRows, matchRows),
        matchRevisions: new Map(matchRows.map((row) => [row.id, row.version ?? 1])),
      };
    } catch (err) {
      throw new UnreadableResponseError('get', err);
    }
  }

  /**
   * Updates only specific metadata fields of a tournament.
   * Prevents overwriting valid teams/matches when only changing settings.
   */
  async updateTournamentMetadata(id: string, metadata: Partial<Tournament>): Promise<void> {
    const updatePayload: TournamentUpdate = {};

    // Map frontend fields to DB columns
    if (metadata.title !== undefined) {updatePayload.title = metadata.title;}
    if (metadata.date !== undefined) {updatePayload.date = metadata.date;}
    if (metadata.status !== undefined) {updatePayload.status = metadata.status;}
    if (metadata.startTime !== undefined) {updatePayload.start_time = metadata.startTime;}
     
    if (metadata.location) {
      if (metadata.location.name !== undefined) {updatePayload.location_name = metadata.location.name;}
      if (metadata.location.street !== undefined) {updatePayload.location_street = metadata.location.street;}
      if (metadata.location.city !== undefined) {updatePayload.location_city = metadata.location.city;}
      if (metadata.location.postalCode !== undefined) {updatePayload.location_postal_code = metadata.location.postalCode;}
      if (metadata.location.country !== undefined) {updatePayload.location_country = metadata.location.country;}
    }
     
    if (metadata.isPublic !== undefined) {updatePayload.is_public = metadata.isPublic;}
    if (metadata.shareCode !== undefined) {updatePayload.share_code = metadata.shareCode;}

    // Only update if there are fields to update
    if (Object.keys(updatePayload).length === 0) {
      return;
    }

    if (metadata.version !== undefined) {
      updatePayload.version = metadata.version + 1;
    }

    updatePayload.updated_at = new Date().toISOString();

    let query = getSupabase()
      .from('tournaments')
      .update(updatePayload)
      .eq('id', id);

    if (metadata.version !== undefined) {
      query = query.eq('version', metadata.version);
    }


    const { data: updatedRows, error: updateError } = await query.select('id');

    if (updateError) {
      console.error('Failed to update tournament metadata:', updateError);
      throw new RepositoryError('updateMetadata', updateError.message, updateError);
    }

     
    if (metadata.version !== undefined && (!updatedRows || updatedRows.length === 0)) {
      // Optimistic Lock Failed
      throw new OptimisticLockError('Turnier-Daten wurden zwischenzeitlich verändert.');
    }
  }

  /**
   * Saves a full tournament object (create or update)
   * Uses upsert for tournament, teams, and matches
   *
   * WARNING: This replaces all teams and matches. For granular updates,
   * use updateMatch() or updateMatches() instead.
   */
  async save(tournament: Tournament): Promise<void> {
    // Get current user for owner_id
    const {
      data: { user },
      error,
    } = await getSupabase().auth.getUser();
    if (!user) {
      // A-06a (Brief A1b): Netzfehler bei auth.getUser() ist vorübergehend, kein Fehlversuch.
      if (error && error.name !== 'AuthSessionMissingError') {
        throw new RepositoryError('save', error.message, error);
      }
      throw new AuthenticationError('Not authenticated', 'save');
    }

    // Convert to Supabase format
    const { tournamentRow, teamRows, matchRows } = mapTournamentToSupabase(
      tournament,
      user.id
    );

    // =========================================================================================
    // A6 (.superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A6-brief.md, C-K6; Fixrunde 1,
    // task-A6-review.md I1/I2, Ruling AN): find PROTECTED matches -- missing from the local
    // tournament (stale device, a regenerated schedule, ...) but already having match_events, or
    // a match_status other than 'scheduled'/NULL -- BEFORE any write happens.
    //
    // I1: this must run before the tournament row, teams, AND matches are touched. The earlier
    // version (Fixrunde 0) ran this check only inside step 3 (matches), AFTER step 2 had already
    // deleted teams missing from the local state. If a protected match's own team was ALSO
    // missing locally, that team was deleted before the match-level check ever ran -- the match
    // row itself survived, but `matches.team_a_id`/`team_b_id` (ON DELETE SET NULL, baseline
    // :1485/:1489) were wiped by the team deletion anyway, silently losing the pairing (and, via
    // `match_events.team_id`/`team_players`, the scorer attribution) despite the match "surviving".
    // Fix: compute `protectedTeamIds` here too and exclude them from `teamsToDelete` below.
    //
    // I2 (Ruling AN): a protected match no longer makes save() THROW. `save()` completes the
    // rest of the tournament normally; only the protected match(es) are excluded from
    // `matchesToDelete`. The caller (MutationQueue) sees this SAVE_TOURNAMENT mutation as a
    // SUCCESS -- throwing here would count as a failed attempt and, after MAX_RETRIES, dead-letter
    // the mutation, permanently blocking every later save of this tournament (the queue is FIFO
    // and keeps re-trying the SAME stale payload). The caller instead learns about the kept
    // match(es) via `notifyMatchesProtected()` (see `core/services/matchProtectionNotices.ts` for
    // why this needs its own channel instead of a return value or thrown error) once the save
    // actually succeeds, below.
    const { data: existingMatches, error: existingMatchesError } = await getSupabase()
      .from('matches')
      .select('id, match_status, match_number, team_a_id, team_b_id')
      .eq('tournament_id', tournament.id);

    if (existingMatchesError) {
      console.error('Failed to read existing matches:', existingMatchesError);
      throw new RepositoryError('saveMatches', existingMatchesError.message, existingMatchesError);
    }

    const existingMatchIds = new Set((existingMatches ?? []).map((m) => m.id));
    const newMatchIds = new Set(matchRows.map((m) => m.id));
    const candidateMatchesToDelete = [...existingMatchIds].filter((id) => !newMatchIds.has(id));

    const matchNumberById = new Map(
      (existingMatches ?? []).map((m) => [m.id, m.match_number] as const)
    );
    let blockedMatchIds: string[] = [];
    const protectedTeamIds = new Set<string>();

    if (candidateMatchesToDelete.length > 0) {
      const matchStatusById = new Map(
        (existingMatches ?? []).map((m) => [m.id, m.match_status] as const)
      );
      const matchTeamsById = new Map(
        (existingMatches ?? []).map((m) => [m.id, [m.team_a_id, m.team_b_id] as const])
      );

      const { data: eventRows, error: eventsError } = await getSupabase()
        .from('match_events')
        .select('match_id')
        .in('match_id', candidateMatchesToDelete);

      if (eventsError) {
        console.error('Failed to check match_events before deleting matches:', eventsError);
        throw new RepositoryError('saveMatches', eventsError.message, eventsError);
      }

      const matchIdsWithEvents = new Set((eventRows ?? []).map((e) => e.match_id));
      blockedMatchIds = candidateMatchesToDelete.filter((id) => {
        const status = matchStatusById.get(id);
        const isScheduledOrNull = status === 'scheduled' || status === null || status === undefined;
        return matchIdsWithEvents.has(id) || !isScheduledOrNull;
      });

      for (const id of blockedMatchIds) {
        const [teamAId, teamBId] = matchTeamsById.get(id) ?? [null, null];
        if (teamAId) { protectedTeamIds.add(teamAId); }
        if (teamBId) { protectedTeamIds.add(teamBId); }
      }
    }

    const matchesToDelete = candidateMatchesToDelete.filter((id) => !blockedMatchIds.includes(id));

    const { data: existingTeams, error: existingTeamsError } = await getSupabase()
      .from('teams')
      .select('id, name')
      .eq('tournament_id', tournament.id);

    if (existingTeamsError) {
      console.error('Failed to read existing teams:', existingTeamsError);
      throw new RepositoryError('saveTeams', existingTeamsError.message, existingTeamsError);
    }

    const newTeamIds = new Set(teamRows.map((t) => t.id));
    const teamsToDelete = (existingTeams ?? [])
      .map((t) => t.id)
      .filter((id) => !newTeamIds.has(id) && !protectedTeamIds.has(id));

    // A-05 Fixrunde 1 (@FU-086): Zeigt ein zu speicherndes Spiel noch auf ein Team, das gelöscht würde, setzt
    // ON DELETE SET NULL die Seite leer, und matches_slot_*_present lehnt mit 23514 ab -- NACH halb
    // geschriebenem Stand. Der Zustand ist ein Fehler des Aufrufers (Spiele passen nicht zu den Teams):
    // laut abbrechen, bevor irgendetwas geschrieben wird. TeamStillReferencedError ist nicht transient
    // (isTransientMutationError), die Warteschlange zählt ihn als Fehlversuch und legt den Eintrag nach
    // MAX_RETRIES im Dead-Letter ab, statt ihn endlos zu wiederholen.
    {
      const doomed = new Set(teamsToDelete);
      const stillReferenced = matchRows.find(
        (m) => doomed.has(m.team_a_id ?? '') || doomed.has(m.team_b_id ?? '')
      );
      if (stillReferenced) {
        throw new TeamStillReferencedError(stillReferenced.id ?? '');
      }
    }

    // Start transaction-like operation
    // Note: Supabase doesn't support true transactions in the client,
    // but we can use RPC for atomic operations if needed

    // 1. Persist Tournament (with Optimistic Locking)
    let saveError = null;

     
    if (tournament.version !== undefined && tournament.version !== null) {
      // Optimistic Locking: Only update if version matches
      const nextVersion = tournament.version + 1;

      // Try update first
      const { data, error } = await getSupabase()
        .from('tournaments')
        .update({ ...tournamentRow, version: nextVersion })
        .eq('id', tournament.id)
        .eq('version', tournament.version)
        .select();

      if (error) {
        saveError = error;
       
      } else if (!data || data.length === 0) {
        // No update happened - check if it exists (Conflict) or is new (Insert)
        const { data: existing } = await getSupabase()
          .from('tournaments')
          .select('id')
          .eq('id', tournament.id)
          .single();

        if (existing) {
          throw new OptimisticLockError('Turnier wurde zwischenzeitlich verändert. Bitte neu laden.');
        } else {
          // New tournament with predefined version? Treat as insert
          const { error: insertError } = await getSupabase()
            .from('tournaments')
            .insert({ ...tournamentRow, version: 1 }); // Start at version 1
          saveError = insertError;
        }
      }
    } else {
      // Legacy/Fallback: Upsert (Blind Overwrite)
      // If version is missing, we initialize it to 1 if inserting
      const { error } = await getSupabase()
        .from('tournaments')
        .upsert({ ...tournamentRow, version: tournamentRow.version ?? 1 }, { onConflict: 'id' });
      saveError = error;
    }

    if (saveError) {
      console.error('Failed to save tournament:', saveError);
      throw new RepositoryError('save', saveError.message, saveError);
    }

    // 2. Teams anlegen/aktualisieren -- VOR den Spielen (A-02, V-TEAM-Review I6): ein neues Spiel
    // darf nur auf ein Team zeigen, das es in der Cloud schon gibt (FK team_a_id/team_b_id).
    // Zu löschende Teams (lokal entfernt, nicht von einem geschützten Spiel gebraucht) werden erst in
    // Schritt 4 gelöscht -- hier schon berechnet, weil sie den Upsert blockieren können (s. u.).

    // A-02 Fixrunde 1 (Review I3): Ein lokal entferntes Team, dessen Name ein eingehendes (neues)
    // Team trägt („FC Nord“ raus, neues „FC Nord“ rein), existiert beim Upsert noch -- teams
    // UNIQUE(tournament_id, name) würde mit 23505 ablehnen und die SAVE_TOURNAMENT-Mutation dauerhaft
    // blockieren. Deshalb NUR diese Teams vorher umbenennen (Name + „ ~“ + ID-Anfang); gelöscht werden
    // sie wie bisher in Schritt 4. Zähl-Prüfung wie R5-H1: 0 Zeilen (RLS) scheitert laut.
    const incomingNames = new Set(teamRows.map((t) => t.name));
    const deleteIds = new Set(teamsToDelete);
    const collidingTeams = (existingTeams ?? []).filter(
      (t) => deleteIds.has(t.id) && typeof t.name === 'string' && incomingNames.has(t.name)
    );
    for (const team of collidingTeams) {
      const { data: renamed, error: renameError } = await getSupabase()
        .from('teams')
        .update({ name: `${team.name} ~${team.id.slice(0, 8)}` })
        .eq('id', team.id)
        .select('id');

      if (renameError || (renamed?.length ?? 0) !== 1) {
        const message = `Failed to rename team ${team.id} before replacing it: ${renameError?.message ?? '0 rows updated (RLS?), expected 1'}`;
        console.error(message);
        throw new RepositoryError('saveTeams', message, renameError ?? undefined);
      }
    }

    if (teamRows.length > 0) {
      const { error: teamsError } = await getSupabase()
        .from('teams')
        .upsert(teamRows, { onConflict: 'id' });

      if (teamsError) {
        console.error('Failed to save teams:', teamsError);
        throw new RepositoryError('saveTeams', teamsError.message, teamsError);
      }
    }

    // 3. Handle matches - delete removed (excluding protected, computed above), upsert existing.
    // R5b/R5-H1, same reasoning as the teams delete (step 4) -- matches_delete_v2 gates on 'restructure' too.
    // `matchesToDelete` already excludes `blockedMatchIds` (A6, computed before any write above).
    if (matchesToDelete.length > 0) {
      const { data: deletedMatches, error: deleteError } = await getSupabase()
        .from('matches')
        .delete()
        .in('id', matchesToDelete)
        .select('id');

      if (deleteError) {
        console.error('Failed to delete matches:', deleteError);
        throw new RepositoryError('saveMatches', deleteError.message, deleteError);
      }

      if ((deletedMatches?.length ?? 0) !== matchesToDelete.length) {
        const message = `Expected to delete ${matchesToDelete.length} match(es), but only ${deletedMatches?.length ?? 0} were actually deleted (permission denied for the rest).`;
        console.error(message);
        throw new RepositoryError('saveMatches', message);
      }
    }

    // Insert new matches, update existing matches -- SEPARATELY (A2, task-A2-brief.md). Before this fix, a single `.upsert(matchRows)` wrote EVERY column of `mapMatchToSupabase`
    // for EVERY match, including a helper's live/result columns (score_a/b, match_status, timer,
    // overtime/penalty, decided_by, ...). If the tournament owner still had an older local
    // tournament state (e.g. after only renaming a team) and saved the whole tournament while a
    // helper was running a live match, the owner's stale row overwrote the helper's current
    // match state in the cloud. A NEW match has no live state yet, so it is still fully inserted;
    // an EXISTING match is updated with ONLY the schedule columns via
    // `mapMatchToScheduleUpdate` -- never the live/result ones.
    const newMatchRows = matchRows.filter(
      (m) => typeof m.id !== 'string' || !existingMatchIds.has(m.id)
    );
    const existingMatchRows = matchRows.filter(
      (m): m is typeof m & { id: string } => typeof m.id === 'string' && existingMatchIds.has(m.id)
    );

    if (newMatchRows.length > 0) {
      // A-36a: origin_a/b (Migration 20261026_001) fehlen in supabase.ts bis zur Regeneration -- Hochcast per Zuweisung.
      const insertRows: Database['public']['Tables']['matches']['Insert'][] = newMatchRows;
      const { error: insertError } = await getSupabase()
        .from('matches')
        // ON CONFLICT DO NOTHING: an insert must never overwrite an existing row with neutral initial values.
        .upsert(insertRows, { onConflict: 'id', ignoreDuplicates: true });

      if (insertError) {
        console.error('Failed to insert matches:', insertError);
        throw new RepositoryError('saveMatches', insertError.message, insertError);
      }
    }

    if (existingMatchRows.length > 0) {
      const matchTeamsByIdForUpdate = new Map(
        (existingMatches ?? []).map((m) => [m.id, { team_a_id: m.team_a_id, team_b_id: m.team_b_id }] as const)
      );
      // A2 Fixrunde 1 (I3, .superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A2-review.md):
      // the review's OWN suggested fix -- a single batch `upsert()` with only the schedule
      // columns -- turned out to be UNSAFE, not just "geht nicht direkt" for NOT-NULL reasons.
      // `matches_insert_v2` requires the 'restructure' permission, `matches_update_v3` only
      // 'writeMatchData' (`supabase/migrations/20260924_002_central_role_permissions.sql:325-353`,
      // `rolePermissions.json`). An `INSERT ... ON CONFLICT (id) DO UPDATE` statement is
      // evaluated against BOTH the INSERT and the UPDATE RLS policy by Postgres, even when every
      // row already exists and only the UPDATE branch actually fires. A `collaborator` (Helfer)
      // has `writeMatchData` and `teams` but NOT `restructure` (`rolePermissions.json`) and can
      // reach this exact path today (e.g. renaming a team via `TeamsTab`, permission `teams`) --
      // switching to a batch upsert would silently lock every collaborator out of a full save
      // that touches ANY existing match row, a regression this task must not introduce.
      // Verifying this against a real RLS-enforced Postgres needs the local stack, which was busy
      // with another task during this fix round -- documented instead of merged untested.
      //
      // Kept per-row `.update()` (same RLS shape as before A2), but PARALLELIZED via
      // `Promise.all` instead of a sequential `for` loop -- this removes the actual complaint (N
      // *sequential* round-trips) without touching the RLS-relevant statement shape at all.
      // A2 Fixrunde 1 (M3): `.select('id')` so a silently RLS-filtered 0-row UPDATE surfaces as an
      // error instead of a no-op -- same reasoning as the R5-H1 delete-count check above (a
      // plain `.update()` without `.select()` reports no Postgres `error` even when RLS's USING
      // clause matched nothing).
      const results = await Promise.all(
        existingMatchRows.map(async (row) => {
          // A-02 (C2, @TM-027): Cloud-Besetzung mitgeben -- eine lokal offene Seite setzt eine in
          // der Cloud bereits aufgelöste Seite nicht zurück.
          const scheduleUpdate = mapMatchToScheduleUpdate(row, matchTeamsByIdForUpdate.get(row.id));
          const { data, error: updateError } = await getSupabase()
            .from('matches')
            .update(scheduleUpdate)
            .eq('id', row.id)
            .eq('tournament_id', tournament.id)
            .select('id');
          return { id: row.id, error: updateError, updatedCount: data?.length ?? 0 };
        })
      );

      const errors = results.filter((r) => r.error !== null || r.updatedCount === 0);
      if (errors.length > 0) {
        for (const { id, error } of errors) { console.error(`Failed to update match ${id}:`, error ?? '0 rows updated (RLS?), expected 1'); }
        const immutable = errors.map((r) => toOriginImmutableError(r.id, r.error)).find((e) => e !== undefined);
        if (immutable) { throw immutable; } // A-36a: HF002 nicht transient, Muster TeamStillReferencedError
        throw new RepositoryError(
          'saveMatches',
          `Failed to update ${errors.length} match(es): ${errors
            .map((e) => `${e.id}: ${e.error?.message ?? `0 rows updated (expected 1, got ${e.updatedCount})`}`)
            .join('; ')}`
        );
      }
    }

    // 4. Teams löschen -- NACH den Spielen (A-02, V-TEAM-Review I6): zeigt ein bleibendes Spiel
    // noch auf ein Team, das lokal fehlt, scheitert das Löschen laut (FK/Pflicht-Besetzung) statt die
    // Paarung still zu verlieren; Spiele, die das Team nicht mehr brauchen, sind hier schon weg/umgestellt.
    // Delete teams that are no longer in the tournament
    //
    // R5b/R5-H1 (.superpowers/sdd/2026-09-22-rechte-und-cockpit-2/task-R5b-brief.md): teams_delete_v2
    // (DB) allows this only for callers with the 'restructure' permission (owner/co-admin) -- a
    // caller WITHOUT it (e.g. a collaborator, who never has 'restructure') hits 0 matching rows,
    // NOT an error. Before this fix the mismatch was silently swallowed: the app believed the
    // delete had happened, left stale rows in the cloud, and the schedule ended up duplicated
    // once the subsequent upsert (INSERT ... ON CONFLICT DO UPDATE) succeeded for that same
    // caller. Counting the actually-deleted rows and throwing on a mismatch converts this into a
    // loud error that reaches the existing MutationQueue retry/dead-letter path instead.
    // I1 (task-A6-review.md, Fixrunde 1): a team referenced by a PROTECTED match (computed above,
    // before any write) is excluded here too -- otherwise the team gets deleted (missing locally,
    // same as the match), and `matches.team_a_id`/`team_b_id` (ON DELETE SET NULL) silently loses
    // the pairing on the match that was supposedly "kept".
    // `teamsToDelete` wird vor Schritt 2 berechnet (A-02 Fixrunde 1, Umbenennen bei Namenskollision).
    if (teamsToDelete.length > 0) {
      const { data: deletedTeams, error: deleteError } = await getSupabase()
        .from('teams')
        .delete()
        .in('id', teamsToDelete)
        .select('id');

      if (deleteError) {
        console.error('Failed to delete teams:', deleteError);
        throw new RepositoryError('saveTeams', deleteError.message, deleteError);
      }

      if ((deletedTeams?.length ?? 0) !== teamsToDelete.length) {
        const message = `Expected to delete ${teamsToDelete.length} team(s), but only ${deletedTeams?.length ?? 0} were actually deleted (permission denied for the rest).`;
        console.error(message);
        throw new RepositoryError('saveTeams', message);
      }
    }

    // A6 (I2, Ruling AN): the save succeeded in full -- if any match was kept instead of deleted,
    // tell whoever is listening (see core/services/matchProtectionNotices.ts for why this can't
    // be the return value or a thrown error).
    if (blockedMatchIds.length > 0) {
      notifyMatchesProtected({
        tournamentId: tournament.id,
        matches: blockedMatchIds.map((id) => ({ id, matchNumber: matchNumberById.get(id) ?? null })),
      });
    }
  }

  /**
   * Updates a specific match atomically
   * This is the preferred method for live match updates
   */
  async updateMatch(tournamentId: string, update: MatchUpdate): Promise<void> {
    return this.updateMatches(tournamentId, [update]);
  }

  /**
   * Team-Spalten der Cloud-Zeilen für Updates mit offener Seite (M3). Nur bei Bedarf gelesen; ein
   * Lesefehler bricht das Update laut ab (kein Schreiben auf Verdacht).
   */
  private async readRemoteSides(
    tournamentId: string,
    updates: MatchUpdate[]
  ): Promise<Map<string, { team_a_id: string | null; team_b_id: string | null }>> {
    const ids = updates
      .filter((u) => [u.slotA, u.slotB].some((slot) => slot?.kind === 'pending'))
      .map((u) => u.id);
    const sides = new Map<string, { team_a_id: string | null; team_b_id: string | null }>();
    if (ids.length === 0) {
      return sides;
    }
    const { data, error } = await getSupabase()
      .from('matches')
      .select('id, team_a_id, team_b_id')
      .eq('tournament_id', tournamentId)
      .in('id', ids);
    if (error) {
      throw new RepositoryError('updateMatches', `Cloud-Besetzung nicht lesbar: ${error.message}`, error);
    }
    for (const row of data ?? []) {
      sides.set(row.id, { team_a_id: row.team_a_id, team_b_id: row.team_b_id });
    }
    return sides;
  }

  /**
   * Bulk updates multiple matches atomically
   */
  async updateMatches(
    tournamentId: string,
    updates: MatchUpdate[],
    baseVersion?: number
  ): Promise<void> {
    if (updates.length === 0) {
      return;
    }

    // Update each match (besser: Batch-RPC)
    const errors: Error[] = [];
    let sent = 0;

    // A-03 (M3, C2): enthält ein Update eine OFFENE Seite, die Cloud-Besetzung vorher lesen – ein veralteter
    // Stand dieses Geräts setzt eine aufgelöste Seite nie zurück.
    const remoteSides = await this.readRemoteSides(tournamentId, updates);

    for (const update of updates) {
      // A-02: Spielseiten aus dem Slot, keine Name→ID-Suche über die Teams-Tabelle.
      const supabaseUpdate = mapMatchUpdateToSupabase(update, remoteSides.get(update.id));

      // V4/F6: nur updated_at (reine Ergebnis-Änderung) → Zeile nicht touchen (syncDown
      // meldete sonst dauerhaft "remote is newer"), kein Zähler++, kein tournaments-Bump.
      if (Object.keys(supabaseUpdate).every((k) => k === 'updated_at')) { continue; }
      sent++;

      // `.select('id')` meldet still gefilterte 0-Zeilen-Updates als Fehler statt No-op
      // (Risiko 4, wie save()/delete-count). Bewusst NUR hier: Helfer haben writeMatchData,
      // aber nicht zwingend tournaments-Schreibrecht — dort würde die Prüfung jeden Edit melden.
      const { data, error } = await getSupabase()
        .from('matches')
        .update(supabaseUpdate)
        .eq('id', update.id)
        .eq('tournament_id', tournamentId)
        .select('id');

      if (error) {
        console.error(`Failed to update match ${update.id}:`, error);
        errors.push(toOriginImmutableError(update.id, error) ?? new Error(`Match ${update.id}: ${error.message}`)); // A-36a: HF002
      } else if (!data || data.length === 0) {
        console.error(`Failed to update match ${update.id}: 0 rows updated (RLS or missing row), expected 1`);
        errors.push(new Error(`Match ${update.id}: 0 rows updated (RLS or missing row), expected 1`));
      }
    }

    // Update tournament's updated_at timestamp AND version if provided (nur bei sent > 0, F6)
    if (sent > 0) {
      const updatePayload: TournamentUpdate = { updated_at: new Date().toISOString() };
      if (baseVersion !== undefined) { updatePayload.version = baseVersion + 1; }

      let query = getSupabase()
        .from('tournaments')
        .update(updatePayload)
        .eq('id', tournamentId);

      if (baseVersion !== undefined) { query = query.eq('version', baseVersion); }

      // We utilize the version check here too
      const { data: updatedT, error: tError } = await query.select('id');

      if (tError) {
        errors.push(new Error(`Failed to update tournament timestamp: ${tError.message}`));
      } else if (baseVersion !== undefined && (!updatedT || updatedT.length === 0)) {
        errors.push(new OptimisticLockError('Turnier wurde zwischenzeitlich verändert (Matches).'));
      }
    }

    if (errors.length > 0) {
      throw new RepositoryError(
        'updateMatches',
        `Failed to update matches/tournament: ${errors.map((e) => e.message).join('; ')}`,
        errors
      );
    }
  }

  /**
   * Deletes a tournament and all related data.
   *
   * A6 (.superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A6-brief.md): this used to
   * delete matches and teams via two SEPARATE, direct DELETE statements BEFORE deleting the
   * tournament row itself ("in case cascade isn't set up"). The baseline schema proves that
   * assumption wrong -- `matches_tournament_id_fkey` and `teams_tournament_id_fkey` (and every
   * other tournament_id/match_id foreign key: teams, sponsors, monitors, monitor_heartbeats,
   * tournament_collaborators, match_events, match_corrections) are all `ON DELETE CASCADE`
   * (supabase/migrations/00000000000000_baseline_live_schema.sql:1461-1533). Deleting matches
   * as a standalone statement is not just redundant, it is actively harmful now that
   * `matches_protect_events_before_delete` (supabase/migrations/20260925_002_...) exists: a
   * direct `DELETE FROM matches WHERE tournament_id = ...` is NOT a cascade (the tournament row
   * still exists at that point), so the trigger would reject it for every match that already has
   * match_events -- blocking a legitimate whole-tournament deletion. Deleting ONLY the tournament
   * row and letting the foreign keys cascade keeps the trigger's cascade exception
   * (`pg_trigger_depth() > 1`) true, so a tournament with matches AND events can still be deleted
   * in one step, exactly as intended.
   */
  /** Paket TB: nur `config.standingDecisions`, mit Versionsprüfung (`standingDecisionsCloud.ts`). */
  updateStandingDecisions(tournamentId: string, decisions: StandingDecision[], expectedVersion: number): Promise<void> {
    return writeStandingDecisionsToCloud(getSupabase(), tournamentId, decisions, expectedVersion);
  }

  /** Fixrunde TB-6: nur `config.placementsToPlayOut`, mit Versionsprüfung (`standingDecisionsCloud.ts`). */
  updatePlacementsToPlayOut(tournamentId: string, places: number[], expectedVersion: number): Promise<void> {
    return writePlacementsToPlayOutToCloud(getSupabase(), tournamentId, places, expectedVersion);
  }

  async delete(id: string): Promise<void> {
    const { error } = await getSupabase().from('tournaments').delete().eq('id', id);

    if (error) {
      console.error('Failed to delete tournament:', error);
      throw new RepositoryError('delete', error.message, error);
    }
  }

  // =============================================================================
  // EXTENDED METHODS (not in ITournamentRepository)
  // =============================================================================

  /**
   * Lists all tournaments for the current user
   */
  async listForCurrentUser(): Promise<Tournament[]> {
    const {
      data: { user },
    } = await getSupabase().auth.getUser();
    if (!user) {
      return [];
    }

    const { data: tournamentRows, error } = await getSupabase()
      .from('tournaments')
      .select('*')
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to list tournaments:', error);
      throw new RepositoryError('list', error.message, error);
    }

    // For listing, we don't need full team/match data
    // Return minimal tournament objects
    return tournamentRows.map((row) =>
      mapTournamentFromSupabase(row, [], [])
    );
  }

  /**
   * Soft deletes a tournament (moves to trash)
   */
  async softDelete(id: string): Promise<void> {
    const { error } = await getSupabase()
      .from('tournaments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Failed to soft delete tournament:', error);
      throw new RepositoryError('softDelete', error.message, error);
    }
  }

  /**
   * Restores a soft-deleted tournament
   */
  async restore(id: string): Promise<void> {
    const { error } = await getSupabase()
      .from('tournaments')
      .update({ deleted_at: null })
      .eq('id', id);

    if (error) {
      console.error('Failed to restore tournament:', error);
      throw new RepositoryError('restore', error.message, error);
    }
  }

  /**
   * Adds a team to an existing tournament
   */
  async addTeam(
    tournamentId: string,
    team: { id: string; name: string; group?: string }
  ): Promise<void> {
    const teamRow = mapTeamToSupabase(
      { ...team, group: team.group },
      tournamentId
    );

    const { error } = await getSupabase().from('teams').insert(teamRow);

    if (error) {
      console.error('Failed to add team:', error);
      throw new RepositoryError('addTeam', error.message, error);
    }
  }

  // =============================================================================
  // PUBLIC VIEW METHODS
  // =============================================================================

  /**
   * Fetches a public tournament by share code (for anonymous access)
   * Returns null if not found or not public
   */
  async getByShareCode(shareCode: string): Promise<Tournament | null> {
    // Normalize to uppercase
    const normalizedCode = shareCode.toUpperCase().trim();

    // Validate format
    if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
      return null;
    }

    // Fetch tournament by share_code (RLS policy allows this for public tournaments)
    const { data: tournamentRow, error: tournamentError } = await getSupabase()
      .from('tournaments')
      .select('*')
      .eq('share_code', normalizedCode)
      .eq('is_public', true)
      .single();

    if (tournamentError) {
      if (tournamentError.code === 'PGRST116') {
        // Not found
        return null;
      }
      console.error('Failed to fetch public tournament:', tournamentError);
      return null;
    }

    // Fetch teams
    const { data: teamRows, error: teamsError } = await getSupabase()
      .from('teams')
      .select('*')
      .eq('tournament_id', tournamentRow.id)
      .order('sort_order', { ascending: true });

    if (teamsError) {
      console.error('Failed to fetch teams:', teamsError);
      return null;
    }

    // Fetch matches
    const { data: matchRows, error: matchesError } = await getSupabase()
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentRow.id)
      .order('match_number', { ascending: true });

    if (matchesError) {
      console.error('Failed to fetch matches:', matchesError);
      return null;
    }

    // Convert to frontend types (database may return null for empty arrays)
     
    return mapTournamentFromSupabase(tournamentRow, teamRows ?? [], matchRows ?? []);
  }

  /**
   * Makes a tournament public and generates a share code
   * Calls the database function for atomic operation
   */
  async makeTournamentPublic(tournamentId: string): Promise<{ shareCode: string; createdAt: string } | null> {
    // Note: RPC function types are not generated yet, using explicit typing
    type ShareCodeResult = { share_code: string; share_code_created_at: string }[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- RPC types not generated
    const client = getSupabase() as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- RPC method access
    const { data, error } = await client.rpc('make_tournament_public', { tournament_id: tournamentId }) as { data: ShareCodeResult | null; error: Error | null };

    if (error) {
      console.error('Failed to make tournament public:', error);
      throw new RepositoryError('makePublic', error.message, error);
    }

    if (!data || data.length === 0) {
      return null;
    }

    return {
      shareCode: data[0].share_code,
      createdAt: data[0].share_code_created_at,
    };
  }

  /**
   * Makes a tournament private and removes the share code
   */
  async makeTournamentPrivate(tournamentId: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- RPC types not generated
    const client = getSupabase() as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- RPC method access
    const { error } = await client.rpc('make_tournament_private', { tournament_id: tournamentId }) as { error: Error | null };

    if (error) {
      console.error('Failed to make tournament private:', error);
      throw new RepositoryError('makePrivate', error.message, error);
    }
  }

  /**
   * Regenerates the share code for a public tournament
   */
  async regenerateShareCode(tournamentId: string): Promise<{ shareCode: string; createdAt: string } | null> {
    // Note: RPC function types are not generated yet, using explicit typing
    type ShareCodeResult = { share_code: string; share_code_created_at: string }[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- RPC types not generated
    const client = getSupabase() as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- RPC method access
    const { data, error } = await client.rpc('regenerate_share_code', { tournament_id: tournamentId }) as { data: ShareCodeResult | null; error: Error | null };

    if (error) {
      console.error('Failed to regenerate share code:', error);
      throw new RepositoryError('regenerateShareCode', error.message, error);
    }

    if (!data || data.length === 0) {
      return null;
    }

    return {
      shareCode: data[0].share_code,
      createdAt: data[0].share_code_created_at,
    };
  }

  /**
   * Gets the current visibility status of a tournament
   */
  async getTournamentVisibility(tournamentId: string): Promise<{
    isPublic: boolean;
    shareCode: string | null;
    shareCodeCreatedAt: string | null;
  } | null> {
    // Note: These columns exist but types may not be generated yet
    type VisibilityRow = {
      is_public: boolean | null;
      share_code: string | null;
      share_code_created_at: string | null;
    };

    const { data, error } = await getSupabase()
      .from('tournaments')
      .select('is_public, share_code, share_code_created_at')
      .eq('id', tournamentId)
      .single() as { data: VisibilityRow | null; error: Error | null };

    if (error) {
      console.error('Failed to get tournament visibility:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      isPublic: data.is_public ?? false,
      shareCode: data.share_code,
      shareCodeCreatedAt: data.share_code_created_at,
    };
  }
}
