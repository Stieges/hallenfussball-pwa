import { useState, useEffect } from 'react';
import { Tournament } from '../types/tournament';
import * as api from '../services/api';
import { migrateLocationsToStructured } from '../utils/locationHelpers';

/**
 * Custom hook for managing tournaments
 * Verwendet API Service Layer - automatisch localStorage oder Backend
 */
export const useTournaments = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  // Load tournaments function - extracted for reuse
  const loadTournaments = async () => {
    try {
      const loaded = await api.getAllTournaments();

      // Migration: Convert old string locations to LocationDetails
      const migrated = migrateLocationsToStructured(loaded);

      // Check if any tournaments were migrated
      const hasChanges = migrated.some((_, idx) =>
        typeof loaded[idx]?.location === 'string'
      );

      // If migrations occurred, save them back
      if (hasChanges) {
        console.log('[useTournaments] Migrating tournaments to structured location format');
        await Promise.all(migrated.map(t => api.saveTournament(t)));
      }

      setTournaments(migrated);
    } catch (error) {
      console.error('Failed to load tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load tournaments on mount
  useEffect(() => {
    loadTournaments();
  }, []);

  // Listen for localStorage changes (from TournamentManagementScreen or other tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'tournaments') {
        console.log('[useTournaments] Detected localStorage change, reloading...');
        loadTournaments();
      }
    };

    // Also listen for custom events (same-tab updates)
    const handleTournamentUpdate = () => {
      console.log('[useTournaments] Detected tournament update event, reloading...');
      loadTournaments();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tournament-updated', handleTournamentUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tournament-updated', handleTournamentUpdate);
    };
  }, []);

  // Save tournament
  const saveTournament = async (tournament: Tournament) => {
    try {
      await api.saveTournament(tournament);
      // Reload tournaments from API
      const updated = await api.getAllTournaments();
      setTournaments(updated);
    } catch (error) {
      console.error('Failed to save tournament:', error);
      throw error;
    }
  };

  // Delete tournament
  const deleteTournament = async (id: string) => {
    try {
      await api.deleteTournament(id);
      // Reload tournaments from API
      const updated = await api.getAllTournaments();
      setTournaments(updated);
    } catch (error) {
      console.error('Failed to delete tournament:', error);
      throw error;
    }
  };

  // Get tournament by ID
  const getTournament = (id: string): Tournament | undefined => {
    return tournaments.find(t => t.id === id);
  };

  return {
    tournaments,
    loading,
    saveTournament,
    deleteTournament,
    getTournament,
  };
};
