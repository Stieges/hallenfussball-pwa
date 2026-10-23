/**
 * Spiel beenden (20261110_009, H2): baut den Eintrag „Abpfiff und Ergebnis“ (RESULT_ENTRY mit `basedOn`) und prüft ihn
 * lokal vor (`buildEvents`, wie `MatchCommands`), OHNE ihn zu speichern -- der Notweg sendet ihn sofort am Ausgang vorbei
 * (`OutboxSender.sendNow`), damit ohne Netz nichts vorgemerkt wird (@FU-117). Rein (kein Store, kein Sender).
 */
import type { Actor, EngineEvent, MatchContext } from '../types';
import { resultEntryCommand } from '../resultEntryShootout';
import type { MatchEngineView } from './MatchEngine';
import { MatchCommandRejectedError } from './MatchCommands';
import { buildEvents } from './matchCommandsSkip';
import type { TeamScores } from './matchCommandTypes';

export interface EndWithResultInput {
  ctx: MatchContext;
  actor: Actor;
  scores: TeamScores;
  shootout: TeamScores | undefined;
  knockout: boolean;
  basedOn: string | null;
}

/** Der geprüfte Eintrag; eine lokale Ablehnung wirft `MatchCommandRejectedError` (nichts gespeichert). */
export function buildEndWithResultEvent(view: MatchEngineView, serverNow: number, input: EndWithResultInput): EngineEvent {
  const command = resultEntryCommand(input.knockout, input.scores, input.shootout);
  if (!command.ok) {
    throw new MatchCommandRejectedError(command.code, command.detail);
  }
  const spec = { ...command.spec, payload: { ...command.spec.payload, basedOn: input.basedOn } };
  const built = buildEvents(view, serverNow, input.ctx, input.actor, [spec]);
  if (!built.ok) {
    throw new MatchCommandRejectedError(built.code, built.detail);
  }
  const [event] = built.events;
  if (!event) {
    throw new MatchCommandRejectedError('INVALID_TRANSITION');
  }
  return event;
}
