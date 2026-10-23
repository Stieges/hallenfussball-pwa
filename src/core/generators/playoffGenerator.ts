/**
 * Playoff/Finals Generator - Preset-based System
 *
 * Generiert Finalrunden-Spiele basierend auf Presets:
 * - none: Keine Finalrunde
 * - final-only: Nur Finale (direkt)
 * - top-4: Halbfinale + Spiel um Platz 3 + Finale
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
  home: string;        // z.B. "group-a-1st", "semi1-winner", "qf2-loser"
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

  if (preset === 'none') {
    return [];
  }
  // Top 4 mit einer Gruppe (@TM-142, Vorlage „Top 4“): die einzige Vorlage ohne zweite Gruppe.
  if (numberOfGroups < 1 || (numberOfGroups < 2 && preset !== 'top-4')) {
    return [];
  }

  const matches: PlayoffMatch[] = [];
  const places = placementsOf(config, groupSizes);

  switch (preset) {
    case 'final-only':
      matches.push(...generateFinalOnly(numberOfGroups));
      break;

    case 'top-4':
      matches.push(...generateTop4(numberOfGroups, places, groupSizes));
      break;

    case 'top-8':
      matches.push(...generateTop8(numberOfGroups, places));
      break;

    case 'top-16':
      matches.push(...generateTop16(numberOfGroups, places));
      break;

    case 'all-places':
      matches.push(...generateAllPlaces(numberOfGroups, places));
      break;
  }

  return withFinalLast(matches);
}

/** Plätze, die eine Vorlage ohne eigene Auswahl ausspielt (@TM-004: „Top 4“ → 3, „Alle Plätze“ → 3, 5, 7). */
export function defaultPlacements(preset: FinalsPreset): number[] {
  switch (preset) {
    case 'all-places': return [3, 5, 7];
    case 'top-4':
    case 'top-8':
    case 'top-16': return [3];
    default: return [];
  }
}

/**
 * Ausgespielte Plätze (@TM-004). Eine eigene Auswahl (`config.placements`) gilt genau so – passt sie nicht zu den
 * Gruppengrößen, meldet das `buildFinalsTemplate` sichtbar. Die Vorbelegung der Vorlage lässt wie bisher weg, wofür
 * eine Gruppe zu klein ist: Platz 5 braucht 3, Platz 7 braucht 4 Teams in jeder Gruppe.
 */
function placementsOf(config: FinalsConfig, groupSizes?: GroupSizeInfo): ReadonlySet<number> {
  if (config.placements !== undefined) {
    return new Set(config.placements);
  }
  const minGroupSize = groupSizes ? Math.min(groupSizes['A'] || 2, groupSizes['B'] || 2) : 4;
  return new Set(defaultPlacements(config.preset).filter((place) =>
    place === 3 || (place === 5 && minGroupSize >= 3) || (place === 7 && minGroupSize >= 4)));
}

/**
 * Halbfinale plus gewählte Platzierungsspiele plus Finale (1 und 2 Gruppen). Reihenfolge nach @TM-144: Platz 7, 5, 3,
 * dann das Finale. Platz 5/7 gibt es nur bei 2 Gruppen (Dritte bzw. Vierte gegeneinander), Platz 3 = Verlierer HF1
 * gegen Verlierer HF2 (@TM-005).
 */
function semifinalsWithPlacements(semis: PlayoffMatch[], places: ReadonlySet<number>, twoGroups: boolean): PlayoffMatch[] {
  const matches = [...semis];
  const afterSemis = ['semi1', 'semi2'];
  if (twoGroups && places.has(7)) {
    matches.push({ id: 'place78-direct', label: 'Spiel um Platz 7', home: 'group-a-4th', away: 'group-b-4th', rank: [7, 8], dependsOn: afterSemis });
  }
  if (twoGroups && places.has(5)) {
    matches.push({ id: 'place56-direct', label: 'Spiel um Platz 5', home: 'group-a-3rd', away: 'group-b-3rd', rank: [5, 6], dependsOn: afterSemis });
  }
  if (places.has(3)) {
    matches.push({ id: 'third-place', label: 'Spiel um Platz 3', home: 'semi1-loser', away: 'semi2-loser', rank: 3, dependsOn: afterSemis });
  }
  // Finale zuletzt (withFinalLast, @TM-144)
  matches.push({ id: 'final', label: 'Finale', home: 'semi1-winner', away: 'semi2-winner', rank: 1, dependsOn: afterSemis });
  return matches;
}

/**
 * @TM-144: Das Finale ist das letzte Spiel des Turniers – es hängt an allen anderen Spielen der Finalrunde, damit
 * der Scheduler jedes Platzierungsspiel (Platz 7, 5, 3 …) vorher ansetzt, auch bei mehreren Feldern.
 */
function withFinalLast(matches: PlayoffMatch[]): PlayoffMatch[] {
  const others = matches.filter((m) => m.id !== 'final').map((m) => m.id);
  return matches.map((m) => (m.id === 'final' ? { ...m, dependsOn: others } : m));
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
 * Top 4: Halbfinale + gewählte Platzierungsspiele (Vorbelegung Platz 3) + Finale
 * Standard bei 2 Gruppen
 */
function generateTop4(numberOfGroups: number, places: ReadonlySet<number>, groupSizes?: GroupSizeInfo): PlayoffMatch[] {
  if (numberOfGroups === 1) {
    // @TM-142: eine Gruppe – Erster gegen Vierter, Zweiter gegen Dritter. Braucht vier Teams in der Gruppe;
    // ist die Größe bekannt und kleiner, bricht die Erzeugung sichtbar ab statt Herkünfte ins Leere zu setzen.
    const size = groupSizes?.['A'];
    if (size !== undefined && size < 4) {
      throw new Error(`Top 4 mit einer Gruppe braucht mindestens 4 Teams (Gruppe A hat ${size})`);
    }
    return semifinalsWithPlacements([
      { id: 'semi1', label: '1. Halbfinale', home: 'group-a-1st', away: 'group-a-4th', dependsOn: [] },
      { id: 'semi2', label: '2. Halbfinale', home: 'group-a-2nd', away: 'group-a-3rd', dependsOn: [] },
    ], places, false);
  }
  // Halbfinale über Kreuz (@TM-015, @TM-142, Vorlage „Top 4“): HF1 = Erster A gegen Zweiter B, HF2 = Erster B gegen
  // Zweiter A. Ab 3 Gruppen (nur noch Zähl-Helfer des Assistenten, A-12a) dieselbe Paarung.
  return semifinalsWithPlacements([
    { id: 'semi1', label: '1. Halbfinale', home: 'group-a-1st', away: 'group-b-2nd', dependsOn: [] },
    { id: 'semi2', label: '2. Halbfinale', home: 'group-b-1st', away: 'group-a-2nd', dependsOn: [] },
  ], places, numberOfGroups === 2);
}

/**
 * Top 8: Viertelfinale + Halbfinale + Finale + Platzierungen 5-8
 */
function generateTop8(numberOfGroups: number, places: ReadonlySet<number>): PlayoffMatch[] {
  const matches: PlayoffMatch[] = [];

  // Viertelfinale
  if (numberOfGroups === 2) {
    // Bei 2 Gruppen: Nur Top 4 möglich (kein echtes Top 8)
    // Verwende einfach Top 4 Logik
    return generateTop4(numberOfGroups, places);
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
    // @TM-144: aufsteigend vor dem Finale – Platz 7 vor Platz 5
    matches.push(
      { id: 'place78', label: 'Spiel um Platz 7', home: 'qf3-loser', away: 'qf4-loser', rank: [7, 8], dependsOn: ['qf3', 'qf4'] },
      { id: 'place56', label: 'Spiel um Platz 5', home: 'qf1-loser', away: 'qf2-loser', rank: [5, 6], dependsOn: ['qf1', 'qf2'] }
    );
  }

  // Platz 3, dann Finale (Finale zuletzt: withFinalLast, @TM-144)
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
function generateTop16(numberOfGroups: number, places: ReadonlySet<number>): PlayoffMatch[] {
  const matches: PlayoffMatch[] = [];

  // Bei weniger als 8 Gruppen: Fallback auf Top-8
  if (numberOfGroups < 8) {
    return generateTop8(numberOfGroups, places);
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

  // Platz 3, dann Finale (Finale zuletzt: withFinalLast, @TM-144)
  matches.push(
    { id: 'third-place', label: 'Spiel um Platz 3', home: 'semi1-loser', away: 'semi2-loser', rank: 3, dependsOn: ['semi1', 'semi2'] },
    { id: 'final', label: 'Finale', home: 'semi1-winner', away: 'semi2-winner', rank: 1, dependsOn: ['semi1', 'semi2'] }
  );

  return matches;
}

/**
 * Alle Plätze: Halbfinale + Platz 7, 5, 3 + Finale (Vorbelegung, @TM-004); bei 2 Gruppen wie „Top 4“ mit allen Plätzen.
 * Reihenfolge: Halbfinale → Platz 7 → Platz 5 → Platz 3 → Finale
 */
function generateAllPlaces(numberOfGroups: number, places: ReadonlySet<number>): PlayoffMatch[] {
  if (numberOfGroups >= 4) {
    // Bei 4+ Gruppen: Verwende Top-8 als Basis (nur noch Zähl-Helfer des Assistenten, A-12a)
    return generateTop8(numberOfGroups, places);
  }
  return generateTop4(numberOfGroups, places);
}

/** Runde eines Finalspiels (Spalte `matches.phase`). */
export type FinalsPhase = 'roundOf16' | 'quarterfinal' | 'semifinal' | 'final';

/** Runde aus der Kennung der Vorlage (`semi1`, `qf2`, `r16-3`, `third-place`, `final` …), nie aus der Spiel-ID. */
export function finalsPhaseOfTemplateId(templateId: string): FinalsPhase {
  if (templateId.startsWith('r16')) { return 'roundOf16'; }
  if (templateId.startsWith('qf')) { return 'quarterfinal'; }
  if (templateId.startsWith('semi')) { return 'semifinal'; }
  return 'final';
}

export interface LegacyFinals {
  final: boolean;
  thirdPlace: boolean;
  fifthSixth: boolean;
  seventhEighth: boolean;
}

/** Vorlage zu den alten Schaltern (`tournament.finals`) für Turniere ohne `finalsConfig`. */
export function legacyFinalsPreset(finals: LegacyFinals): FinalsConfig['preset'] {
  if (!finals.final) { return 'none'; }
  if (!finals.thirdPlace) { return 'final-only'; }
  return finals.fifthSixth || finals.seventhEighth ? 'all-places' : 'top-4';
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
