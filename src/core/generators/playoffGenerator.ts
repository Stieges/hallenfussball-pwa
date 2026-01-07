/**
 * Playoff/Finals Generator - Preset-based System
 *
 * Generiert Finalrunden-Spiele basierend auf Presets:
 * - none: Keine Finalrunde
 * - final-only: Nur Finale (direkt)
 * - top-4: Halbfinale + Finale + Platz 3
 * - top-8: Viertelfinale + alles darüber + Platzierungen 5-8
 * - top-16: Achtelfinale + Viertelfinale + Halbfinale + Finale (8+ Gruppen)
 * - all-places: Alle Plätze ausspielen
 *
 * Inspiriert von Blitzcup und MeinTurnierplan
 */

import { FinalsPreset, FinalsConfig } from '../../types/tournament';

export interface PlayoffMatch {
  id: string;
  label: string;
  home: string;        // z.B. "1A", "2B", "winner-semi1", "loser-qf2"
  away: string;
  rank?: number | [number, number]; // Platzierung(en), die ausgespielt werden
  dependsOn?: string[]; // IDs von Spielen, die vorher stattfinden müssen
}

/**
 * Group size information for dynamic playoff generation
 */
export interface GroupSizeInfo {
  [groupLabel: string]: number; // e.g., { 'A': 3, 'B': 2 }
}

/**
 * Generiert alle Playoff-Spiele basierend auf Preset und Gruppenanzahl
 * @param numberOfGroups - Anzahl der Gruppen
 * @param config - Finals-Konfiguration
 * @param groupSizes - Optional: Größe jeder Gruppe für dynamische Platzierungsspiele
 */
export function generatePlayoffMatches(
  numberOfGroups: number,
  config: FinalsConfig,
  groupSizes?: GroupSizeInfo
): PlayoffMatch[] {
  const { preset } = config;

  if (preset === 'none' || numberOfGroups < 2) {
    return [];
  }

  const matches: PlayoffMatch[] = [];

  switch (preset) {
    case 'final-only':
      matches.push(...generateFinalOnly(numberOfGroups));
      break;

    case 'top-4':
      matches.push(...generateTop4(numberOfGroups));
      break;

    case 'top-8':
      matches.push(...generateTop8(numberOfGroups));
      break;

    case 'top-16':
      matches.push(...generateTop16(numberOfGroups));
      break;

    case 'all-places':
      matches.push(...generateAllPlaces(numberOfGroups, groupSizes));
      break;
  }

  return matches;
}

// ============================================================================
// PRESET GENERATORS
// ============================================================================

/**
 * Nur Finale (direkt, ohne Halbfinale)
 * Bei 2 Gruppen: 1A vs 1B
 */
function generateFinalOnly(numberOfGroups: number): PlayoffMatch[] {
  if (numberOfGroups === 2) {
    return [
      {
        id: 'final',
        label: 'Finale',
        home: 'group-a-1st',
        away: 'group-b-1st',
        rank: 1,
      },
    ];
  }

  // Bei mehr Gruppen: Beste 2 Teams ermitteln (vereinfacht)
  return [
    {
      id: 'final',
      label: 'Finale',
      home: 'group-a-1st',
      away: 'group-b-1st',
      rank: 1,
    },
  ];
}

/**
 * Top 4: Halbfinale + Finale + Platz 3
 * Standard bei 2 Gruppen
 */
function generateTop4(numberOfGroups: number): PlayoffMatch[] {
  const matches: PlayoffMatch[] = [];

  if (numberOfGroups === 2) {
    // Halbfinale mit Kreuzspiel
    matches.push(
      {
        id: 'semi1',
        label: '1. Halbfinale',
        home: 'group-a-2nd',
        away: 'group-b-1st',
        dependsOn: [],
      },
      {
        id: 'semi2',
        label: '2. Halbfinale',
        home: 'group-a-1st',
        away: 'group-b-2nd',
        dependsOn: [],
      }
    );
  } else {
    // Bei 3+ Gruppen: beste 4 Teams
    matches.push(
      {
        id: 'semi1',
        label: '1. Halbfinale',
        home: 'group-a-1st',
        away: 'group-b-2nd',
        dependsOn: [],
      },
      {
        id: 'semi2',
        label: '2. Halbfinale',
        home: 'group-b-1st',
        away: 'group-a-2nd',
        dependsOn: [],
      }
    );
  }

  // Finale und Platz 3
  matches.push(
    {
      id: 'third-place',
      label: 'Spiel um Platz 3',
      home: 'semi1-loser',
      away: 'semi2-loser',
      rank: 3,
      dependsOn: ['semi1', 'semi2'],
    },
    {
      id: 'final',
      label: 'Finale',
      home: 'semi1-winner',
      away: 'semi2-winner',
      rank: 1,
      dependsOn: ['semi1', 'semi2'],
    }
  );

  return matches;
}

/**
 * Top 8: Viertelfinale + Halbfinale + Finale + Platzierungen 5-8
 */
function generateTop8(numberOfGroups: number): PlayoffMatch[] {
  const matches: PlayoffMatch[] = [];

  // Viertelfinale
  if (numberOfGroups === 2) {
    // Bei 2 Gruppen: Nur Top 4 möglich (kein echtes Top 8)
    // Verwende einfach Top 4 Logik
    return generateTop4(numberOfGroups);
  } else if (numberOfGroups >= 4) {
    // Bei 4+ Gruppen: klassische Paarungen
    matches.push(
      { id: 'qf1', label: 'Viertelfinale 1', home: 'group-a-1st', away: 'group-d-2nd', dependsOn: [] },
      { id: 'qf2', label: 'Viertelfinale 2', home: 'group-b-1st', away: 'group-c-2nd', dependsOn: [] },
      { id: 'qf3', label: 'Viertelfinale 3', home: 'group-c-1st', away: 'group-b-2nd', dependsOn: [] },
      { id: 'qf4', label: 'Viertelfinale 4', home: 'group-d-1st', away: 'group-a-2nd', dependsOn: [] }
    );
  }

  // Halbfinale
  matches.push(
    { id: 'semi1', label: '1. Halbfinale', home: 'qf1-winner', away: 'qf4-winner', dependsOn: ['qf1', 'qf4'] },
    { id: 'semi2', label: '2. Halbfinale', home: 'qf2-winner', away: 'qf3-winner', dependsOn: ['qf2', 'qf3'] }
  );

  // Platz 5-8 (nur wenn genug Viertelfinale)
  if (matches.filter(m => m.id.startsWith('qf')).length >= 4) {
    matches.push(
      { id: 'place56', label: 'Spiel um Platz 5', home: 'qf1-loser', away: 'qf2-loser', rank: [5, 6], dependsOn: ['qf1', 'qf2'] },
      { id: 'place78', label: 'Spiel um Platz 7', home: 'qf3-loser', away: 'qf4-loser', rank: [7, 8], dependsOn: ['qf3', 'qf4'] }
    );
  }

  // Finale + Platz 3
  matches.push(
    { id: 'third-place', label: 'Spiel um Platz 3', home: 'semi1-loser', away: 'semi2-loser', rank: 3, dependsOn: ['semi1', 'semi2'] },
    { id: 'final', label: 'Finale', home: 'semi1-winner', away: 'semi2-winner', rank: 1, dependsOn: ['semi1', 'semi2'] }
  );

  return matches;
}

/**
 * Top 16: Achtelfinale + Viertelfinale + Halbfinale + Finale
 * Bei 8+ Gruppen: Top 2 pro Gruppe = 16 Teams
 */
function generateTop16(numberOfGroups: number): PlayoffMatch[] {
  const matches: PlayoffMatch[] = [];

  // Bei weniger als 8 Gruppen: Fallback auf Top-8
  if (numberOfGroups < 8) {
    return generateTop8(numberOfGroups);
  }

  // Achtelfinale (Round of 16)
  // Klassische Paarungen: 1A-2H, 1B-2G, 1C-2F, 1D-2E, 1E-2D, 1F-2C, 1G-2B, 1H-2A
  matches.push(
    { id: 'r16-1', label: 'Achtelfinale 1', home: 'group-a-1st', away: 'group-h-2nd', dependsOn: [] },
    { id: 'r16-2', label: 'Achtelfinale 2', home: 'group-b-1st', away: 'group-g-2nd', dependsOn: [] },
    { id: 'r16-3', label: 'Achtelfinale 3', home: 'group-c-1st', away: 'group-f-2nd', dependsOn: [] },
    { id: 'r16-4', label: 'Achtelfinale 4', home: 'group-d-1st', away: 'group-e-2nd', dependsOn: [] },
    { id: 'r16-5', label: 'Achtelfinale 5', home: 'group-e-1st', away: 'group-d-2nd', dependsOn: [] },
    { id: 'r16-6', label: 'Achtelfinale 6', home: 'group-f-1st', away: 'group-c-2nd', dependsOn: [] },
    { id: 'r16-7', label: 'Achtelfinale 7', home: 'group-g-1st', away: 'group-b-2nd', dependsOn: [] },
    { id: 'r16-8', label: 'Achtelfinale 8', home: 'group-h-1st', away: 'group-a-2nd', dependsOn: [] }
  );

  // Viertelfinale
  matches.push(
    { id: 'qf1', label: 'Viertelfinale 1', home: 'r16-1-winner', away: 'r16-8-winner', dependsOn: ['r16-1', 'r16-8'] },
    { id: 'qf2', label: 'Viertelfinale 2', home: 'r16-2-winner', away: 'r16-7-winner', dependsOn: ['r16-2', 'r16-7'] },
    { id: 'qf3', label: 'Viertelfinale 3', home: 'r16-3-winner', away: 'r16-6-winner', dependsOn: ['r16-3', 'r16-6'] },
    { id: 'qf4', label: 'Viertelfinale 4', home: 'r16-4-winner', away: 'r16-5-winner', dependsOn: ['r16-4', 'r16-5'] }
  );

  // Halbfinale
  matches.push(
    { id: 'semi1', label: '1. Halbfinale', home: 'qf1-winner', away: 'qf4-winner', dependsOn: ['qf1', 'qf4'] },
    { id: 'semi2', label: '2. Halbfinale', home: 'qf2-winner', away: 'qf3-winner', dependsOn: ['qf2', 'qf3'] }
  );

  // Finale + Platz 3
  matches.push(
    { id: 'third-place', label: 'Spiel um Platz 3', home: 'semi1-loser', away: 'semi2-loser', rank: 3, dependsOn: ['semi1', 'semi2'] },
    { id: 'final', label: 'Finale', home: 'semi1-winner', away: 'semi2-winner', rank: 1, dependsOn: ['semi1', 'semi2'] }
  );

  return matches;
}

/**
 * Alle Plätze: Top 4 + zusätzliche direkte Platzierungsspiele
 * Bei 2 Gruppen: Plätze 5-8 werden ausgespielt (falls genug Teams vorhanden)
 *
 * Reihenfolge: Halbfinale → Platz 7 → Platz 5 → Platz 3 → Finale
 *
 * @param numberOfGroups - Anzahl der Gruppen
 * @param groupSizes - Optional: Tatsächliche Größe jeder Gruppe
 */
function generateAllPlaces(numberOfGroups: number, groupSizes?: GroupSizeInfo): PlayoffMatch[] {
  if (numberOfGroups === 2) {
    // Bei 2 Gruppen: Eigene Struktur mit korrekter Reihenfolge
    const matches: PlayoffMatch[] = [];

    // Determine minimum group size (for deciding which placement matches are possible)
    const minGroupSize = groupSizes
      ? Math.min(groupSizes['A'] || 2, groupSizes['B'] || 2)
      : 4; // Default to 4 if no size info (legacy behavior)

    // 1. Halbfinale (parallel möglich bei mehreren Feldern)
    matches.push(
      { id: 'semi1', label: '1. Halbfinale', home: 'group-a-2nd', away: 'group-b-1st', dependsOn: [] },
      { id: 'semi2', label: '2. Halbfinale', home: 'group-a-1st', away: 'group-b-2nd', dependsOn: [] }
    );

    // 2. Platzierungsspiele - nur wenn beide Gruppen genug Teams haben
    const placementDependencies: string[] = ['semi1', 'semi2'];

    // Platz 7/8: Nur wenn beide Gruppen mindestens 4 Teams haben
    if (minGroupSize >= 4) {
      matches.push(
        { id: 'place78-direct', label: 'Spiel um Platz 7', home: 'group-a-4th', away: 'group-b-4th', rank: [7, 8], dependsOn: ['semi1', 'semi2'] }
      );
      placementDependencies.push('place78-direct');
    }

    // Platz 5/6: Nur wenn beide Gruppen mindestens 3 Teams haben
    if (minGroupSize >= 3) {
      matches.push(
        { id: 'place56-direct', label: 'Spiel um Platz 5', home: 'group-a-3rd', away: 'group-b-3rd', rank: [5, 6], dependsOn: ['semi1', 'semi2'] }
      );
      placementDependencies.push('place56-direct');
    }

    // Platz 3: Immer möglich (Halbfinal-Verlierer)
    matches.push(
      { id: 'third-place', label: 'Spiel um Platz 3', home: 'semi1-loser', away: 'semi2-loser', rank: 3, dependsOn: ['semi1', 'semi2'] }
    );
    placementDependencies.push('third-place');

    // 3. Finale (muss nach allen Platzierungsspielen kommen)
    matches.push(
      { id: 'final', label: 'Finale', home: 'semi1-winner', away: 'semi2-winner', rank: 1, dependsOn: placementDependencies }
    );

    return matches;
  } else if (numberOfGroups >= 4) {
    // Bei 4+ Gruppen: Verwende Top-8 als Basis
    return generateTop8(numberOfGroups);
  }

  // Fallback: Standard Top-4
  return generateTop4(numberOfGroups);
}

/**
 * Hilfsfunktion: Prüft ob ein Preset Halbfinale enthält
 */
export function presetHasSemifinals(preset: FinalsPreset): boolean {
  return ['top-4', 'top-8', 'all-places'].includes(preset);
}

/**
 * Hilfsfunktion: Prüft ob ein Preset Viertelfinale enthält
 */
export function presetHasQuarterfinals(preset: FinalsPreset): boolean {
  return ['top-8', 'all-places'].includes(preset);
}

/**
 * Hilfsfunktion: Gibt die erwartete Anzahl an Finalspielen zurück
 */
export function getExpectedMatchCount(preset: FinalsPreset, numberOfGroups: number): number {
  const matches = generatePlayoffMatches(numberOfGroups, { preset });
  return matches.length;
}
