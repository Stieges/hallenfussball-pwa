/**
 * Felder, die dieses Gerät je Turnier steuert (R3-2a, Geräte-Meldung @LZ-018/@FU-068): `useFieldControl` legt hier den zuletzt
 * gelesenen Stand von `field_control_state` ab (`isMine`), die Geräte-Meldung liest ihn – auch wenn das Cockpit gerade nicht offen
 * ist (sonst gälte ein steuerndes Gerät nach 2 Minuten als still). Zustand im Modul, je Turnier (Muster `controlEpochs.ts`).
 */
import type { FieldControlInfo } from '../repositories/fieldControlRpc';

const own = new Map<string, number[]>();

/** Neuer Stand eines Turniers: nur die Felder mit `isMine`; ohne eigenes Feld fällt das Turnier heraus. */
export function noteFieldControlList(tournamentId: string, list: readonly FieldControlInfo[]): void {
  const fields = list.filter((info) => info.isMine).map((info) => info.field).sort((a, b) => a - b);
  if (fields.length === 0) {
    own.delete(tournamentId);
  } else {
    own.set(tournamentId, fields);
  }
}

export function ownFieldsByTournament(): Record<string, readonly number[]> {
  return Object.fromEntries(own);
}

/**
 * Abmelden oder Kontowechsel (R3-2b, Review #392 m1): der Feld-Stand gehört zum vorigen Konto – sonst meldete das neue Konto
 * Felder aus fremden Turnieren (42501 alle 30 s). Das Cockpit liest den Stand für das neue Konto neu.
 */
export function clearOwnFields(): void {
  own.clear();
}

/** Nur für Tests. */
export const resetOwnFieldsForTests = clearOwnFields;
