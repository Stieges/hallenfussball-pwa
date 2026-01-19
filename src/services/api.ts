/**
 * API Service Layer
 *
 * Abstrahiert die Datenzugriff-Logik. Aktuell verwendet IndexedDB (mit localStorage Fallback),
 * kann später einfach gegen REST API oder andere Backends ausgetauscht werden.
 *
 * MIGRATION PATH:
 * 1. Aktuell: IndexedDB via createStorage() (localStorage fallback)
 * 2. Später: Umstellung auf HTTP-Calls zu einer Cloud-API
 *    - Einfach die Funktionen in diesem File anpassen
 *    - Interface bleibt gleich
 *    - Keine Änderungen in den Komponenten nötig
 */

import { Tournament } from '../types/tournament';
import { STORAGE_KEYS } from '../constants/storage';
import { createStorage } from '../core/storage/StorageFactory';

/**
 * API Configuration
 * Später hier die Backend-URL konfigurieren
 */
const API_CONFIG = {
  // Für IndexedDB: nicht verwendet
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
    return storageGetTournaments();
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
    return storageGetTournamentById(id);
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
    return storageSaveTournament(tournament);
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
    return storageDeleteTournament(id);
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
// INDEXED DB STORAGE IMPLEMENTATION (with localStorage fallback via createStorage)
// ============================================================================

async function storageGetTournaments(): Promise<Tournament[]> {
  try {
    const storage = await createStorage();
    const stored = await storage.get(STORAGE_KEYS.TOURNAMENTS);
    if (!stored) {return [];}

    const tournaments = stored as Tournament[];

    // Migration: Setze defaults für bestehende Turniere ohne bestimmte Felder (legacy data)
    return tournaments.map(t => ({
      ...t,
       
      status: t.status ?? 'published',
      refereeConfig: t.refereeConfig ?? { mode: 'none' },
      isExternal: t.isExternal ?? false,
    }));
  } catch (error) {
    console.error('Error loading tournaments from storage:', error);
    return [];
  }
}

async function storageGetTournamentById(id: string): Promise<Tournament | null> {
  const tournaments = await storageGetTournaments();
  return tournaments.find(t => t.id === id) ?? null;
}

async function storageSaveTournament(tournament: Tournament): Promise<Tournament> {
  const storage = await createStorage();
  const tournaments = await storageGetTournaments();
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

  await storage.set(STORAGE_KEYS.TOURNAMENTS, tournaments);
  return updatedTournament;
}

async function storageDeleteTournament(id: string): Promise<void> {
  const storage = await createStorage();
  const tournaments = await storageGetTournaments();
  const filtered = tournaments.filter(t => t.id !== id);
  await storage.set(STORAGE_KEYS.TOURNAMENTS, filtered);
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
