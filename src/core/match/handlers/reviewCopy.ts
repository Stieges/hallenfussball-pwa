/**
 * A-35 Klärungsliste (@FU-095, @FU-116, @FU-038): ein Eintrag, den die Turnierleitung aus der Klärungsliste
 * übernimmt, legt der Server als Kopie an -- gleicher Typ, gleiche Angaben, `targetId` = der Klärungseintrag.
 * Eine solche Kopie zählt auch in einem beendeten Spiel (sonst ginge „Übernehmen“ nach dem Abpfiff nie), aber nur:
 * - für die Turnierleitung (der Server schreibt die Kopie immer mit Akteur `leitung`; ein Gerät kann keine Kopie
 *   senden, denn der Umschlag lässt `targetId` nur bei RETRACT/AMEND/REVIEW_* zu),
 * - in einem angepfiffenen Spiel (Regeln bekannt, sonst `NOT_STARTED`),
 * - in einem Gruppenspiel (im K.-o.-Spiel könnte sich der Sieger drehen -- `KNOCKOUT_FINISHED`, @FU-052 ist MVP+).
 * In allen anderen Zuständen gilt die Übergangstabelle wie für jeden Eintrag.
 * SQL-Zwilling: `public.match_apply_event` (Migration 20261117_005_klaerungsliste.sql, Schritt 3a).
 */
import { ERROR_CODES, type EngineEvent, type EventType, type MatchState } from '../types';
import type { TransitionRow } from '../transitions';

/** Eintragsarten, die aus der Klärungsliste übernommen werden können (Spielstand, Karten, Strafen, Fouls, Wechsel). */
export const REVIEW_COPY_TYPES: ReadonlySet<EventType> = new Set<EventType>([
  'GOAL',
  'OWN_GOAL',
  'YELLOW_CARD',
  'YELLOW_RED_CARD',
  'RED_CARD',
  'TIME_PENALTY',
  'FOUL',
  'SUBSTITUTION',
]);

export type ReviewCopyCheck =
  | { status: 'row'; row: TransitionRow }
  | { status: 'rejected'; code: typeof ERROR_CODES.INVALID_TRANSITION; detail: { reason: 'NOT_STARTED' | 'KNOCKOUT_FINISHED' } };

/**
 * `undefined` = keine Kopie in ein beendetes Spiel -- die Übergangstabelle entscheidet wie bisher (auch ein Helfer mit
 * `targetId` bekommt dort MATCH_FINISHED). Sonst die gedachte Übergangszeile `finished -> =` oder die Ablehnung.
 */
export function finishedReviewCopy(state: MatchState, event: EngineEvent): ReviewCopyCheck | undefined {
  if (state.status !== 'finished' || !REVIEW_COPY_TYPES.has(event.type) || !event.targetId || event.actor !== 'leitung') {
    return undefined;
  }
  if (state.rules === null) {
    return { status: 'rejected', code: ERROR_CODES.INVALID_TRANSITION, detail: { reason: 'NOT_STARTED' } };
  }
  if (state.rules.knockout) {
    return { status: 'rejected', code: ERROR_CODES.INVALID_TRANSITION, detail: { reason: 'KNOCKOUT_FINISHED' } };
  }
  return { status: 'row', row: { from: 'finished', type: event.type, actor: 'leitung', to: '=' } };
}
