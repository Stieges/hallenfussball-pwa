/**
 * Team Display Name Generator
 *
 * Generates smart abbreviations for team names on monitor displays.
 * Uses a 3-stage cascade:
 *   1. Legal Cleanup — Remove e.V., GmbH, club prefixes, years
 *   2. Abbreviation Mapping — Known patterns → short forms
 *   3. Initials — First letters of remaining words
 *
 * @see MONITOR-LIVE-SCORE-REDESIGN.md Section 15
 */

// =============================================================================
// TYPES
// =============================================================================

export interface TeamDisplayNames {
  /** Original name (whitespace-normalized) */
  full: string;
  /** Legal cleanup + abbreviation mapping applied */
  medium: string;
  /** 2-4 character abbreviation (initials-based) */
  short: string;
  /** 2 character max abbreviation */
  micro: string;
}

// =============================================================================
// STAGE 1: LEGAL CLEANUP
// =============================================================================

/** e.V. pattern (separate because dots don't play well with \b) */
const EV_PATTERN = /\s*e\.?\s*V\.?\s*/g;

/** Corporate suffixes to remove (word-boundary to avoid matching inside words like "Augsburg") */
const CORPORATE_SUFFIXES = /\s*\b(GmbH|gGmbH|UG|AG|Ltd\.?|Inc\.?)\b\s*/gi;

/** Club prefixes to strip (German football conventions) */
const CLUB_PREFIXES =
  /^(1\.\s*)?(\s*(SC|SV|SG|FC|FSV|TSV|TuS|VfB|VfL|VfR|SSV|SpVgg|SuS|BV|BSV|ASV|TSG|MTV|DJK|TV|FV|HSV|ESV|WSV|PSV|KSV|CSV|Fortuna|Concordia|Eintracht|Borussia|Alemannia|Arminia|Viktoria|Hertha|Germania|Preußen|Wacker)\s+)/i;

/** Year patterns (e.g. 1920, 1899, von 1928) */
const YEAR_PATTERN = /\s*(von\s+)?(1[6-9]\d{2}|20[0-2]\d)\s*/g;

function legalCleanup(name: string): string {
  return name
    .replace(EV_PATTERN, ' ')
    .replace(CORPORATE_SUFFIXES, ' ')
    .replace(YEAR_PATTERN, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function stripClubPrefix(name: string): string {
  return name.replace(CLUB_PREFIXES, '').trim();
}

// =============================================================================
// STAGE 2: ABBREVIATION MAPPING
// =============================================================================

/**
 * Known abbreviation patterns (case-insensitive matching).
 * Order matters: longer patterns first to avoid partial matches.
 */
const ABBREVIATION_MAP: [RegExp, string][] = [
  // Color combinations (hyphenated and space-separated, handle ß and ss)
  [/Blau[\s-]Wei(?:ß|ss|s)/gi, 'BW'],
  [/Rot[\s-]Wei(?:ß|ss|s)/gi, 'RW'],
  [/Grün[\s-]Wei(?:ß|ss|s)/gi, 'GW'],
  [/Schwarz[\s-]Wei(?:ß|ss|s)/gi, 'SW'],
  [/Schwarz[\s-]Gelb/gi, 'SG'],
  [/Rot[\s-]Gelb/gi, 'RG'],
  [/Blau[\s-]Gelb/gi, 'BG'],

  // Club designations
  [/Sportfreunde/gi, 'Spfr.'],
  [/Spielvereinigung/gi, 'SpVgg.'],
  [/Turnerbund/gi, 'TB'],

  // City abbreviations (common German football cities)
  [/München/gi, 'M.'],
  [/Düsseldorf/gi, 'D.'],
  [/Frankfurt/gi, 'Ffm.'],
  [/Nürnberg/gi, 'Nbg.'],
  [/Hamburg/gi, 'HH'],
  [/Hannover/gi, 'H.'],
  [/Dortmund/gi, 'Do.'],
  [/Gelsenkirchen/gi, 'GE'],
  [/Mönchengladbach/gi, 'MG'],
  [/Braunschweig/gi, 'BS'],
  [/Kaiserslautern/gi, 'KL'],
  [/Leverkusen/gi, 'Lev.'],
  [/Wolfsburg/gi, 'Wob.'],
  [/Saarbrücken/gi, 'SB'],
  [/Karlsruhe/gi, 'KA'],
];

function applyAbbreviations(name: string): string {
  let result = name;
  for (const [pattern, replacement] of ABBREVIATION_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result.trim().replace(/\s+/g, ' ');
}

// =============================================================================
// STAGE 3: INITIALS (SHORT / MICRO)
// =============================================================================

function generateInitials(mediumName: string): { short: string; micro: string } {
  if (!mediumName) {
    return { short: '', micro: '' };
  }

  const words = mediumName
    .split(/[\s-]+/)
    .filter((w) => w.length > 0)
    // Skip abbreviation artifacts like "." or single-dot entries
    .filter((w) => w.replace(/\./g, '').length > 0);

  if (words.length === 0) {
    return { short: '', micro: '' };
  }

  // Build initials: all-uppercase short words (like "BW", "RW") contribute
  // all their letters; normal words contribute only the first letter.
  let initials = '';
  for (const word of words) {
    const cleaned = word.replace(/\./g, '');
    if (cleaned.length <= 3 && cleaned === cleaned.toUpperCase()) {
      // Short all-caps abbreviation → use full (e.g. "BW" → "BW")
      initials += cleaned;
    } else {
      initials += word[0].toUpperCase();
    }
    if (initials.length >= 4) { break; }
  }

  const short = initials.slice(0, 4);
  const micro = short.slice(0, 2);

  return { short, micro };
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Generate display name variants for a team.
 *
 * @param fullName - The full, original team name
 * @returns Object with full, medium, short, and micro variants
 *
 * @example
 * ```typescript
 * generateDisplayNames('SV Blau-Weiß Recklinghausen 1928 e.V.')
 * // → { full: '...', medium: 'BW Recklinghausen', short: 'BWR', micro: 'BW' }
 * ```
 */
export function generateDisplayNames(fullName: string): TeamDisplayNames {
  // Normalize whitespace
  const normalized = fullName.trim().replace(/\s+/g, ' ');

  if (!normalized) {
    return { full: '', medium: '', short: '', micro: '' };
  }

  // Stage 1: Legal cleanup (remove suffixes + years)
  const cleaned = legalCleanup(normalized);

  // Strip club prefix for medium variant
  const withoutPrefix = stripClubPrefix(cleaned);

  // Stage 2: Apply abbreviation mapping
  const medium = applyAbbreviations(withoutPrefix);

  // Stage 3: Generate initials
  const { short, micro } = generateInitials(medium);

  return { full: normalized, medium, short, micro };
}

// =============================================================================
// VARIANT SELECTION
// =============================================================================

/**
 * Select the best display name variant based on character limit.
 * Falls through: full → medium → short → micro.
 */
export function selectVariant(
  names: TeamDisplayNames,
  maxChars: number
): string {
  if (names.full.length <= maxChars) { return names.full; }
  if (names.medium.length <= maxChars) { return names.medium; }
  if (names.short.length <= maxChars) { return names.short; }
  return names.micro;
}

// =============================================================================
// CACHED WRAPPER
// =============================================================================

const CACHE = new Map<string, TeamDisplayNames>();
const MAX_CACHE_SIZE = 200;

/**
 * Cached version of generateDisplayNames.
 * Uses a simple LRU-style cache (evicts oldest entry when full).
 */
export function getDisplayNames(fullName: string): TeamDisplayNames {
  const cached = CACHE.get(fullName);
  if (cached) { return cached; }

  const result = generateDisplayNames(fullName);

  if (CACHE.size >= MAX_CACHE_SIZE) {
    // Remove oldest entry (first key in insertion order)
    const firstKey = CACHE.keys().next().value;
    if (firstKey !== undefined) { CACHE.delete(firstKey); }
  }

  CACHE.set(fullName, result);
  return result;
}
