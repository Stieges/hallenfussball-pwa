/**
 * „Diese Plätze müssen bei Gleichstand ausgespielt werden“ (Paket TB-B, TB-3'; Daniel 2026-10-20, Record W2a Zone 1).
 *
 * Berührt ein Gleichstand nach allen Kriterien einen eingestellten Platz oder einen Platz, der als Gruppenplatz-Herkunft
 * in ein weiteres Spiel führt, gibt es nur das Strafstoßschießen – für den ganzen Block (Vorschlag „ganzer Block“,
 * @W2A-064). Sonst darf die Turnierleitung das Ergebnis so akzeptieren (Teams teilen den Platz, @W2A-063). Ein weiteres
 * Spiel schlägt die Einstellung. Voreinstellung nur Platz 1 (Daniel K10); angeboten werden die Plätze 1 bis zur Teamzahl
 * der größten Gruppe (@W2A-073). Bei mehreren Gruppen meint die Einstellung die Plätze in jeder Gruppe (Vorschlag).
 * Rein, ohne React.
 */
import { z } from 'zod';
import type { Match, Team, Tournament } from '../../types/tournament';
import { slotSource } from '../models/matchSlot';
import type { SlotSource } from '../models/schemas/MatchSlotSchema';
import { standingsGroups } from '../models/standingsGroups';

/** Voreinstellung: nur Platz 1 muss ausgespielt werden (Daniel K10, @W2A-066). */
export const DEFAULT_PLACEMENTS_TO_PLAY_OUT: readonly number[] = [1];

/** Schema des Turnierfelds: Liste ganzer Plätze ab 1; Unbrauchbares ergibt die Voreinstellung (Turnier bleibt gültig). */
export const PlacementsToPlayOutSchema = z.array(z.number().int().min(1)).catch(() => [...DEFAULT_PLACEMENTS_TO_PLAY_OUT]);

const sortedUnique = (places: readonly number[]): number[] => [...new Set(places)].sort((a, b) => a - b);

/** Gespeicherten Wert lesen (Cloud-`config`, lokale Kopie): fehlend oder unbrauchbar → nur Platz 1; `[]` bleibt „kein Platz“. */
export function parsePlacementsToPlayOut(raw: unknown): number[] {
  return sortedUnique(PlacementsToPlayOutSchema.parse(raw));
}

/** Angebotene Plätze: 1 bis zur Teamzahl der größten Gruppe (Jeder gegen jeden: alle Teams). */
export function offeredPlaces(teams: readonly Pick<Team, 'group'>[]): number[] {
  const largest = Math.max(0, ...standingsGroups(teams).map((g) => g.teams.length));
  return Array.from({ length: largest }, (_, i) => i + 1);
}

/** Wirksame Einstellung: gelesen und auf die angebotenen Plätze gekappt (@W2A-073, kein Fehler bei weniger Teams). */
export function effectivePlacementsToPlayOut(tournament: Pick<Tournament, 'placementsToPlayOut' | 'teams'>): number[] {
  const offered = new Set(offeredPlaces(tournament.teams));
  return parsePlacementsToPlayOut(tournament.placementsToPlayOut).filter((place) => offered.has(place));
}

function sourcesOf(match: Match): SlotSource[] {
  return [match.originA, match.originB, slotSource(match.slotA), slotSource(match.slotB)]
    .filter((s): s is SlotSource => s !== undefined);
}

/** Gruppenplätze von `groupId`, die als Herkunft in einem weiteren Spiel stehen (besetzt oder noch offen). */
export function followUpRanks(matches: readonly Match[], groupId: string): number[] {
  return sortedUnique(matches.flatMap((m) => sourcesOf(m)
    .flatMap((s) => (s.kind === 'groupRank' && s.group === groupId ? [s.rank] : []))));
}

/** Darf der Block (Plätze `place` bis `place + size − 1`) geteilt bleiben? Nur, wenn keiner davon auszuspielen ist. */
export function blockMayShare(
  places: readonly number[],
  followUps: readonly number[],
  block: { place: number; size: number },
): boolean {
  const last = block.place + block.size - 1;
  const touches = (p: number): boolean => p >= block.place && p <= last;
  return !places.some(touches) && !followUps.some(touches);
}
