/**
 * MatchCommands (C3a-2a, RC1/2.1): baut `EngineEvent`s fuer die PC14-Aktionen (Anpfiff, Pause/
 * Weiter, Tor, Karten, Zeitstrafe, Foul, Wechsel, Abpfiff), prueft **lokal vor** (`applyEvent`
 * gegen die aktuelle Ansicht -- ungueltig -> `MatchCommandRejectedError`, nichts gespeichert),
 * schreibt **zuerst** in den Store (`addPending`, Gast: `addConfirmedLocal`) und **dann**
 * `sender.kick(matchId)`. `LocalStoreFullError` (aus `store.addPending`) laeuft ungefangen durch
 * (typisiert, W6 faengt sie im Hook).
 *
 * Framework-frei (LAYERING core/hooks) -- Akteursklasse (Rollenaufloesung, V6/K1) und Regeln
 * (`serverRules`) bestimmt die aufrufende Seite (Hook) und uebergibt sie hier nur.
 *
 * @see .superpowers/sdd/2026-09-26-pr-c-ausgang/task-C3a-brief.md (v2 Nachtrag, 2.1)
 */
import { applyEvent } from '../applyEvent';
import type { DetailField } from '../details';
import { elapsedAt } from '../penalties';
import type { Actor, EngineEvent, ErrorCode, EventType, MatchContext, MatchRules } from '../types';
import type { MatchEngineView } from './MatchEngine';

export interface MatchCommandsEngine {
  view(matchId: string): MatchEngineView | null;
  serverNow(): number;
  /** m7/RC1: Store wurde extern beschrieben -- Kopie neu einlesen + Aufrufer benachrichtigen. */
  notifyStoreChange(matchId: string): Promise<void>;
}

export interface MatchCommandsStore {
  addPending(accountId: string, matchId: string, event: EngineEvent): Promise<void>;
  addConfirmedLocal(accountId: string, matchId: string, event: EngineEvent): Promise<void>;
}

export interface MatchCommandsSender {
  kick(matchId?: string): Promise<void>;
}

export interface MatchCommandsDeps {
  engine: MatchCommandsEngine;
  store: MatchCommandsStore;
  sender: MatchCommandsSender;
  /** V14: Gast (`'guest'`) schreibt sofort `confirmed`, kein Sender. */
  accountId: string;
}

/** RC1: die lokale Vorpruefung (`applyEvent`) hat das Ereignis abgelehnt -- nichts gespeichert. */
export class MatchCommandRejectedError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly detail?: unknown,
  ) {
    super(`Lokale Vorpruefung: Ereignis nicht zulaessig (${code})`);
    this.name = 'MatchCommandRejectedError';
  }
}

export interface GoalOptions {
  playerNumber?: number;
  assists?: number[];
}

export interface CardOptions {
  playerNumber?: number;
}

export interface TimePenaltyOptions {
  playerNumber?: number;
  durationSeconds?: number;
}

/** C3b-1 (G10): geaenderte Angaben eines Ereignisses (AMEND) -- nur `playerNumber`. */
export interface AmendFields {
  playerNumber?: number;
}

export interface FoulOptions {
  playerNumber?: number;
}

export interface SubstitutionOptions {
  playersIn?: number[];
  playersOut?: number[];
}

function definedFields<T extends Record<string, unknown>>(fields: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(fields) as (keyof T)[]) {
    if (fields[key] !== undefined) {
      result[key] = fields[key];
    }
  }
  return result;
}

export class MatchCommands {
  constructor(private readonly deps: MatchCommandsDeps) {}

  async start(matchId: string, ctx: MatchContext, actor: Actor, rules: MatchRules): Promise<void> {
    await this.submit(matchId, ctx, actor, 'MATCH_START', null, { rules });
  }

  async pause(matchId: string, ctx: MatchContext, actor: Actor): Promise<void> {
    await this.submit(matchId, ctx, actor, 'PAUSE', null, {});
  }

  async resume(matchId: string, ctx: MatchContext, actor: Actor): Promise<void> {
    await this.submit(matchId, ctx, actor, 'RESUME', null, {});
  }

  async finish(matchId: string, ctx: MatchContext, actor: Actor): Promise<void> {
    await this.submit(matchId, ctx, actor, 'MATCH_END', null, {});
  }

  /** PC14: nur `+1` (Rueckgaengig/Minus -> RETRACT, `retract`, C3b-1). `own`: Eigentor (OWN_GOAL, K5/K-Regeln). */
  async goal(
    matchId: string,
    ctx: MatchContext,
    actor: Actor,
    teamId: string,
    own: boolean,
    options?: GoalOptions,
  ): Promise<void> {
    await this.submit(matchId, ctx, actor, own ? 'OWN_GOAL' : 'GOAL', teamId, definedFields({ ...options }));
  }

  async card(
    matchId: string,
    ctx: MatchContext,
    actor: Actor,
    teamId: string,
    cardType: 'YELLOW_CARD' | 'YELLOW_RED_CARD' | 'RED_CARD',
    options?: CardOptions,
  ): Promise<void> {
    await this.submit(matchId, ctx, actor, cardType, teamId, definedFields({ ...options }));
  }

  async timePenalty(
    matchId: string,
    ctx: MatchContext,
    actor: Actor,
    teamId: string,
    options?: TimePenaltyOptions,
  ): Promise<void> {
    await this.submit(matchId, ctx, actor, 'TIME_PENALTY', teamId, definedFields({ ...options }));
  }

  async foul(matchId: string, ctx: MatchContext, actor: Actor, teamId: string, options?: FoulOptions): Promise<void> {
    await this.submit(matchId, ctx, actor, 'FOUL', teamId, definedFields({ ...options }));
  }

  /** K5: `playersIn`/`playersOut` unveraendert in die Payload (Schema strippt sie bei der
   * Vorpruefung, `event.payload` selbst bleibt aber vollstaendig -- `toRuntimeEvents` liest sie
   * aus der Roh-Payload). */
  async substitution(
    matchId: string,
    ctx: MatchContext,
    actor: Actor,
    teamId: string,
    options?: SubstitutionOptions,
  ): Promise<void> {
    await this.submit(matchId, ctx, actor, 'SUBSTITUTION', teamId, definedFields({ ...options }));
  }

  /** C3b-1: nimmt ein angenommenes Ereignis zurueck (RETRACT, `teamId` null, Ziel in `targetId`). */
  async retract(matchId: string, ctx: MatchContext, actor: Actor, targetId: string): Promise<void> {
    await this.submit(matchId, ctx, actor, 'RETRACT', null, {}, targetId);
  }

  /** C3b-1 (G10): AMEND sendet nur geaenderte Felder; `clear` nur, wenn nicht leer. */
  async amend(
    matchId: string,
    ctx: MatchContext,
    actor: Actor,
    targetId: string,
    fields: AmendFields,
    clear: readonly DetailField[],
  ): Promise<void> {
    const payload: Record<string, unknown> = definedFields({ ...fields });
    if (clear.length > 0) {
      payload.clear = [...clear];
    }
    await this.submit(matchId, ctx, actor, 'AMEND', null, payload, targetId);
  }

  private async submit(
    matchId: string,
    ctx: MatchContext,
    actor: Actor,
    type: EventType,
    teamId: string | null,
    payload: Record<string, unknown>,
    targetId: string | null = null,
  ): Promise<void> {
    const view = this.deps.engine.view(matchId);
    if (!view) {
      throw new Error(`MatchCommands: keine lokale Kopie fuer Spiel ${matchId}`);
    }
    const at = this.deps.engine.serverNow();
    const isStart = type === 'MATCH_START';
    // K4: MATCH_START steht immer am Anfang (section 1, clockMs 0); sonst aus der aktuellen Ansicht.
    const event: EngineEvent = {
      id: crypto.randomUUID(),
      type,
      actor,
      at,
      section: isStart ? 1 : view.result.state.section,
      clockMs: isStart ? 0 : elapsedAt(view.result.state.clock, at),
      teamId,
      targetId,
      payload,
    };
    const result = applyEvent(view.result.state, event, ctx);
    if (result.status === 'rejected') {
      throw new MatchCommandRejectedError(result.code, result.detail);
    }
    // RC1: zuerst der Ausgang (Store), erst danach die Anzeige (notifyStoreChange) -- ein
    // Store-Fehler (z. B. `LocalStoreFullError`) darf hier durchlaufen, OHNE dass
    // notifyStoreChange/kick noch ausgefuehrt werden.
    const accountId = this.deps.accountId;
    if (accountId === 'guest') {
      await this.deps.store.addConfirmedLocal(accountId, matchId, event);
    } else {
      await this.deps.store.addPending(accountId, matchId, event);
    }
    await this.deps.engine.notifyStoreChange(matchId);
    if (accountId !== 'guest') {
      // Minor (Review Fixrunde 1): `.catch` statt nacktem `void` -- ein Fehler hier (z. B. IDB-
      // Lesefehler in OutboxSender.refresh()) darf keine unbehandelte Ablehnung werden. Das
      // Ereignis ist bereits gespeichert (Store-Schreibzugriff oben lief durch), ein spaeterer
      // `kick()`/`start()` sendet es nach.
      this.deps.sender.kick(matchId).catch(() => undefined);
    }
  }
}
