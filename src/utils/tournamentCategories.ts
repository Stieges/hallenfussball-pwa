/**
 * Tournament Category Helpers
 *
 * Kategorisiert Turniere nach dem GESPEICHERTEN Zustand vom Server (`lifecycleOf`, R3-1), NIE nach Spielständen oder
 * dem Datum allein (@LZ-001, @LZ-005, @LZ-006):
 * 1. Läuft - festgelegt + mindestens ein Spiel angepfiffen. Keine Tagesprüfung: ein Turnier über Mitternacht oder mit
 *    vergessenem Abschluss bleibt „Läuft“; auch wenn alle Spiele entschieden sind (die App schließt nie von selbst ab).
 * 2. Festgelegt/kommend - festgelegt, kein Spiel angepfiffen, auch wenn Datum oder Startzeit vorbei sind.
 * 3. Archiv - NUR abgeschlossen (`finished`) oder abgebrochen (`cancelled`, MVP+); ein vergangenes Datum verschiebt nichts.
 * 4. Entwurf - draft
 *
 * „Laufend“ heißt angepfiffen, nicht „Startzeit vorbei“ (@LZ-001: festgelegt, kein Spiel angepfiffen → „Festgelegt“;
 * Spiel angepfiffen → „Läuft“).
 */

import { Tournament, TRASH_RETENTION_DAYS } from '../types/tournament';
import { lifecycleOf } from '../core/services/lifecycle';

export type TournamentCategory = 'running' | 'upcoming' | 'finished' | 'draft' | 'trashed';

/**
 * Parse tournament date and time into a Date object
 * Exported for use in other modules
 */
export function getTournamentDateTime(tournament: Tournament): Date | null {
  // Prefer new startDate/startTime fields
  if (tournament.startDate && tournament.startTime) {
    const dateTimeString = `${tournament.startDate}T${tournament.startTime}:00`;
    const date = new Date(dateTimeString);
    return isNaN(date.getTime()) ? null : date;
  }

  // Fallback to legacy date/timeSlot fields
  if (tournament.date && tournament.timeSlot) {
    // Attempt to parse legacy date format
    // Assuming date is in format like "2025-01-15" or "15.01.2025"
    let dateStr = tournament.date;

    // Convert DD.MM.YYYY to YYYY-MM-DD if needed
    if (dateStr.includes('.')) {
      const [day, month, year] = dateStr.split('.');
      dateStr = `${year}-${month}-${day}`;
    }

    // Parse timeSlot (assuming format like "10:00" or "10:00 Uhr")
    const timeMatch = tournament.timeSlot.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const [, hours, minutes] = timeMatch;
      const dateTimeString = `${dateStr}T${hours.padStart(2, '0')}:${minutes}:00`;
      const date = new Date(dateTimeString);
      return isNaN(date.getTime()) ? null : date;
    }
  }

  return null;
}

/**
 * Check if tournament is in trash (soft-deleted)
 */
export function isTournamentTrashed(tournament: Tournament): boolean {
  return !!tournament.deletedAt;
}

/**
 * Categorize a single tournament
 */
export function categorizeTournament(tournament: Tournament): TournamentCategory {
  // Trashed tournaments (soft-deleted)
  if (isTournamentTrashed(tournament)) {
    return 'trashed';
  }

  switch (lifecycleOf(tournament)) {
    case 'draft':
      return 'draft';
    case 'running':
      return 'running';
    case 'finished':
    case 'cancelled':
      return 'finished';
    case 'fixed':
      return 'upcoming';
  }
}

/**
 * Categorize multiple tournaments into groups
 */
export interface CategorizedTournaments {
  running: Tournament[];
  upcoming: Tournament[];
  finished: Tournament[];
  draft: Tournament[];
  trashed: Tournament[];
}

/**
 * Extended categorization with archived tournaments grouped by year
 */
export interface ExtendedCategorizedTournaments extends CategorizedTournaments {
  archivedByYear: Record<number, Tournament[]>;
}

export function categorizeTournaments(tournaments: Tournament[]): CategorizedTournaments {
  const categorized: CategorizedTournaments = {
    running: [],
    upcoming: [],
    finished: [],
    draft: [],
    trashed: [],
  };

  for (const tournament of tournaments) {
    const category = categorizeTournament(tournament);
    categorized[category].push(tournament);
  }

  // Sort each category
  // Running: by start time (earliest first)
  // Upcoming: by start time (earliest first)
  // Finished: by start time (most recent first)
  // Draft: by updatedAt (most recent first)

  categorized.running.sort((a, b) => {
    const dateA = getTournamentDateTime(a);
    const dateB = getTournamentDateTime(b);
    if (!dateA || !dateB) {return 0;}
    return dateA.getTime() - dateB.getTime();
  });

  categorized.upcoming.sort((a, b) => {
    const dateA = getTournamentDateTime(a);
    const dateB = getTournamentDateTime(b);
    if (!dateA || !dateB) {return 0;}
    return dateA.getTime() - dateB.getTime();
  });

  categorized.finished.sort((a, b) => {
    const dateA = getTournamentDateTime(a);
    const dateB = getTournamentDateTime(b);
    if (!dateA || !dateB) {return 0;}
    return dateB.getTime() - dateA.getTime(); // Most recent first
  });

  categorized.draft.sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  // Trashed: by deletedAt (most recently deleted first)
  categorized.trashed.sort((a, b) => {
    const dateA = a.deletedAt ? new Date(a.deletedAt) : new Date(0);
    const dateB = b.deletedAt ? new Date(b.deletedAt) : new Date(0);
    return dateB.getTime() - dateA.getTime();
  });

  return categorized;
}

/**
 * Format tournament date for display
 */
export function formatTournamentDate(tournament: Tournament): string {
  const date = getTournamentDateTime(tournament);
  if (!date) {
    // Fallback to legacy fields
    return tournament.date || 'Kein Datum';
  }

  // Format as "DD.MM.YYYY, HH:mm Uhr"
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day}.${month}.${year}, ${hours}:${minutes} Uhr`;
}

/**
 * Get extended categorization with archived by year
 */
export function getExtendedCategories(tournaments: Tournament[]): ExtendedCategorizedTournaments {
  const base = categorizeTournaments(tournaments);

  // Group finished tournaments by year
  const archivedByYear: Record<number, Tournament[]> = {};
  for (const tournament of base.finished) {
    const date = getTournamentDateTime(tournament);
    const year = date ? date.getFullYear() : new Date().getFullYear();
     
    if (!archivedByYear[year]) {
      archivedByYear[year] = [];
    }
    archivedByYear[year].push(tournament);
  }

  return {
    ...base,
    archivedByYear,
  };
}

/**
 * Calculate remaining days until permanent deletion
 * Accepts a Tournament object or a deletedAt string
 */
export function getRemainingDays(tournamentOrDeletedAt: Tournament | string): number | null {
  const deletedAt = typeof tournamentOrDeletedAt === 'string'
    ? tournamentOrDeletedAt
    : tournamentOrDeletedAt.deletedAt;

  if (!deletedAt) {return null;}

  const deletedDate = new Date(deletedAt);
  const expiryDate = new Date(deletedDate.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const remainingMs = expiryDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}

/**
 * Get countdown style based on remaining days
 */
export function getCountdownStyle(days: number): 'normal' | 'warning' | 'danger' {
  if (days <= 3) {return 'danger';}
  if (days <= 7) {return 'warning';}
  return 'normal';
}

/**
 * Filter only active (non-trashed) tournaments
 */
export function getActiveTournaments(tournaments: Tournament[]): Tournament[] {
  return tournaments.filter(t => !t.deletedAt);
}

/**
 * Filter only trashed tournaments
 */
export function getTrashedTournaments(tournaments: Tournament[]): Tournament[] {
  return tournaments.filter(t => !!t.deletedAt);
}

/**
 * Get tournaments that are expired (past retention period)
 */
export function getExpiredTrashedTournaments(tournaments: Tournament[]): Tournament[] {
  return tournaments.filter(t => {
    if (!t.deletedAt) {return false;}
    return getRemainingDays(t.deletedAt) === 0;
  });
}
