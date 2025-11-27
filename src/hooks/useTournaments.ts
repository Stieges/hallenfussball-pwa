import { useState, useEffect } from 'react';
import { Tournament } from '../types/tournament';
import { storage } from '../utils/storage';

/**
 * Custom hook for managing tournaments with localStorage persistence
 */
export const useTournaments = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  // Load tournaments on mount
  useEffect(() => {
    try {
      const loaded = storage.getTournaments();
      // Migration: Setze status auf 'published' für bestehende Turniere ohne status
      // Migration: Setze refereeConfig auf { mode: 'none' } für bestehende Turniere ohne refereeConfig
      const migratedTournaments = loaded.map(t => ({
        ...t,
        status: t.status || 'published',
        refereeConfig: t.refereeConfig || { mode: 'none' as const },
      }));
      setTournaments(migratedTournaments);
    } catch (error) {
      console.error('Failed to load tournaments:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save tournament
  const saveTournament = (tournament: Tournament) => {
    try {
      storage.saveTournament(tournament);
      setTournaments(storage.getTournaments());
    } catch (error) {
      console.error('Failed to save tournament:', error);
      throw error;
    }
  };

  // Delete tournament
  const deleteTournament = (id: string) => {
    try {
      storage.deleteTournament(id);
      setTournaments(storage.getTournaments());
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
