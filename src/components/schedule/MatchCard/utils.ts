/**
 * MatchCard Utilities
 *
 * Shared helper functions for MatchCard components.
 * Extracted to avoid code duplication between MatchCard and MatchCardDesktop.
 */

/**
 * Formats a time string for display.
 * Handles both ISO date strings and pre-formatted HH:MM strings.
 *
 * @param isoOrTime - ISO date string or formatted time (HH:MM)
 * @returns Formatted time string (HH:MM) or '--:--' if invalid
 *
 * @example
 * formatTime('2025-01-15T09:00:00') // '09:00'
 * formatTime('09:00') // '09:00'
 * formatTime(undefined) // '--:--'
 */
export function formatTime(isoOrTime?: string): string {
  if (!isoOrTime) {
    return '--:--';
  }

  // If already formatted (HH:MM), return as-is
  if (/^\d{1,2}:\d{2}$/.test(isoOrTime)) {
    return isoOrTime;
  }

  // Try to parse as Date
  try {
    const date = new Date(isoOrTime);
    if (isNaN(date.getTime())) {
      return isoOrTime;
    }
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoOrTime;
  }
}

/**
 * Extracts initials from a team name for avatar display.
 *
 * @param name - Team name
 * @returns 2-character initials in uppercase
 *
 * @example
 * getTeamInitials('FC Bayern') // 'FB'
 * getTeamInitials('Adler') // 'AD'
 * getTeamInitials('SV Rot Weiß') // 'SR'
 */
export function getTeamInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/**
 * Formats a referee display string.
 *
 * @param referee - Referee number (1-based)
 * @param refereeName - Optional custom name
 * @returns Formatted referee string or undefined if no referee
 *
 * @example
 * formatReferee(1) // 'SR 1'
 * formatReferee(2, 'Max Müller') // 'Max Müller'
 * formatReferee(undefined) // undefined
 */
export function formatReferee(
  referee?: number,
  refereeName?: string
): string | undefined {
  if (referee === undefined) {
    return undefined;
  }
  if (refereeName) {
    return refereeName;
  }
  return `SR ${referee}`;
}
