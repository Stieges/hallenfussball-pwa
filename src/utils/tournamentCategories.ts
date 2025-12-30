/**
 * Tournament Category Helpers
 *
 * Kategorisiert Turniere basierend auf Status, Spielstand und Zeitpunkt:
 * 1. Aktuell laufende Turniere - published + datum ist heute + aktuelle Zeit > Startzeit + nicht alle Spiele beendet
 * 2. Bevorstehende Turniere - published + Datum+Zeit in der Zukunft
 * 3. Beendete Turniere - published + (alle Spiele beendet ODER manuell beendet ODER Datum in Vergangenheit)
 * 4. Gespeicherte Turniere - draft status
 */

import { Tournament, Match, TRASH_RETENTION_DAYS } from '../types/tournament';

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
 * Check if a match has a valid result
 */
function matchHasResult(match: Match): boolean {
  return typeof match.scoreA === 'number' && typeof match.scoreB === 'number';
}

/**
 * Check if tournament is completed based on match results
 * A tournament is completed when:
 * 1. manuallyCompleted flag is set, OR
 * 2. All matches have results (group matches + final if configured)
 */
export function isTournamentCompleted(tournament: Tournament): boolean {
  // Manual override takes precedence
  if (tournament.manuallyCompleted) {
    return true;
  }

  // No matches = not completed
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime check for legacy data
  if (!tournament.matches || tournament.matches.length === 0) {
    return false;
  }

  // Check all group matches
  const groupMatches = tournament.matches.filter(m => !m.isFinal);
  const allGroupMatchesComplete = groupMatches.every(matchHasResult);

  if (!allGroupMatchesComplete) {
    return false;
  }

  // Check finals if configured
  const finalMatches = tournament.matches.filter(m => m.isFinal);

  if (finalMatches.length === 0) {
    // No finals configured - tournament complete when all group matches done
    return true;
  }

  // Find the decisive final match (the actual final or 3rd place if that's the last)
  const finalMatch = finalMatches.find(m => m.finalType === 'final');

  // The tournament is complete when the final has a result
  if (finalMatch && matchHasResult(finalMatch)) {
    return true;
  }

  // Alternative: All configured finals complete
  const allFinalsComplete = finalMatches.every(matchHasResult);
  return allFinalsComplete;
}

/**
 * Check if tournament is currently running
 * Running = datum ist heute UND aktuelle Zeit > Startzeit UND nicht beendet
 */
function isTournamentRunning(tournament: Tournament, now: Date): boolean {
  if (tournament.status !== 'published') {return false;}

  // If tournament is completed (all matches done or manually marked), it's not running
  if (isTournamentCompleted(tournament)) {return false;}

  const tournamentDate = getTournamentDateTime(tournament);
  if (!tournamentDate) {return false;}

  const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tournamentDateOnly = new Date(
    tournamentDate.getFullYear(),
    tournamentDate.getMonth(),
    tournamentDate.getDate()
  );

  // Check if tournament date is today
  const isToday = nowDateOnly.getTime() === tournamentDateOnly.getTime();
  if (!isToday) {return false;}

  // Check if current time is after tournament start time
  return now >= tournamentDate;
}

/**
 * Check if tournament is upcoming (future date/time)
 */
function isTournamentUpcoming(tournament: Tournament, now: Date): boolean {
  if (tournament.status !== 'published') {return false;}

  const tournamentDate = getTournamentDateTime(tournament);
  if (!tournamentDate) {return false;}

  return tournamentDate > now;
}

/**
 * Check if tournament is finished
 * Finished = completed (all matches done OR manually marked) OR date in past
 */
function isTournamentFinished(tournament: Tournament, now: Date): boolean {
  if (tournament.status !== 'published') {return false;}

  // Primary: Check if tournament is completed (match-based or manual)
  if (isTournamentCompleted(tournament)) {return true;}

  const tournamentDate = getTournamentDateTime(tournament);
  if (!tournamentDate) {return false;}

  const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tournamentDateOnly = new Date(
    tournamentDate.getFullYear(),
    tournamentDate.getMonth(),
    tournamentDate.getDate()
  );

  // Fallback: If date is in the past (before today), it's finished
  if (tournamentDateOnly < nowDateOnly) {return true;}

  return false;
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
export function categorizeTournament(tournament: Tournament, now: Date = new Date()): TournamentCategory {
  // Trashed tournaments (soft-deleted)
  if (isTournamentTrashed(tournament)) {
    return 'trashed';
  }

  // Draft tournaments
  if (tournament.status === 'draft') {
    return 'draft';
  }

  // Published tournaments - check timing
  if (isTournamentRunning(tournament, now)) {
    return 'running';
  }

  if (isTournamentUpcoming(tournament, now)) {
    return 'upcoming';
  }

  if (isTournamentFinished(tournament, now)) {
    return 'finished';
  }

  // Fallback: if published but can't categorize, treat as upcoming
  return 'upcoming';
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
  finishable: Tournament[];
}

export function categorizeTournaments(tournaments: Tournament[], now: Date = new Date()): CategorizedTournaments {
  const categorized: CategorizedTournaments = {
    running: [],
    upcoming: [],
    finished: [],
    draft: [],
    trashed: [],
  };

  for (const tournament of tournaments) {
    const category = categorizeTournament(tournament, now);
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
 * Get extended categorization with archived by year and finishable tournaments
 */
export function getExtendedCategories(tournaments: Tournament[], now: Date = new Date()): ExtendedCategorizedTournaments {
  const base = categorizeTournaments(tournaments, now);

  // Group finished tournaments by year
  const archivedByYear: Record<number, Tournament[]> = {};
  for (const tournament of base.finished) {
    const date = getTournamentDateTime(tournament);
    const year = date ? date.getFullYear() : new Date().getFullYear();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Initialize array for new year key
    if (!archivedByYear[year]) {
      archivedByYear[year] = [];
    }
    archivedByYear[year].push(tournament);
  }

  // Find finishable tournaments (100% matches complete but not archived)
  const finishable = [...base.running, ...base.upcoming].filter(tournament => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety for legacy data
    if (!tournament.matches || tournament.matches.length === 0) {return false;}
    if (tournament.manuallyCompleted) {return false;}

    const allMatchesComplete = tournament.matches.every(
      m => typeof m.scoreA === 'number' && typeof m.scoreB === 'number'
    );

    return allMatchesComplete;
  });

  return {
    ...base,
    archivedByYear,
    finishable,
  };
}

/**
 * Calculate remaining days until permanent deletion
 */
export function getRemainingDays(deletedAt: string): number {
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
