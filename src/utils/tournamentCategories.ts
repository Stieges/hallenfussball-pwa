/**
 * Tournament Category Helpers
 *
 * Kategorisiert Turniere basierend auf Status und Zeitpunkt:
 * 1. Aktuell laufende Turniere - published + datum ist heute + aktuelle Zeit > Startzeit
 * 2. Bevorstehende Turniere - published + Datum+Zeit in der Zukunft
 * 3. Beendete Turniere - published + Datum+Zeit in der Vergangenheit
 * 4. Gespeicherte Turniere - draft status
 */

import { Tournament } from '../types/tournament';

export type TournamentCategory = 'running' | 'upcoming' | 'finished' | 'draft';

/**
 * Parse tournament date and time into a Date object
 */
function getTournamentDateTime(tournament: Tournament): Date | null {
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
 * Check if tournament is currently running
 * Running = datum ist heute UND aktuelle Zeit > Startzeit
 */
function isTournamentRunning(tournament: Tournament, now: Date): boolean {
  if (tournament.status !== 'published') {return false;}

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
 * Check if tournament is finished (past date/time)
 */
function isTournamentFinished(tournament: Tournament, now: Date): boolean {
  if (tournament.status !== 'published') {return false;}

  const tournamentDate = getTournamentDateTime(tournament);
  if (!tournamentDate) {return false;}

  // Tournament is finished if:
  // 1. Date is in the past (not today)
  // 2. OR date is today but we're running (activity present) - but not finished yet
  // For simplicity: finished = date+time < now AND not running

  const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tournamentDateOnly = new Date(
    tournamentDate.getFullYear(),
    tournamentDate.getMonth(),
    tournamentDate.getDate()
  );

  // If date is in the past (before today), it's finished
  if (tournamentDateOnly < nowDateOnly) {return true;}

  // If date is today, check if it's running
  if (tournamentDateOnly.getTime() === nowDateOnly.getTime()) {
    // Not finished if still running
    return !isTournamentRunning(tournament, now);
  }

  return false;
}

/**
 * Categorize a single tournament
 */
export function categorizeTournament(tournament: Tournament, now: Date = new Date()): TournamentCategory {
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
}

export function categorizeTournaments(tournaments: Tournament[], now: Date = new Date()): CategorizedTournaments {
  const categorized: CategorizedTournaments = {
    running: [],
    upcoming: [],
    finished: [],
    draft: [],
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
