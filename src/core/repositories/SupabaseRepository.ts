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
import { OptimisticLockError } from '../errors';
import {
  mapTournamentFromSupabase,
  mapTournamentToSupabase,
  mapMatchUpdateToSupabase,
  mapTeamToSupabase,
  mapMatchToSupabase,
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
      console.error('Failed to fetch tournament:', tournamentError);
      throw new Error(`Failed to fetch tournament: ${tournamentError.message}`);
    }

    // Fetch teams
    const { data: teamRows, error: teamsError } = await getSupabase()
      .from('teams')
      .select('*')
      .eq('tournament_id', id)
      .order('sort_order', { ascending: true });

    if (teamsError) {
      console.error('Failed to fetch teams:', teamsError);
      throw new Error(`Failed to fetch teams: ${teamsError.message}`);
    }

    // Fetch matches
    const { data: matchRows, error: matchesError } = await getSupabase()
      .from('matches')
      .select('*')
      .eq('tournament_id', id)
      .order('match_number', { ascending: true });

    if (matchesError) {
      console.error('Failed to fetch matches:', matchesError);
      throw new Error(`Failed to fetch matches: ${matchesError.message}`);
    }

    // Convert to frontend types
    return mapTournamentFromSupabase(
      tournamentRow,
      teamRows,
      matchRows
    );
  }

  /**
   * Updates only specific metadata fields of a tournament.
   * Prevents overwriting valid teams/matches when only changing settings.
   */
  async updateTournamentMetadata(id: string, metadata: Partial<Tournament>): Promise<void> {
    const updatePayload: Record<string, unknown> = {};

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
      throw new Error(`Failed to update tournament metadata: ${updateError.message}`);
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
    } = await getSupabase().auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Convert to Supabase format
    const { tournamentRow, teamRows, matchRows } = mapTournamentToSupabase(
      tournament,
      user.id
    );

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
      throw new Error(`Failed to save tournament: ${saveError.message}`);
    }

    // 2. Handle teams - delete removed, upsert existing
    // First, get existing team IDs
    const { data: existingTeams } = await getSupabase()
      .from('teams')
      .select('id')
      .eq('tournament_id', tournament.id);

    const existingTeamIds = new Set(existingTeams?.map((t) => t.id) ?? []);
    const newTeamIds = new Set(teamRows.map((t) => t.id));

    // Delete teams that are no longer in the tournament
    const teamsToDelete = [...existingTeamIds].filter(
      (id) => !newTeamIds.has(id)
    );
    if (teamsToDelete.length > 0) {
      const { error: deleteError } = await getSupabase()
        .from('teams')
        .delete()
        .in('id', teamsToDelete);

      if (deleteError) {
        console.error('Failed to delete teams:', deleteError);
        // Continue anyway - teams might have match references
      }
    }

    // Upsert teams
    if (teamRows.length > 0) {
      const { error: teamsError } = await getSupabase()
        .from('teams')
        .upsert(teamRows, { onConflict: 'id' });

      if (teamsError) {
        console.error('Failed to save teams:', teamsError);
        throw new Error(`Failed to save teams: ${teamsError.message}`);
      }
    }

    // 3. Handle matches - delete removed, upsert existing
    const { data: existingMatches } = await getSupabase()
      .from('matches')
      .select('id')
      .eq('tournament_id', tournament.id);

    const existingMatchIds = new Set(existingMatches?.map((m) => m.id) ?? []);
    const newMatchIds = new Set(matchRows.map((m) => m.id));

    // Delete matches that are no longer in the tournament
    const matchesToDelete = [...existingMatchIds].filter(
      (id) => !newMatchIds.has(id)
    );
    if (matchesToDelete.length > 0) {
      const { error: deleteError } = await getSupabase()
        .from('matches')
        .delete()
        .in('id', matchesToDelete);

      if (deleteError) {
        console.error('Failed to delete matches:', deleteError);
        // Continue anyway
      }
    }

    // Upsert matches
    if (matchRows.length > 0) {
      const { error: matchesError } = await getSupabase()
        .from('matches')
        .upsert(matchRows, { onConflict: 'id' });

      if (matchesError) {
        console.error('Failed to save matches:', matchesError);
        throw new Error(`Failed to save matches: ${matchesError.message}`);
      }
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

    // Get team name to ID mapping for this tournament
    const { data: teams } = await getSupabase()
      .from('teams')
      .select('id, name')
      .eq('tournament_id', tournamentId);

    const teamNameToId = new Map<string, string>();
    teams?.forEach((t) => teamNameToId.set(t.name, t.id));

    // Update each match
    // Note: For better performance, we could use a batch update RPC
    const errors: Error[] = [];

    for (const update of updates) {
      const supabaseUpdate = mapMatchUpdateToSupabase(update, teamNameToId);

      const { error } = await getSupabase()
        .from('matches')
        .update(supabaseUpdate)
        .eq('id', update.id)
        .eq('tournament_id', tournamentId);

      if (error) {
        console.error(`Failed to update match ${update.id}:`, error);
        errors.push(new Error(`Match ${update.id}: ${error.message}`));
      }
    }

    // Update tournament's updated_at timestamp AND version if provided
    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (baseVersion !== undefined) {
      updatePayload.version = baseVersion + 1;
    }

    let query = getSupabase()
      .from('tournaments')
      .update(updatePayload)
      .eq('id', tournamentId);

    if (baseVersion !== undefined) {
      query = query.eq('version', baseVersion);
    }

    // We utilize the version check here too
    const { data: updatedT, error: tError } = await query.select('id');

    if (tError) {
      errors.push(new Error(`Failed to update tournament timestamp: ${tError.message}`));
     
    } else if (baseVersion !== undefined && (!updatedT || updatedT.length === 0)) {
      errors.push(new OptimisticLockError('Turnier wurde zwischenzeitlich verändert (Matches).'));
    }

    if (errors.length > 0) {
      throw new Error(
        `Failed to update matches/tournament: ${errors.map((e) => e.message).join('; ')}`
      );
    }
  }

  /**
   * Deletes a tournament and all related data
   * Note: Teams and matches should cascade delete via foreign keys
   */
  async delete(id: string): Promise<void> {
    // Delete matches first (in case cascade isn't set up)
    await getSupabase().from('matches').delete().eq('tournament_id', id);

    // Delete teams
    await getSupabase().from('teams').delete().eq('tournament_id', id);

    // Delete tournament
    const { error } = await getSupabase().from('tournaments').delete().eq('id', id);

    if (error) {
      console.error('Failed to delete tournament:', error);
      throw new Error(`Failed to delete tournament: ${error.message}`);
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
      throw new Error(`Failed to list tournaments: ${error.message}`);
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
      throw new Error(`Failed to soft delete tournament: ${error.message}`);
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
      throw new Error(`Failed to restore tournament: ${error.message}`);
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
      throw new Error(`Failed to add team: ${error.message}`);
    }
  }

  /**
   * Adds a match to an existing tournament
   */
  async addMatch(
    tournamentId: string,
    match: {
      id: string;
      round: number;
      field: number;
      teamA: string;
      teamB: string;
      group?: string;
    }
  ): Promise<void> {
    // Get team name to ID mapping
    const { data: teams } = await getSupabase()
      .from('teams')
      .select('id, name')
      .eq('tournament_id', tournamentId);

    const teamNameToId = new Map<string, string>();
    teams?.forEach((t) => teamNameToId.set(t.name, t.id));

    const matchRow = mapMatchToSupabase(
      {
        ...match,
        scoreA: undefined,
        scoreB: undefined,
        slot: undefined,
      },
      tournamentId,
      teamNameToId
    );

    const { error } = await getSupabase().from('matches').insert(matchRow);

    if (error) {
      console.error('Failed to add match:', error);
      throw new Error(`Failed to add match: ${error.message}`);
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
      throw new Error(`Failed to make tournament public: ${error.message}`);
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
      throw new Error(`Failed to make tournament private: ${error.message}`);
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
      throw new Error(`Failed to regenerate share code: ${error.message}`);
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
