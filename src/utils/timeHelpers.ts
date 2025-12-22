/**
 * Time Helper Utilities
 *
 * QW-005: Extracted from MatchCockpit.tsx and UpcomingMatchesSidebar.tsx
 * BUG-MOD-004 FIX: Properly handles multi-day tournaments
 */

/**
 * Calculates minutes until a scheduled time
 *
 * @param timeString - Time in HH:MM format (e.g., "14:30")
 * @param referenceDate - Optional reference date for the scheduled time.
 *                        If not provided, assumes today or tomorrow.
 * @returns Minutes until the time, or null if parsing fails
 *
 * BUG-MOD-004 FIX: Now properly handles multi-day tournaments:
 * - If referenceDate is provided, uses that date
 * - If time is in the past today and no referenceDate, assumes tomorrow
 */
export function calculateMinutesUntil(
  timeString: string,
  referenceDate?: Date | string
): number | null {
  try {
    // Parse the time string (HH:MM format)
    const timeParts = timeString.split(':');
    if (timeParts.length < 2) {return null;}

    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);

    if (isNaN(hours) || isNaN(minutes)) {return null;}
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {return null;}

    const now = new Date();
    let target: Date;

    if (referenceDate) {
      // Use the provided reference date
      target = typeof referenceDate === 'string' ? new Date(referenceDate) : new Date(referenceDate);
      target.setHours(hours, minutes, 0, 0);
    } else {
      // Legacy behavior: assume today, or tomorrow if time has passed
      target = new Date();
      target.setHours(hours, minutes, 0, 0);

      // If target is in the past, assume it's for tomorrow
      // (for single-day tournaments where time wraps)
      if (target < now) {
        target.setDate(target.getDate() + 1);
      }
    }

    const diffMs = target.getTime() - now.getTime();
    return Math.round(diffMs / 60000);
  } catch {
    return null;
  }
}

/**
 * Formats elapsed seconds as MM:SS string
 */
export function formatElapsedTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formats a duration in seconds to a human-readable string
 * e.g., 630 -> "10:30 Min"
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) {
    return `${mins} Min`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')} Min`;
}

/**
 * Parses a time string (HH:MM or MM:SS) to total seconds
 * @returns Total seconds, or null if parsing fails
 */
export function parseTimeToSeconds(timeString: string): number | null {
  try {
    const parts = timeString.split(':').map(p => parseInt(p.trim(), 10));
    if (parts.length !== 2) {return null;}
    if (parts.some(isNaN)) {return null;}

    const [first, second] = parts;

    // Validate ranges
    if (first < 0 || second < 0 || second > 59) {return null;}

    // Assume MM:SS format for game time
    return first * 60 + second;
  } catch {
    return null;
  }
}

/**
 * Gets a human-readable time ago string
 * e.g., "vor 5 Minuten", "vor 1 Stunde"
 */
export function timeAgo(date: Date | string): string {
  const now = new Date();
  const target = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - target.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {return 'gerade eben';}
  if (diffMinutes === 1) {return 'vor 1 Minute';}
  if (diffMinutes < 60) {return `vor ${diffMinutes} Minuten`;}

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) {return 'vor 1 Stunde';}
  if (diffHours < 24) {return `vor ${diffHours} Stunden`;}

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {return 'gestern';}
  return `vor ${diffDays} Tagen`;
}
