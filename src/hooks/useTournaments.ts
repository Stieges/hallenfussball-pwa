import { useState, useEffect } from 'react';
import { Tournament } from '../types/tournament';
import * as api from '../services/api';

/**
 * Custom hook for managing tournaments
 * Verwendet API Service Layer - automatisch localStorage oder Backend
 */
export const useTournaments = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  // Load tournaments on mount
  useEffect(() => {
    const loadTournaments = async () => {
      try {
        const loaded = await api.getAllTournaments();
        setTournaments(loaded);
      } catch (error) {
        console.error('Failed to load tournaments:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTournaments();
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
