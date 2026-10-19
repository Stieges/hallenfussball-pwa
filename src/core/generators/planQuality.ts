/**
 * Kennzahlen eines Gruppenspielplans für die Auswahl zwischen Rundenplan und Plan ohne Rundenplan-Vorschlag
 * (@W4-032, @W4-037, @W4-039) und die Meldung kürzerer Abstände als im DFB-Schlüssel (@W4-039).
 */
import type { Match } from '../../types/tournament';
import { matchTeamIds, requireTeamId } from '../models/matchSlot';
import { measureVariant } from './scheduleVariants';
import type { ScheduleNotice } from './scheduleTypes';

export interface PlanQuality {
  slotCount: number;
  /** Größter Abstand zweier eigener Spiele in Zeitfenstern. */
  longestGap: number;
  /** Kleinster Abstand zweier eigener Spiele in Zeitfenstern. */
  shortestGap: number;
  /** Größter Unterschied gespielter Spiele zwischen zwei Teams nach irgendeinem Spiel. */
  playedDiff: number;
  /** Längste Serie gleicher Seite (Heim oder Gast) eines Teams. */
  sideStreak: number;
  /** Spreizung der mittleren Abstände (wie in der Variantenauswahl). */
  spread: number;
}

/** Spiele in Spielnummer-Reihenfolge (Zeitfenster, dann Feld). */
export function inPlayOrder(matches: readonly Match[]): Match[] {
  return [...matches].sort((a, b) => (a.slot ?? a.round - 1) - (b.slot ?? b.round - 1) || a.field - b.field);
}

function slotOf(match: Match): number {
  return match.slot ?? match.round - 1;
}

export function measurePlanQuality(matches: readonly Match[]): PlanQuality {
  const ordered = inPlayOrder(matches);
  const played = new Map<string, number>();
  const lastSlot = new Map<string, number>();
  const lastSide = new Map<string, { home: boolean; run: number }>();
  for (const match of ordered) {
    for (const id of matchTeamIds(match)) { played.set(id, 0); }
  }
  let playedDiff = 0;
  let shortestGap = Number.POSITIVE_INFINITY;
  let sideStreak = 0;
  for (const match of ordered) {
    const sides: Array<[string, boolean]> = [[requireTeamId(match.slotA), true], [requireTeamId(match.slotB), false]];
    for (const [id, home] of sides) {
      played.set(id, (played.get(id) ?? 0) + 1);
      const previous = lastSlot.get(id);
      if (previous !== undefined) { shortestGap = Math.min(shortestGap, slotOf(match) - previous); }
      lastSlot.set(id, slotOf(match));
      const side = lastSide.get(id);
      const run = side?.home === home ? side.run + 1 : 1;
      lastSide.set(id, { home, run });
      sideStreak = Math.max(sideStreak, run);
    }
    const counts = [...played.values()];
    playedDiff = Math.max(playedDiff, Math.max(...counts) - Math.min(...counts));
  }
  const variant = measureVariant(0, [...matches]);
  return {
    slotCount: variant.slotCount,
    longestGap: variant.longestGap,
    shortestGap: Number.isFinite(shortestGap) ? shortestGap : 0,
    playedDiff,
    sideStreak,
    spread: variant.spread,
  };
}

/**
 * Stellen, an denen zwischen zwei Spielen eines Teams weniger Spiele liegen als im DFB-Schlüssel (1 Feld).
 * `matchNumber` = Spielnummer (1-basiert, Gruppenphase) des späteren Spiels.
 */
export function dfbShortfallNotices(matches: readonly Match[], required: number): ScheduleNotice[] {
  const notices: ScheduleNotice[] = [];
  const lastIndex = new Map<string, number>();
  inPlayOrder(matches).forEach((match, index) => {
    for (const id of matchTeamIds(match)) {
      const previous = lastIndex.get(id);
      if (previous !== undefined && index - previous - 1 < required) {
        notices.push({ kind: 'dfbGapShortfall', teamId: id, matchNumber: index + 1, gamesBetween: index - previous - 1, required });
      }
      lastIndex.set(id, index);
    }
  });
  return notices;
}
