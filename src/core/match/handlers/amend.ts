/**
 * AMEND (C0a, D-C4/D-C6, V1): ergänzt oder ändert die Angaben eines angenommenen Ereignisses.
 * Wirkt nur auf `state.details[targetId]` -- Stand, `nextSeq`, `lastScoreEventId` und `decidedBy`
 * bleiben unverändert.
 *
 * Prüfreihenfolge (verbindlich, C0b spiegelt): 1 Payload und 2 Übergangszeile und 3 Akteur prüft
 * applyEvent; hier 4 UNKNOWN_TARGET -> 5 Zieltyp und Feld-Zulässigkeit (INVALID_PAYLOAD) ->
 * 6 ALREADY_RETRACTED -> 7 Nachtrag-Regel (FORBIDDEN_ACTOR).
 */
import {
  AMENDABLE_EVENT_TYPES,
  DETAIL_FIELDS,
  allowedDetailFields,
  isDetailEmpty,
  isSameDetailValue,
  type DetailField,
  type EventDetails,
} from '../details';
import { ERROR_CODES, type EngineEvent, type ErrorCode, type MatchState } from '../types';

export type AmendOutcome = { status: 'ok'; state: MatchState } | { status: 'rejected'; code: ErrorCode };

interface AmendPayload extends EventDetails {
  clear?: DetailField[];
}

function setFieldsOf(payload: AmendPayload): DetailField[] {
  return DETAIL_FIELDS.filter((field) => payload[field] !== undefined);
}

/**
 * Nachtrag-Regel (D-C6) für einen Helfer in `finished`: jedes gesetzte Feld muss am Ziel leer sein
 * oder exakt denselben Wert haben; ein nicht-leeres `clear` ist verboten.
 */
function isHelperAddendumAllowed(current: EventDetails, payload: AmendPayload, setFields: readonly DetailField[]): boolean {
  if ((payload.clear ?? []).length > 0) {
    return false;
  }
  return setFields.every(
    (field) => isDetailEmpty(current[field], field) || isSameDetailValue(current[field], payload[field]),
  );
}

export function applyAmend(state: MatchState, event: EngineEvent): AmendOutcome {
  // targetId ist durch isPayloadValid() als Pflichtfeld geprüft; nur eigene Schlüssel (M1).
  const targetId = event.targetId ?? '';
  const target = Object.hasOwn(state.accepted, targetId) ? state.accepted[targetId] : undefined;
  if (!target) {
    return { status: 'rejected', code: ERROR_CODES.UNKNOWN_TARGET };
  }

  const payload = event.payload as AmendPayload;
  const setFields = setFieldsOf(payload);
  const clear = payload.clear ?? [];
  const allowed = allowedDetailFields(target.type);
  if (!AMENDABLE_EVENT_TYPES.has(target.type) || ![...setFields, ...clear].every((field) => allowed.has(field))) {
    return { status: 'rejected', code: ERROR_CODES.INVALID_PAYLOAD };
  }

  if (state.retracted.includes(targetId)) {
    return { status: 'rejected', code: ERROR_CODES.ALREADY_RETRACTED };
  }

  const current: EventDetails = Object.hasOwn(state.details, targetId) ? state.details[targetId] : {};
  if (state.status === 'finished' && event.actor === 'helper' && !isHelperAddendumAllowed(current, payload, setFields)) {
    return { status: 'rejected', code: ERROR_CODES.FORBIDDEN_ACTOR };
  }

  // Merge: gesetzte Felder überschreiben, `clear` entfernt Schlüssel, der Rest bleibt.
  const merged: Record<string, unknown> = {};
  for (const field of DETAIL_FIELDS) {
    const value = setFields.includes(field) ? payload[field] : current[field];
    if (!clear.includes(field) && value !== undefined) {
      merged[field] = value;
    }
  }
  return { status: 'ok', state: { ...state, details: { ...state.details, [targetId]: merged } } };
}
