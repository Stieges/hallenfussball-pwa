import { Tournament } from '../types/tournament';

const STORAGE_KEY = 'hallenfussball_tournaments';

export const storage = {
  // Get all tournaments
  getTournaments: (): Tournament[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading tournaments:', error);
      return [];
    }
  },

  // Get tournament by ID
  getTournament: (id: string): Tournament | undefined => {
    const tournaments = storage.getTournaments();
    return tournaments.find((t) => t.id === id);
  },

  // Save tournament (create or update)
  saveTournament: (tournament: Tournament): void => {
    try {
      const tournaments = storage.getTournaments();
      const existingIndex = tournaments.findIndex((t) => t.id === tournament.id);

      const updatedTournament = {
        ...tournament,
        updatedAt: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        tournaments[existingIndex] = updatedTournament;
      } else {
        tournaments.push(updatedTournament);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(tournaments));
    } catch (error) {
      console.error('Error saving tournament:', error);
      throw error;
    }
  },

  // Delete tournament
  deleteTournament: (id: string): void => {
    try {
      const tournaments = storage.getTournaments();
      const filtered = tournaments.filter((t) => t.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting tournament:', error);
      throw error;
    }
  },

  // Clear all tournaments
  clearAll: (): void => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  },
};
