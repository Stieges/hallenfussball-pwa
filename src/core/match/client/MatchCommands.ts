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
import { ERROR_CODES, type Actor, type EngineEvent, type ErrorCode, type MatchContext, type MatchRules } from '../types';
import type { MatchEngineView } from './MatchEngine';
import { CLOCK_OUT_OF_RANGE, definedFields, splitFirstTap, stampFor, timingClock } from './matchCommandStamp';
import type {
  AmendFields,
  CardOptions,
  CommandSpec,
  CommandTiming,
  FoulOptions,
  GoalOptions,
  SubstitutionOptions,
  TeamScores,
  TiebreakChoice,
  TimePenaltyOptions,
} from './matchCommandTypes';

export type { AmendFields, CardOptions, CommandTiming, FoulOptions, GoalOptions } from './matchCommandTypes';
export type { SubstitutionOptions, TeamScores, TiebreakChoice, TimePenaltyOptions } from './matchCommandTypes';

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

/**
 * Befehle liefern die ID des gespeicherten Eintrags (S4/R4), `null`, wenn nichts gespeichert
 * wurde (noop). Eine Ablehnung wirft `MatchCommandRejectedError`.
 */
export type CommandResult = Promise<string | null>;

export class MatchCommands {
  /** A-08b3 (B1, @FU-070): letzter Aufruf je Spiel -- neue Aufrufe warten darauf. */
  private readonly chains = new Map<string, Promise<void>>();

  constructor(private readonly deps: MatchCommandsDeps) {}

  start(matchId: string, ctx: MatchContext, actor: Actor, rules: MatchRules): CommandResult {
    return this.submit(matchId, ctx, actor, { type: 'MATCH_START', teamId: null, payload: { rules } });
  }

  pause(matchId: string, ctx: MatchContext, actor: Actor): CommandResult {
    return this.submit(matchId, ctx, actor, { type: 'PAUSE', teamId: null, payload: {} });
  }

  resume(matchId: string, ctx: MatchContext, actor: Actor): CommandResult {
    return this.submit(matchId, ctx, actor, { type: 'RESUME', teamId: null, payload: {} });
  }

  /** B-07: `timing` nur fuer das automatische Ende an der exakten Grenze (§ B-08b). */
  finish(matchId: string, ctx: MatchContext, actor: Actor, timing?: CommandTiming): CommandResult {
    return this.submit(matchId, ctx, actor, { type: 'MATCH_END', teamId: null, payload: {}, clock: timingClock(timing) });
  }

  /** B-07: Abschnittsende (nicht im letzten Abschnitt -> abgelehnt `{reason: 'LAST_SECTION'}`). */
  endSection(matchId: string, ctx: MatchContext, actor: Actor, timing?: CommandTiming): CommandResult {
    return this.submit(matchId, ctx, actor, { type: 'SECTION_END', teamId: null, payload: {}, clock: timingClock(timing) });
  }

  startSection(matchId: string, ctx: MatchContext, actor: Actor): CommandResult {
    return this.submit(matchId, ctx, actor, { type: 'SECTION_START', teamId: null, payload: {} });
  }

  /** B-07: Uhr auf `clockMs` stellen; `previousClockMs` bleibt in der Roh-Payload (Muster `substitution`). */
  adjustClock(matchId: string, ctx: MatchContext, actor: Actor, clockMs: number, previousClockMs: number): CommandResult {
    return this.submit(matchId, ctx, actor, {
      type: 'CLOCK_ADJUST',
      teamId: null,
      payload: { previousClockMs },
      clock: { kind: 'set', clockMs },
    });
  }

  chooseTiebreak(matchId: string, ctx: MatchContext, actor: Actor, choice: TiebreakChoice): CommandResult {
    return this.submit(matchId, ctx, actor, { type: 'TIEBREAK_CHOICE', teamId: null, payload: { choice } });
  }

  recordShot(
    matchId: string,
    ctx: MatchContext,
    actor: Actor,
    teamId: string,
    scored: boolean,
    shooterNumber?: number,
  ): CommandResult {
    return this.submit(matchId, ctx, actor, {
      type: 'SHOOTOUT_KICK',
      teamId,
      payload: definedFields({ scored, shooterNumber }),
    });
  }

  endShootout(matchId: string, ctx: MatchContext, actor: Actor): CommandResult {
    return this.submit(matchId, ctx, actor, { type: 'SHOOTOUT_END', teamId: null, payload: {} });
  }

  reopen(matchId: string, ctx: MatchContext, actor: Actor, timing?: CommandTiming): CommandResult {
    return this.submit(matchId, ctx, actor, { type: 'REOPEN', teamId: null, payload: {}, clock: timingClock(timing) });
  }

  /** B-07 (@FU-080): Ergebnis direkt eintragen; auf laufendem Spiel abgelehnt (@FU-081). */
  enterResult(matchId: string, ctx: MatchContext, actor: Actor, scores: TeamScores): CommandResult {
    return this.submit(matchId, ctx, actor, { type: 'RESULT_ENTRY', teamId: null, payload: { scores: { ...scores } } });
  }

  correct(
    matchId: string,
    ctx: MatchContext,
    actor: Actor,
    scores: TeamScores,
    reason: string,
    basedOn: string | null,
  ): CommandResult {
    return this.submit(matchId, ctx, actor, {
      type: 'CORRECTION',
      teamId: null,
      payload: { scores: { ...scores }, reason, basedOn },
    });
  }

  /** PC14: nur `+1` (Rueckgaengig/Minus -> RETRACT, `retract`, C3b-1). `own`: Eigentor (OWN_GOAL, K5/K-Regeln). */
  goal(matchId: string, ctx: MatchContext, actor: Actor, teamId: string, own: boolean, options?: GoalOptions): CommandResult {
    return this.submit(matchId, ctx, actor, { type: own ? 'OWN_GOAL' : 'GOAL', teamId, ...splitFirstTap(options) });
  }

  card(
    matchId: string,
    ctx: MatchContext,
    actor: Actor,
    teamId: string,
    cardType: 'YELLOW_CARD' | 'YELLOW_RED_CARD' | 'RED_CARD',
    options?: CardOptions,
  ): CommandResult {
    return this.submit(matchId, ctx, actor, { type: cardType, teamId, ...splitFirstTap(options) });
  }

  timePenalty(matchId: string, ctx: MatchContext, actor: Actor, teamId: string, options?: TimePenaltyOptions): CommandResult {
    return this.submit(matchId, ctx, actor, { type: 'TIME_PENALTY', teamId, ...splitFirstTap(options) });
  }

  foul(matchId: string, ctx: MatchContext, actor: Actor, teamId: string, options?: FoulOptions): CommandResult {
    return this.submit(matchId, ctx, actor, { type: 'FOUL', teamId, payload: definedFields({ ...options }) });
  }

  /** K5: `playersIn`/`playersOut` unveraendert in die Payload (Schema strippt sie bei der
   * Vorpruefung, `event.payload` selbst bleibt aber vollstaendig -- `toRuntimeEvents` liest sie
   * aus der Roh-Payload). */
  substitution(
    matchId: string,
    ctx: MatchContext,
    actor: Actor,
    teamId: string,
    options?: SubstitutionOptions,
  ): CommandResult {
    return this.submit(matchId, ctx, actor, { type: 'SUBSTITUTION', teamId, payload: definedFields({ ...options }) });
  }

  /** C3b-1: nimmt ein angenommenes Ereignis zurueck (RETRACT, `teamId` null, Ziel in `targetId`). */
  retract(matchId: string, ctx: MatchContext, actor: Actor, targetId: string): CommandResult {
    return this.submit(matchId, ctx, actor, { type: 'RETRACT', teamId: null, payload: {}, targetId });
  }

  /** C3b-1 (G10): AMEND sendet nur geaenderte Felder; `clear` nur, wenn nicht leer. */
  amend(
    matchId: string,
    ctx: MatchContext,
    actor: Actor,
    targetId: string,
    fields: AmendFields,
    clear: readonly DetailField[],
  ): CommandResult {
    const payload: Record<string, unknown> = definedFields({ ...fields });
    if (clear.length > 0) {
      payload.clear = [...clear];
    }
    return this.submit(matchId, ctx, actor, { type: 'AMEND', teamId: null, payload, targetId });
  }

  /**
   * A-08b3 (B1, @FU-070): Aufrufe je Spiel laufen nacheinander. Die Vorpruefung liest den Stand
   * erst, wenn der vorige Eintrag gespeichert und angezeigt ist -- zwei Spielenden im selben
   * Moment ergeben so genau ein `MATCH_END`. Ein Fehler eines Eintrags wird an DESSEN Aufrufer
   * geworfen, die Kette laeuft mit dem naechsten Eintrag weiter.
   */
  private submit(matchId: string, ctx: MatchContext, actor: Actor, spec: CommandSpec): CommandResult {
    const previous = this.chains.get(matchId) ?? Promise.resolve();
    const run = previous.then(() => this.submitNow(matchId, ctx, actor, spec));
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    this.chains.set(matchId, tail);
    void tail.then(() => {
      if (this.chains.get(matchId) === tail) {
        this.chains.delete(matchId);
      }
    });
    return run;
  }

  private async submitNow(matchId: string, ctx: MatchContext, actor: Actor, spec: CommandSpec): CommandResult {
    const view = this.deps.engine.view(matchId);
    if (!view) {
      throw new Error(`MatchCommands: keine lokale Kopie fuer Spiel ${matchId}`);
    }
    const stamp = stampFor(spec, view, this.deps.engine.serverNow());
    if (!stamp.ok) {
      throw new MatchCommandRejectedError(ERROR_CODES.INVALID_PAYLOAD, CLOCK_OUT_OF_RANGE);
    }
    const { at, clockMs } = stamp;
    const event: EngineEvent = {
      id: crypto.randomUUID(),
      type: spec.type,
      actor,
      at,
      section: spec.type === 'MATCH_START' ? 1 : view.result.state.section,
      clockMs,
      teamId: spec.teamId,
      targetId: spec.targetId ?? null,
      payload: spec.payload,
    };
    const result = applyEvent(view.result.state, event, ctx);
    if (result.status === 'rejected') {
      throw new MatchCommandRejectedError(result.code, result.detail);
    }
    // A-08b2 (@FU-070, R9/K8): noop ist kein Fehler, aber auch kein neuer Eintrag. Ein zweites
    // Spielende wird weder gespeichert noch gesendet (Ausgang genau ein MATCH_END).
    if (result.status === 'noop') {
      return null;
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
    return event.id;
  }
}
