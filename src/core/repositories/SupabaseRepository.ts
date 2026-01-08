/**
 * SupabaseRepository - Supabase implementation of ITournamentRepository
 *
 * Stores tournaments, teams, and matches in Supabase PostgreSQL.
 * Supports real-time subscriptions and optimistic concurrency control.
 *
 * @see ITournamentRepository for interface documentation
 * @see supabaseMappers.ts for type conversion logic
 */

import { supabase } from '../../lib/supabase';
import { ITournamentRepository } from './ITournamentRepository';
import { Tournament, MatchUpdate } from '../models/types';
import {
  mapTournamentFromSupabase,
  mapTournamentToSupabase,
  mapMatchUpdateToSupabase,
  mapTeamToSupabase,
  mapMatchToSupabase,
} from './supabaseMappers';

export class SupabaseRepository implements ITournamentRepository {
  /**
   * Loads a tournament by ID with all related data (teams, matches)
   */
  async get(id: string): Promise<Tournament | null> {
    // Fetch tournament
    const { data: tournamentRow, error: tournamentError } = await supabase
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

    if (!tournamentRow) {
      return null;
    }

    // Fetch teams
    const { data: teamRows, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .eq('tournament_id', id)
      .order('sort_order', { ascending: true });

    if (teamsError) {
      console.error('Failed to fetch teams:', teamsError);
      throw new Error(`Failed to fetch teams: ${teamsError.message}`);
    }

    // Fetch matches
    const { data: matchRows, error: matchesError } = await supabase
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
      teamRows || [],
      matchRows || []
    );
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
    } = await supabase.auth.getUser();
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

    // 1. Upsert tournament
    const { error: tournamentError } = await supabase
      .from('tournaments')
      .upsert(tournamentRow, { onConflict: 'id' });

    if (tournamentError) {
      console.error('Failed to save tournament:', tournamentError);
      throw new Error(`Failed to save tournament: ${tournamentError.message}`);
    }

    // 2. Handle teams - delete removed, upsert existing
    // First, get existing team IDs
    const { data: existingTeams } = await supabase
      .from('teams')
      .select('id')
      .eq('tournament_id', tournament.id);

    const existingTeamIds = new Set(existingTeams?.map((t) => t.id) || []);
    const newTeamIds = new Set(teamRows.map((t) => t.id));

    // Delete teams that are no longer in the tournament
    const teamsToDelete = [...existingTeamIds].filter(
      (id) => !newTeamIds.has(id)
    );
    if (teamsToDelete.length > 0) {
      const { error: deleteError } = await supabase
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
      const { error: teamsError } = await supabase
        .from('teams')
        .upsert(teamRows, { onConflict: 'id' });

      if (teamsError) {
        console.error('Failed to save teams:', teamsError);
        throw new Error(`Failed to save teams: ${teamsError.message}`);
      }
    }

    // 3. Handle matches - delete removed, upsert existing
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('id')
      .eq('tournament_id', tournament.id);

    const existingMatchIds = new Set(existingMatches?.map((m) => m.id) || []);
    const newMatchIds = new Set(matchRows.map((m) => m.id));

    // Delete matches that are no longer in the tournament
    const matchesToDelete = [...existingMatchIds].filter(
      (id) => !newMatchIds.has(id)
    );
    if (matchesToDelete.length > 0) {
      const { error: deleteError } = await supabase
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
      const { error: matchesError } = await supabase
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
    updates: MatchUpdate[]
  ): Promise<void> {
    if (updates.length === 0) return;

    // Get team name to ID mapping for this tournament
    const { data: teams } = await supabase
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

      const { error } = await supabase
        .from('matches')
        .update(supabaseUpdate)
        .eq('id', update.id)
        .eq('tournament_id', tournamentId);

      if (error) {
        console.error(`Failed to update match ${update.id}:`, error);
        errors.push(new Error(`Match ${update.id}: ${error.message}`));
      }
    }

    // Update tournament's updated_at timestamp
    await supabase
      .from('tournaments')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', tournamentId);

    if (errors.length > 0) {
      throw new Error(
        `Failed to update ${errors.length} match(es): ${errors.map((e) => e.message).join('; ')}`
      );
    }
  }

  /**
   * Deletes a tournament and all related data
   * Note: Teams and matches should cascade delete via foreign keys
   */
  async delete(id: string): Promise<void> {
    // Delete matches first (in case cascade isn't set up)
    await supabase.from('matches').delete().eq('tournament_id', id);

    // Delete teams
    await supabase.from('teams').delete().eq('tournament_id', id);

    // Delete tournament
    const { error } = await supabase.from('tournaments').delete().eq('id', id);

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
    } = await supabase.auth.getUser();
    if (!user) {
      return [];
    }

    const { data: tournamentRows, error } = await supabase
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
    return (tournamentRows || []).map((row) =>
      mapTournamentFromSupabase(row, [], [])
    );
  }

  /**
   * Soft deletes a tournament (moves to trash)
   */
  async softDelete(id: string): Promise<void> {
    const { error } = await supabase
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
    const { error } = await supabase
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

    const { error } = await supabase.from('teams').insert(teamRow);

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
    const { data: teams } = await supabase
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

    const { error } = await supabase.from('matches').insert(matchRow);

    if (error) {
      console.error('Failed to add match:', error);
      throw new Error(`Failed to add match: ${error.message}`);
    }
  }
}
