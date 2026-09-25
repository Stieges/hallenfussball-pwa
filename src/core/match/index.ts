/**
 * Barrel-Export der reinen Spiel-Rechenfunktion (B1a). Die App bindet dies
 * erst in PR C ein -- dieser Export existiert für B3a (SQL-Zwilling, dieselben
 * Fixtures) und zukünftige Konsumenten.
 */
export * from './types';
export { isPayloadValid, PAYLOAD_SCHEMAS } from './payloadValidation';
export { applyEvent, initialState } from './applyEvent';
export {
  reduceMatch,
  continueLog,
  applyBatch,
  isSameEventContent,
  type EventResult,
  type ReduceResult,
} from './reduceMatch';
export { toServerState, type ServerMatchState } from './serverState';
export { transitions, findTransition, isActorAllowed, type TransitionRow } from './transitions';
