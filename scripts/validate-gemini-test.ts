#!/usr/bin/env npx ts-node
/* eslint-disable no-console, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unnecessary-condition */
/**
 * Gemini E2E Test Validation Script
 *
 * Validates that E2E test data was correctly persisted to Supabase.
 * Usage: npx ts-node scripts/validate-gemini-test.ts --tournament-id <id> [options]
 *
 * Options:
 *   --tournament-id <id>  Tournament ID to validate (required)
 *   --share-code <code>   Share code to look up tournament
 *   --check-matches       Validate all match data
 *   --check-events        Validate match events (goals, cards)
 *   --check-teams         Validate team data
 *   --verbose             Show detailed output
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://amtlqicosscsjnnthvzm.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

interface ValidationResult {
  passed: boolean;
  checks: Check[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

interface Check {
  name: string;
  passed: boolean;
  expected?: unknown;
  actual?: unknown;
  message?: string;
}

interface Tournament {
  id: string;
  title: string;
  status: string;
  share_code: string | null;
}

interface Team {
  id: string;
  name: string;
  group_letter: string | null;
}

interface Match {
  id: string;
  team_a_id: string | null;
  team_b_id: string | null;
  score_a: number | null;
  score_b: number | null;
  match_status: string;
  round: number | null;
  field: number | null;
}

interface MatchEvent {
  id: string;
  match_id: string;
  type: string;
  team_id: string | null;
  score_home: number | null;
  score_away: number | null;
}

// Parse command line arguments
function parseArgs(): {
  tournamentId?: string;
  shareCode?: string;
  checkMatches: boolean;
  checkEvents: boolean;
  checkTeams: boolean;
  verbose: boolean;
} {
  const args = process.argv.slice(2);
  const result = {
    tournamentId: undefined as string | undefined,
    shareCode: undefined as string | undefined,
    checkMatches: false,
    checkEvents: false,
    checkTeams: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--tournament-id':
        result.tournamentId = args[++i];
        break;
      case '--share-code':
        result.shareCode = args[++i];
        break;
      case '--check-matches':
        result.checkMatches = true;
        break;
      case '--check-events':
        result.checkEvents = true;
        break;
      case '--check-teams':
        result.checkTeams = true;
        break;
      case '--verbose':
        result.verbose = true;
        break;
    }
  }

  // Default: check everything
  if (!result.checkMatches && !result.checkEvents && !result.checkTeams) {
    result.checkMatches = true;
    result.checkEvents = true;
    result.checkTeams = true;
  }

  return result;
}

// Initialize Supabase client
function createSupabaseClient(): SupabaseClient {
  if (!SUPABASE_ANON_KEY) {
    console.error('Error: VITE_SUPABASE_ANON_KEY environment variable not set');
    process.exit(1);
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Fetch tournament by ID or share code
async function fetchTournament(
  supabase: SupabaseClient,
  tournamentId?: string,
  shareCode?: string
): Promise<Tournament | null> {
  let query = supabase.from('tournaments').select('*');

  if (tournamentId) {
    query = query.eq('id', tournamentId);
  } else if (shareCode) {
    // Case-insensitive share code lookup
    query = query.ilike('share_code', shareCode);
  } else {
    console.error('Error: Either --tournament-id or --share-code is required');
    process.exit(1);
  }

  const { data, error } = await query.single();

  if (error) {
    console.error('Error fetching tournament:', error.message);
    return null;
  }

  return data as Tournament;
}

// Fetch teams for a tournament
async function fetchTeams(supabase: SupabaseClient, tournamentId: string): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('group_letter')
    .order('name');

  if (error) {
    console.error('Error fetching teams:', error.message);
    return [];
  }

  return data as Team[];
}

// Fetch matches for a tournament
async function fetchMatches(supabase: SupabaseClient, tournamentId: string): Promise<Match[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round')
    .order('field');

  if (error) {
    console.error('Error fetching matches:', error.message);
    return [];
  }

  return data as Match[];
}

// Fetch events for a match
async function fetchEvents(supabase: SupabaseClient, matchId: string): Promise<MatchEvent[]> {
  const { data, error } = await supabase
    .from('match_events')
    .select('*')
    .eq('match_id', matchId)
    .order('timestamp_seconds');

  if (error) {
    console.error('Error fetching events:', error.message);
    return [];
  }

  return data as MatchEvent[];
}

// Validation functions
function validateTournament(tournament: Tournament): Check[] {
  const checks: Check[] = [];

  checks.push({
    name: 'Tournament exists',
    passed: !!tournament,
    actual: tournament ? tournament.title : 'Not found',
  });

  if (tournament) {
    checks.push({
      name: 'Tournament has share_code',
      passed: !!tournament.share_code,
      actual: tournament.share_code,
    });

    checks.push({
      name: 'Tournament status is valid',
      passed: ['draft', 'published', 'active', 'finished', 'archived'].includes(tournament.status),
      actual: tournament.status,
    });
  }

  return checks;
}

function validateTeams(teams: Team[], expectedCount?: number): Check[] {
  const checks: Check[] = [];

  checks.push({
    name: 'Teams exist',
    passed: teams.length > 0,
    actual: teams.length,
    expected: expectedCount || 'At least 1',
  });

  if (expectedCount) {
    checks.push({
      name: 'Team count matches expected',
      passed: teams.length === expectedCount,
      actual: teams.length,
      expected: expectedCount,
    });
  }

  // Check for duplicate names
  const names = teams.map((t) => t.name.toLowerCase());
  const uniqueNames = new Set(names);
  checks.push({
    name: 'No duplicate team names',
    passed: names.length === uniqueNames.size,
    actual: names.length - uniqueNames.size + ' duplicates',
  });

  // Check group assignments
  const teamsWithGroups = teams.filter((t) => t.group_letter);
  checks.push({
    name: 'Teams have group assignments',
    passed: teamsWithGroups.length > 0,
    actual: `${teamsWithGroups.length} of ${teams.length} teams have groups`,
  });

  return checks;
}

function validateMatches(matches: Match[], teams: Team[]): Check[] {
  const checks: Check[] = [];
  const teamIds = new Set(teams.map((t) => t.id));

  checks.push({
    name: 'Matches exist',
    passed: matches.length > 0,
    actual: matches.length,
  });

  // Check team references
  const invalidTeamRefs = matches.filter(
    (m) =>
      (m.team_a_id && !teamIds.has(m.team_a_id)) || (m.team_b_id && !teamIds.has(m.team_b_id))
  );
  checks.push({
    name: 'All match team references are valid',
    passed: invalidTeamRefs.length === 0,
    actual: invalidTeamRefs.length + ' invalid references',
  });

  // Check match statuses
  const validStatuses = ['scheduled', 'waiting', 'running', 'paused', 'finished', 'skipped'];
  const invalidStatuses = matches.filter((m) => !validStatuses.includes(m.match_status));
  checks.push({
    name: 'All match statuses are valid',
    passed: invalidStatuses.length === 0,
    actual: invalidStatuses.map((m) => m.match_status).join(', ') || 'All valid',
  });

  // Check for finished matches with scores
  const finishedMatches = matches.filter((m) => m.match_status === 'finished');
  const finishedWithScores = finishedMatches.filter(
    (m) => m.score_a !== null && m.score_b !== null
  );
  checks.push({
    name: 'Finished matches have scores',
    passed: finishedMatches.length === 0 || finishedWithScores.length === finishedMatches.length,
    actual: `${finishedWithScores.length} of ${finishedMatches.length} have scores`,
  });

  return checks;
}

function validateEvents(events: MatchEvent[], match: Match): Check[] {
  const checks: Check[] = [];

  // If match has score, events should match
  if (match.score_a !== null && match.score_b !== null) {
    const goalEvents = events.filter((e) => ['GOAL', 'OWN_GOAL', 'PENALTY_GOAL'].includes(e.type));

    // Count goals per team from events
    const lastEvent = goalEvents[goalEvents.length - 1];
    if (lastEvent) {
      checks.push({
        name: 'Event score matches match score (home)',
        passed: lastEvent.score_home === match.score_a,
        expected: match.score_a,
        actual: lastEvent.score_home,
      });

      checks.push({
        name: 'Event score matches match score (away)',
        passed: lastEvent.score_away === match.score_b,
        expected: match.score_b,
        actual: lastEvent.score_away,
      });
    }
  }

  // Check event types are valid
  const validTypes = [
    'GOAL',
    'OWN_GOAL',
    'PENALTY_GOAL',
    'PENALTY_MISS',
    'YELLOW_CARD',
    'RED_CARD',
    'SECOND_YELLOW',
    'TIME_PENALTY',
    'SUBSTITUTION',
    'NOTE',
  ];
  const invalidTypes = events.filter((e) => !validTypes.includes(e.type));
  checks.push({
    name: 'All event types are valid',
    passed: invalidTypes.length === 0,
    actual: invalidTypes.map((e) => e.type).join(', ') || 'All valid',
  });

  return checks;
}

// Main validation function
async function validate(): Promise<ValidationResult> {
  const args = parseArgs();
  const supabase = createSupabaseClient();
  const checks: Check[] = [];

  console.log('\n========================================');
  console.log('  Gemini E2E Test Validation');
  console.log('========================================\n');

  // 1. Fetch and validate tournament
  console.log('1. Validating tournament...');
  const tournament = await fetchTournament(supabase, args.tournamentId, args.shareCode);

  if (!tournament) {
    return {
      passed: false,
      checks: [
        {
          name: 'Tournament exists',
          passed: false,
          message: 'Tournament not found',
        },
      ],
      summary: { total: 1, passed: 0, failed: 1 },
    };
  }

  checks.push(...validateTournament(tournament));
  console.log(`   Tournament: ${tournament.title} (${tournament.id})`);

  // 2. Fetch and validate teams
  if (args.checkTeams) {
    console.log('2. Validating teams...');
    const teams = await fetchTeams(supabase, tournament.id);
    checks.push(...validateTeams(teams));
    console.log(`   Found ${teams.length} teams`);

    if (args.verbose) {
      teams.forEach((t) => console.log(`   - ${t.name} (Group ${t.group_letter || 'N/A'})`));
    }
  }

  // 3. Fetch and validate matches
  if (args.checkMatches) {
    console.log('3. Validating matches...');
    const teams = await fetchTeams(supabase, tournament.id);
    const matches = await fetchMatches(supabase, tournament.id);
    checks.push(...validateMatches(matches, teams));

    const byStatus = matches.reduce<Record<string, number>>(
      (acc, m) => {
        acc[m.match_status] = (acc[m.match_status] || 0) + 1;
        return acc;
      },
      {}
    );
    console.log(`   Found ${matches.length} matches`);
    console.log(`   Status breakdown:`, byStatus);

    // 4. Validate events for finished matches
    if (args.checkEvents) {
      console.log('4. Validating match events...');
      const finishedMatches = matches.filter((m) => m.match_status === 'finished');

      for (const match of finishedMatches) {
        const events = await fetchEvents(supabase, match.id);
        checks.push(...validateEvents(events, match));

        if (args.verbose) {
          console.log(`   Match ${match.id}: ${events.length} events`);
        }
      }
    }
  }

  // Calculate summary
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.filter((c) => !c.passed).length;

  const result: ValidationResult = {
    passed: failed === 0,
    checks,
    summary: {
      total: checks.length,
      passed,
      failed,
    },
  };

  // Print results
  console.log('\n========================================');
  console.log('  Results');
  console.log('========================================\n');

  for (const check of checks) {
    const icon = check.passed ? '✅' : '❌';
    console.log(`${icon} ${check.name}`);
    if (!check.passed || args.verbose) {
      if (check.expected !== undefined) {
        console.log(`   Expected: ${JSON.stringify(check.expected)}`);
      }
      if (check.actual !== undefined) {
        console.log(`   Actual: ${JSON.stringify(check.actual)}`);
      }
      if (check.message) {
        console.log(`   Message: ${check.message}`);
      }
    }
  }

  console.log('\n----------------------------------------');
  console.log(`Total: ${result.summary.total} checks`);
  console.log(`Passed: ${result.summary.passed}`);
  console.log(`Failed: ${result.summary.failed}`);
  console.log(`Status: ${result.passed ? '✅ ALL PASSED' : '❌ FAILED'}`);
  console.log('----------------------------------------\n');

  return result;
}

// Run validation
validate()
  .then((result) => {
    process.exit(result.passed ? 0 : 1);
  })
  .catch((error) => {
    console.error('Validation error:', error);
    process.exit(1);
  });
