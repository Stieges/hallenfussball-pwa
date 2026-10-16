/**
 * Auswahl der Spielplan-Varianten des Gruppengenerators (B-42, @W4-023, @W4-024).
 *
 * Der Generator rechnet mehrere Varianten, die sich nur bei Gleichstaenden
 * unterscheiden (Seed 0 = bisheriges Verhalten). Diese Datei bewertet die
 * Varianten und waehlt die beste. Kriterien in dieser Reihenfolge:
 *   1. wenigste Zeitfenster (bis zum letzten Spiel, inkl. leerer Fenster)
 *   2. kuerzeste laengste Einzelpause eines Teams
 *   3. kleinste Spreizung der mittleren Pausen
 *   4. kleinster Seed
 * Kein Math.random: gleiche Eingabe ergibt immer den gleichen Plan.
 */

import type { Match } from '../../types/tournament';
import { matchTeamIds } from '../models/matchSlot';

export interface VariantMetrics {
  seed: number;
  /** Zeitfenster bis zum letzten Spiel (leere Fenster dazwischen zaehlen mit). */
  slotCount: number;
  /** Groesster Abstand (in Zeitfenstern) zwischen zwei aufeinanderfolgenden Spielen eines Teams. */
  longestGap: number;
  /** Max minus min der mittleren Abstaende je Team (Teams mit mindestens zwei Spielen). */
  spread: number;
}

/** Obergrenze der Varianten (B-42: beste von 50). */
export const MAX_TIE_BREAK_VARIANTS = 50;

/**
 * Arbeitsbudget in Rechenschritten (siehe variantWorkUnits). Gemessen auf dem Entwicklungsrechner
 * ca. 4e-5 ms je Einheit. 4e6 Einheiten bleiben damit unter ca. 160 ms je Variantenlauf-Budget.
 * Kleine Plaene (MVP-Bereich) bekommen alle 50 Varianten, grosse weniger.
 */
export const VARIANT_WORK_BUDGET = 4_000_000;

/**
 * Grobe Arbeitsschaetzung eines Laufs: Die Greedy-Schleife geht ueber alle Zeitfenster (ca.
 * Paarungen / Felder), je Fenster ueber alle Paarungen, und jede Bewertung kostet ca. Teams.
 * Die Paarungen gehen also ungefaehr quadratisch ein, bei einem Feld besonders stark.
 */
export function variantWorkUnits(pairingCount: number, teamCount: number, fieldCount: number): number {
  const slotEstimate = Math.ceil(pairingCount / Math.max(1, fieldCount));
  return Math.max(1, pairingCount * slotEstimate * teamCount);
}

/**
 * Anzahl der Gleichstands-Varianten fuer einen Plan dieser Groesse (mindestens 1).
 */
export function variantCountFor(pairingCount: number, teamCount: number, fieldCount: number): number {
  const units = variantWorkUnits(pairingCount, teamCount, fieldCount);
  return Math.max(1, Math.min(MAX_TIE_BREAK_VARIANTS, Math.floor(VARIANT_WORK_BUDGET / units)));
}

/**
 * Misst eine Variante anhand ihrer Spiele.
 */
export function measureVariant(seed: number, matches: Match[]): VariantMetrics {
  const slotsByTeam = new Map<string, number[]>();
  let slotCount = 0;

  for (const match of matches) {
    const slot = match.slot ?? match.round - 1;
    slotCount = Math.max(slotCount, slot + 1);
    for (const teamId of matchTeamIds(match)) {
      const slots = slotsByTeam.get(teamId) ?? [];
      slots.push(slot);
      slotsByTeam.set(teamId, slots);
    }
  }

  let longestGap = 0;
  const averageGaps: number[] = [];

  slotsByTeam.forEach((slots) => {
    slots.sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < slots.length; i++) {
      gaps.push(slots[i] - slots[i - 1]);
    }
    if (gaps.length === 0) { return; }
    longestGap = Math.max(longestGap, ...gaps);
    averageGaps.push(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length);
  });

  const spread = averageGaps.length > 0
    ? Math.max(...averageGaps) - Math.min(...averageGaps)
    : 0;

  return { seed, slotCount, longestGap, spread };
}

/**
 * True, wenn Variante a besser ist als Variante b (strenge Ordnung, Seed als letzter Tiebreak).
 */
export function isBetterVariant(a: VariantMetrics, b: VariantMetrics): boolean {
  if (a.slotCount !== b.slotCount) { return a.slotCount < b.slotCount; }
  if (a.longestGap !== b.longestGap) { return a.longestGap < b.longestGap; }
  if (a.spread !== b.spread) { return a.spread < b.spread; }
  return a.seed < b.seed;
}

/**
 * Untergrenze gegenueber Seed 0 (heute): Eine Variante mit laengerer Einzelpause
 * als heute scheidet aus, auch wenn sie weniger Zeitfenster braucht. So ist das
 * Ergebnis bei Zeitfenstern und laengster Pause nie schlechter als heute (@W4-023).
 */
export function isWithinBaseline(metrics: VariantMetrics, baseline: VariantMetrics): boolean {
  return metrics.longestGap <= baseline.longestGap;
}

/**
 * Gleichstands-Schluessel je Paarung. Seed 0 nimmt die Paarungs-Reihenfolge
 * (heutiges Verhalten). Seed > 0 zieht einen festen Pseudozufallswert je Paarung
 * (mulberry32), damit jede Variante eine andere Gleichstands-Wahl trifft.
 */
export function createTieBreakKeys(count: number, seed: number): number[] {
  if (seed === 0) {
    return Array.from({ length: count }, (_, index) => index);
  }
  const next = mulberry32(seed);
  return Array.from({ length: count }, () => next());
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
