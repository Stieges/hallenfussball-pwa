/**
 * API Service Layer
 *
 * Abstrahiert die Datenzugriff-Logik. Aktuell verwendet localStorage,
 * kann später einfach gegen REST API oder andere Backends ausgetauscht werden.
 *
 * MIGRATION PATH:
 * 1. Aktuell: localStorage
 * 2. Später: Umstellung auf HTTP-Calls zu einer Cloud-API
 *    - Einfach die Funktionen in diesem File anpassen
 *    - Interface bleibt gleich
 *    - Keine Änderungen in den Komponenten nötig
 */

import { Tournament } from '../types/tournament';

/**
 * API Configuration
 * Später hier die Backend-URL konfigurieren
 */
const API_CONFIG = {
  // Für localStorage: nicht verwendet
  // Für Backend: BASE_URL: 'https://api.hallenfussball.de/v1'
  USE_LOCAL_STORAGE: true,
};

// ============================================================================
// TOURNAMENT API
// ============================================================================

/**
 * Hole alle Turniere
 * @returns Promise<Tournament[]>
 */
export async function getAllTournaments(): Promise<Tournament[]> {
  if (API_CONFIG.USE_LOCAL_STORAGE) {
    return localStorageGetTournaments();
  }

  // SPÄTER: Backend-Call
  // const response = await fetch(`${API_CONFIG.BASE_URL}/tournaments`);
  // if (!response.ok) throw new Error('Failed to fetch tournaments');
  // return await response.json();

  return [];
}

/**
 * Hole einzelnes Turnier per ID
 * @param id Tournament ID
 * @returns Promise<Tournament | null>
 */
export async function getTournamentById(id: string): Promise<Tournament | null> {
  if (API_CONFIG.USE_LOCAL_STORAGE) {
    return localStorageGetTournamentById(id);
  }

  // SPÄTER: Backend-Call
  // const response = await fetch(`${API_CONFIG.BASE_URL}/tournaments/${id}`);
  // if (!response.ok) {
  //   if (response.status === 404) return null;
  //   throw new Error('Failed to fetch tournament');
  // }
  // return await response.json();

  return null;
}

/**
 * Speichere ein Turnier (Create or Update)
 * @param tournament Tournament to save
 * @returns Promise<Tournament> - Das gespeicherte Turnier
 */
export async function saveTournament(tournament: Tournament): Promise<Tournament> {
  if (API_CONFIG.USE_LOCAL_STORAGE) {
    return localStorageSaveTournament(tournament);
  }

  // SPÄTER: Backend-Call
  // const method = tournament.id ? 'PUT' : 'POST';
  // const url = tournament.id
  //   ? `${API_CONFIG.BASE_URL}/tournaments/${tournament.id}`
  //   : `${API_CONFIG.BASE_URL}/tournaments`;
  //
  // const response = await fetch(url, {
  //   method,
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(tournament),
  // });
  //
  // if (!response.ok) throw new Error('Failed to save tournament');
  // return await response.json();

  return tournament;
}

/**
 * Lösche ein Turnier
 * @param id Tournament ID
 * @returns Promise<void>
 */
export async function deleteTournament(id: string): Promise<void> {
  if (API_CONFIG.USE_LOCAL_STORAGE) {
    return localStorageDeleteTournament(id);
  }

  // SPÄTER: Backend-Call
  // const response = await fetch(`${API_CONFIG.BASE_URL}/tournaments/${id}`, {
  //   method: 'DELETE',
  // });
  //
  // if (!response.ok) throw new Error('Failed to delete tournament');

  return;
}

// ============================================================================
// LOCAL STORAGE IMPLEMENTATION
// ============================================================================

const STORAGE_KEY = 'tournaments';

function localStorageGetTournaments(): Tournament[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const tournaments = JSON.parse(stored) as Tournament[];

    // Migration: Setze status auf 'published' für bestehende Turniere ohne status
    return tournaments.map(t => ({
      ...t,
      status: t.status || 'published',
      refereeConfig: t.refereeConfig || { mode: 'none' },
    }));
  } catch (error) {
    console.error('Error loading tournaments from localStorage:', error);
    return [];
  }
}

function localStorageGetTournamentById(id: string): Tournament | null {
  const tournaments = localStorageGetTournaments();
  return tournaments.find(t => t.id === id) || null;
}

function localStorageSaveTournament(tournament: Tournament): Tournament {
  const tournaments = localStorageGetTournaments();
  const index = tournaments.findIndex(t => t.id === tournament.id);

  const updatedTournament = {
    ...tournament,
    updatedAt: new Date().toISOString(),
  };

  if (index !== -1) {
    // Update existing
    tournaments[index] = updatedTournament;
  } else {
    // Create new
    tournaments.push(updatedTournament);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(tournaments));
  return updatedTournament;
}

function localStorageDeleteTournament(id: string): void {
  const tournaments = localStorageGetTournaments();
  const filtered = tournaments.filter(t => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

// ============================================================================
// BACKEND PREPARATION: Zusätzliche Felder für Multi-User Support
// ============================================================================

/**
 * HINWEIS: Wenn das Backend eingeführt wird, sollten folgende Felder
 * zum Tournament Type hinzugefügt werden:
 *
 * - userId: string              // ID des Erstellers
 * - organizerId: string          // ID der Organisation (falls vorhanden)
 * - visibility: 'public' | 'private' | 'organization'
 * - shareToken?: string          // Token zum Teilen des Turniers
 * - collaborators?: string[]     // User IDs mit Bearbeitungsrechten
 *
 * Diese Felder sind aktuell nicht im Tournament Type, da wir noch
 * keine User-Authentifizierung haben. Sie sind hier als Vorbereitung
 * für die Backend-Integration dokumentiert.
 */

export type BackendTournamentExtension = {
  userId: string;
  organizerId?: string;
  visibility: 'public' | 'private' | 'organization';
  shareToken?: string;
  collaborators?: string[];
};

// Typ für Backend-API (mit zusätzlichen Feldern)
export type BackendTournament = Tournament & BackendTournamentExtension;
