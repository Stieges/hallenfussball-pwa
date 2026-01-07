/**
 * useTournamentSync - Custom Hook for Tournament-Schedule Synchronization
 *
 * Manages the complex synchronization between:
 * - tournament.matches[] (source of truth for scores, refs, times)
 * - schedule.allMatches[] (view structure for display)
 *
 * Extracted from TournamentManagementScreen to improve maintainability.
 */

import { useState, useEffect, useCallback } from 'react';
import { Tournament, Standing } from '../types/tournament';
import { GeneratedSchedule, generateFullSchedule, ScheduledMatch } from '../lib/scheduleGenerator';
import { calculateStandings } from '../utils/calculations';
import { safeLocalStorageSet } from '../utils/storageCleanup';

interface UseTournamentSyncResult {
  tournament: Tournament | null;
  schedule: GeneratedSchedule | null;
  currentStandings: Standing[];
  loadingError: string | null;
  handleTournamentUpdate: (updatedTournament: Tournament, regenerateSchedule?: boolean) => void;
}

/**
 * Syncs match IDs from tournament.matches to schedule by matching on slot/field/group
 */
function syncScheduleIds(
  generatedSchedule: GeneratedSchedule,
  tournamentMatches: Tournament['matches']
): GeneratedSchedule {
  // BUG-FIX: Use strict index-based mapping.
  // Assumption: generateFullSchedule() produces matches in the exact same creation order
  // as the initial tournament.matches.
  // handleMoveMatch uses .map(), preserving this order.
  // This ensures that even if a match is moved to a different slot (changing properties),
  // it remains linked to the same generated match entry by index.

  return {
    ...generatedSchedule,
    allMatches: generatedSchedule.allMatches.map((sm, index) => {
      // Avoid 'always truthy' warning by checking bounds
      if (index < tournamentMatches.length) {
        const tournamentMatch = tournamentMatches[index];
        return { ...sm, id: tournamentMatch.id };
      }
      return sm;
    }),
    phases: generatedSchedule.phases.map(phase => ({
      ...phase,
      matches: phase.matches.map((sm) => {
        // Find the match in allMatches to get its index / original ID
        // This is safe because generatedSchedule.phases are derived from generatedSchedule.allMatches
        const matchIndex = generatedSchedule.allMatches.findIndex(
          m => m.slot === sm.slot && m.field === sm.field && m.group === sm.group
        );

        if (matchIndex !== -1 && matchIndex < tournamentMatches.length) {
          const tournamentMatch = tournamentMatches[matchIndex];
          return { ...sm, id: tournamentMatch.id };
        }
        return sm;
      })
    }))
  };
}

/**
 * Syncs all editable fields from tournament.matches to a single schedule match
 */
function syncMatchFields(
  sm: ScheduledMatch,
  tournamentMatch: Tournament['matches'][0] | undefined
): ScheduledMatch {
  if (!tournamentMatch) { return sm; }

  // Parse scheduledTime to Date if it changed
  let startTime = sm.startTime;
  let time = sm.time;
  if (tournamentMatch.scheduledTime) {
    const newStartTime = new Date(tournamentMatch.scheduledTime);
    if (newStartTime.getTime() !== sm.startTime.getTime()) {
      startTime = newStartTime;
      time = newStartTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    }
  }

  return {
    ...sm,
    referee: tournamentMatch.referee,
    field: tournamentMatch.field,
    slot: tournamentMatch.slot ?? sm.slot,
    startTime,
    time,
    scoreA: tournamentMatch.scoreA,
    scoreB: tournamentMatch.scoreB,
  };
}

/**
 * Hook for managing tournament-schedule synchronization
 */
export function useTournamentSync(tournamentId: string): UseTournamentSyncResult {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [schedule, setSchedule] = useState<GeneratedSchedule | null>(null);
  const [currentStandings, setCurrentStandings] = useState<Standing[]>([]);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  // Load tournament from localStorage
  useEffect(() => {
    const loadTournament = () => {
      try {
        const stored = localStorage.getItem('tournaments');

        if (!stored) {
          setLoadingError('Keine Turniere in localStorage gefunden');
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const tournaments: Tournament[] = JSON.parse(stored);
        const found = tournaments.find((t) => t.id === tournamentId);

        if (!found) {
          setLoadingError(`Turnier mit ID ${tournamentId} nicht gefunden`);
          return;
        }

        // MIGRATION: Generate matches if empty (for old tournaments)
        let updatedTournament = found;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!found.matches || found.matches.length === 0) {
          const tempSchedule = generateFullSchedule(found);

          // Convert ScheduledMatch[] to Match[]
          const generatedMatches = tempSchedule.allMatches.map((scheduledMatch, index) => ({
            id: scheduledMatch.id,
            round: Math.floor(index / found.numberOfFields) + 1,
            field: scheduledMatch.field,
            slot: scheduledMatch.slot,
            teamA: scheduledMatch.homeTeam,
            teamB: scheduledMatch.awayTeam,
            scoreA: scheduledMatch.scoreA,
            scoreB: scheduledMatch.scoreB,
            group: scheduledMatch.group,
            isFinal: scheduledMatch.phase !== 'groupStage',
            finalType: scheduledMatch.finalType,
            label: scheduledMatch.label,
            scheduledTime: scheduledMatch.startTime,
            referee: scheduledMatch.referee,
          }));

          updatedTournament = {
            ...found,
            matches: generatedMatches,
            updatedAt: new Date().toISOString(),
          };

          // Save updated tournament back to localStorage
          const index = tournaments.findIndex((t) => t.id === tournamentId);
          if (index !== -1) {
            tournaments[index] = updatedTournament;
            safeLocalStorageSet('tournaments', JSON.stringify(tournaments));
            window.dispatchEvent(new CustomEvent('tournament-updated'));
          }
        }

        // Generate and sync schedule
        const generatedSchedule = generateFullSchedule(updatedTournament);
        const syncedSchedule = syncScheduleIds(generatedSchedule, updatedTournament.matches);

        // BUG-FIX: Apply persisted match data (times, scores, etc.) to the generated schedule
        // Without this, reloading the page resets the schedule to default generated times
        const finalSchedule: GeneratedSchedule = {
          ...syncedSchedule,
          allMatches: syncedSchedule.allMatches.map(sm => {
            const tournamentMatch = updatedTournament.matches.find(m => m.id === sm.id);
            return syncMatchFields(sm, tournamentMatch);
          }),
          phases: syncedSchedule.phases.map(phase => ({
            ...phase,
            matches: phase.matches.map(sm => {
              const tournamentMatch = updatedTournament.matches.find(m => m.id === sm.id);
              return syncMatchFields(sm, tournamentMatch);
            })
          }))
        };

        // Calculate standings
        const standings = calculateStandings(
          updatedTournament.teams,
          updatedTournament.matches,
          updatedTournament
        );

        setTournament(updatedTournament);
        setSchedule(finalSchedule);
        setCurrentStandings(standings);
        setLoadingError(null);
      } catch (error) {
        setLoadingError(`Fehler beim Laden: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
      }
    };

    loadTournament();
  }, [tournamentId]);

  // Handle tournament updates with optional schedule regeneration
  const handleTournamentUpdate = useCallback((
    updatedTournament: Tournament,
    regenerateSchedule = false
  ) => {
    // Persist to localStorage
    const stored = localStorage.getItem('tournaments');
    if (stored) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const tournaments: Tournament[] = JSON.parse(stored);
        const index = tournaments.findIndex((t) => t.id === updatedTournament.id);

        if (index !== -1) {
          tournaments[index] = updatedTournament;
          // Use safe set to handle quota limits
          safeLocalStorageSet('tournaments', JSON.stringify(tournaments));
          window.dispatchEvent(new CustomEvent('tournament-updated'));
        }
      } catch (e) {
        console.error('Failed to persist tournament update:', e);
        // Even if persistence fails, we should update local state so the UI reflects changes
      }
    }

    if (regenerateSchedule) {
      // Full regeneration with ID sync
      const generatedSchedule = generateFullSchedule(updatedTournament);
      const syncedSchedule = syncScheduleIds(generatedSchedule, updatedTournament.matches);
      const standings = calculateStandings(
        updatedTournament.teams,
        updatedTournament.matches,
        updatedTournament
      );

      setTournament(updatedTournament);
      setSchedule(syncedSchedule);
      setCurrentStandings(standings);
    } else if (schedule) {
      // Incremental sync: Update schedule from tournament.matches
      const updatedSchedule: GeneratedSchedule = {
        ...schedule,
        allMatches: schedule.allMatches.map(sm => {
          const tournamentMatch = updatedTournament.matches.find(m => m.id === sm.id);
          return syncMatchFields(sm, tournamentMatch);
        }),
        phases: schedule.phases.map(phase => ({
          ...phase,
          matches: phase.matches.map(sm => {
            const tournamentMatch = updatedTournament.matches.find(m => m.id === sm.id);
            return syncMatchFields(sm, tournamentMatch);
          })
        }))
      };

      const standings = calculateStandings(
        updatedTournament.teams,
        updatedTournament.matches,
        updatedTournament
      );

      setTournament(updatedTournament);
      setSchedule(updatedSchedule);
      setCurrentStandings(standings);
    } else {
      // Fallback if schedule is null
      const standings = calculateStandings(
        updatedTournament.teams,
        updatedTournament.matches,
        updatedTournament
      );
      setTournament(updatedTournament);
      setCurrentStandings(standings);
    }
  }, [schedule]);

  return {
    tournament,
    schedule,
    currentStandings,
    loadingError,
    handleTournamentUpdate,
  };
}
