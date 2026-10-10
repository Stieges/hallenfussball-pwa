/**
 * Altformat-Erkennung (A-05, MVP-Bauplan Spur A; Anforderung @FU-007).
 *
 * Seit A-04b sind `slotA`/`slotB` am Spiel Pflicht. Ein lokal gespeichertes Turnier, dessen Spiel
 * sie nicht traegt, stammt aus der Zeit vor der Team-Referenz und wird nicht gelesen, sondern
 * beiseitegelegt (`core/storage/legacyTournamentStore.ts`).
 *
 * Erkennungsmerkmal ist das FEHLEN der Slots – NICHT der Schluessel `teamA`: den tragen bis B-35
 * alle gueltigen Spiele als Uebergangsfeld (`transitionalSides` in `matchSlot.ts`).
 * Framework-frei.
 */
import { MatchSlotSchema } from './schemas/MatchSlotSchema';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasValidSlots(match: unknown): boolean {
  return isRecord(match) && MatchSlotSchema.safeParse(match.slotA).success && MatchSlotSchema.safeParse(match.slotB).success;
}

/**
 * Altformat: das Turnier hat eine Spieleliste, und mindestens ein Spiel traegt keinen gueltigen
 * `slotA`/`slotB`. Ein Entwurf ohne Spiele ist kein Altformat.
 */
export function isLegacyTournamentShape(raw: unknown): boolean {
  if (!isRecord(raw) || !Array.isArray(raw.matches)) {
    return false;
  }
  return raw.matches.some((match) => !hasValidSlots(match));
}
