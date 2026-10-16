/**
 * Angaben je Ereignis (C0a, V1): Torschütze, Spieler-ID, Vorlagen, Schütze im Strafstoßschießen,
 * „unvollständig“. Sie stehen in `state.details[eventId]`, werden bei der Annahme eines
 * Zielereignisses aus dessen Payload befüllt und per AMEND fortgeschrieben (handlers/amend.ts).
 * Nicht im serverState -- der SQL-Zwilling führt dieselbe Struktur, der Gleichlauf vergleicht sie.
 *
 * @see .superpowers/sdd/2026-09-26-pr-c-ausgang/task-C0a-brief.md Abschnitte 1-2
 */
import type { EngineEvent, EventType } from './types';

export interface EventDetails {
  playerNumber?: number;
  playerId?: string;
  assists?: number[];
  shooterNumber?: number;
  incomplete?: boolean;
}

export type DetailField = keyof EventDetails;

/** Alle Angabe-Felder in fester Reihenfolge (auch die erlaubten Namen in `AMEND.payload.clear`). */
export const DETAIL_FIELDS: readonly DetailField[] = ['playerNumber', 'playerId', 'assists', 'shooterNumber', 'incomplete'];

/** Zielereignisse, die Angaben tragen und per AMEND ergänzt werden dürfen. */
export const AMENDABLE_EVENT_TYPES: ReadonlySet<EventType> = new Set([
  'GOAL',
  'OWN_GOAL',
  'YELLOW_CARD',
  'YELLOW_RED_CARD',
  'RED_CARD',
  'TIME_PENALTY',
  'FOUL',
  'SUBSTITUTION',
  'SHOOTOUT_KICK',
]);

const SHOOTOUT_FIELDS: ReadonlySet<DetailField> = new Set(['shooterNumber', 'incomplete']);
const PLAYER_FIELDS: ReadonlySet<DetailField> = new Set(['playerNumber', 'playerId', 'assists', 'incomplete']);

/** Feld-Zulässigkeit je Zieltyp: `shooterNumber` nur am Schuss, Spieler-Felder nur an den übrigen. */
export function allowedDetailFields(targetType: EventType): ReadonlySet<DetailField> {
  return targetType === 'SHOOTOUT_KICK' ? SHOOTOUT_FIELDS : PLAYER_FIELDS;
}

/**
 * Angaben aus der (bereits gültigen) Payload eines Zielereignisses: nur die für den Typ zulässigen,
 * gesetzten Felder, fehlende nicht als `null`. Ohne Felder `{}`.
 */
export function detailsFromPayload(event: EngineEvent): EventDetails {
  const allowed = allowedDetailFields(event.type);
  const details: Record<string, unknown> = {};
  for (const field of DETAIL_FIELDS) {
    if (allowed.has(field) && Object.hasOwn(event.payload, field) && event.payload[field] !== undefined) {
      details[field] = event.payload[field];
    }
  }
  return details;
}

/** „Leer“ (Nachtrag-Regel): Schlüssel fehlt oder `null`, bei `assists` auch `[]`. */
export function isDetailEmpty(value: unknown, field: DetailField): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  return field === 'assists' && Array.isArray(value) && value.length === 0;
}

/** Exakt derselbe Wert (Zahl/Text/Wahrheitswert; `assists` elementweise in Reihenfolge). */
export function isSameDetailValue(current: unknown, next: unknown): boolean {
  if (Array.isArray(current) && Array.isArray(next)) {
    return current.length === next.length && current.every((entry, index) => entry === next[index]);
  }
  return current === next;
}
