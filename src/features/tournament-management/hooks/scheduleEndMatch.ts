/**
 * Spiel beenden und Ergebnis eintragen im Spielplan (20261110_009, Variante A; @FU-112, @FU-114, @FU-115, @FU-116,
 * @FU-117, @FU-081 präzisiert): Notweg der Turnierleitung ohne Übernahme -- Abpfiff und Ergebnis in EINEM Eintrag
 * (`MatchCommands.endWithResult`, RESULT_ENTRY mit `basedOn`). Ablauf:
 *  1. nur mit Netz (@FU-117: sonst „Geht nur mit Netz“, nichts vorgemerkt -- ein verspätet gesendeter Eintrag könnte ein
 *     weiterlaufendes Spiel beenden),
 *  2. Hinweis, wenn ein anderes Gerät das Feld steuert (@FU-115, `field_control_state`), in der Rückfrage oben,
 *  3. Rückfrage mit Restzeit bzw. „Spielzeit abgelaufen“ (@FU-112/@FU-114); „Nein“ ändert nichts,
 *  4. K.-o.-Unentschieden: Strafstoßergebnis wie beim Direkteintrag (@FU-094),
 *  5. vor dem Senden erneut abgleichen: hat sich der Stand inzwischen geändert (Tor aus dem Cockpit), wird nichts
 *     gespeichert, und die Turnierleitung sieht „inzwischen von Tom geändert (jetzt 3:1)“ (@FU-116); der Server prüft
 *     `basedOn` zusätzlich (STALE_BASE),
 *  6. Review H2: mit Konto SOFORT senden, am Ausgang vorbei (`OutboxSender.sendNow`) -- scheitert das Senden, kommt
 *     „Nicht gesendet – bitte erneut versuchen“, und nichts ist vorgemerkt; eine Ablehnung des Servers wirft
 *     `MatchCommandRejectedError` (Hinweis wie bei jedem Eintrag). Gast (nur lokal, H3): ohne Netz-Prüfung, lokal bestätigt.
 *  7. Nachblick N2: Hat der Ausgang für dieses Spiel noch Einträge (Tor, Karte), werden sie zuerst gesendet und neu
 *     abgeglichen -- sonst beendete der Notweg das Spiel vor ihnen. Bleiben sie liegen: „Erst ausstehende Einträge senden –
 *     bitte gleich noch einmal“, nichts gesendet.
 *  8. Nachblick N3: Netz- oder Zeitfehler → einmal abgleichen; hat der Server schon gespeichert, gilt das Ende. Veraltete App
 *     → Update-Hinweis. Scheitert der Abgleich nach der Annahme, keine Fehlermeldung (das Spiel ist beendet).
 * Rein bis auf die übergebenen Abhängigkeiten (kein React).
 */
import { effectiveScoreFor, type ErrorCode, type MatchState } from '../../../core/match';
import { MatchCommandRejectedError, type MatchCommands, type MatchEngine, type OutboxSender } from '../../../core/match/client';
import { buildEndWithResultEvent } from '../../../core/match/client/matchCommandsEnd';
import { isClientOutdated } from '../../../core/repositories/appendMatchEventsRpc';
import type { ValidMatchEntry } from '../../../hooks/engineMatchModel';
import { endPromptRestSeconds, routeForStatus } from './scoreChangeHelpers';

/** Rückfrage „Spiel beenden und Ergebnis eintragen“ (`rest` = Restzeit „2:00“, `null` = Spielzeit abgelaufen). */
export interface EndPrompt {
  kind: 'end';
  matchNumber: number;
  score: string;
  rest: string | null;
  /** @FU-115: ein anderes Gerät steuert das Feld (Feldnummer und Halter, z. B. „Tom (Handy)“). */
  controlledBy: ControlledBy | null;
  /** @FU-081 (B-49): zusätzlich „Spielleitung übernehmen“ anbieten (Antwort `'takeover'`). */
  takeOver?: boolean;
}

/** Halter für die Anzeige: Feldnummer und Text wie `fieldHolderText` („Tom (Handy)“, ohne Namen `null`). */
export interface ControlledBy {
  field: number;
  holder: string | null;
}

export interface EndMatchInput {
  engine: Pick<MatchEngine, 'catchUp' | 'view' | 'serverNow'>;
  commands: Pick<MatchCommands, 'endWithResult'>;
  sender: Pick<OutboxSender, 'sendNow'>;
  /** Gast: nur lokal (keine Netz-Prüfung, lokal bestätigt, H3). */
  guest: boolean;
  entry: ValidMatchEntry;
  field: number | null;
  /** eingetragener Stand (Heim, Gast) -- kein Schreibweg auf Spiel-Felder (A-08e). */
  entered: { home: number; away: number };
  knockout: boolean;
  online: () => boolean;
  readHolder: (field: number) => Promise<ControlledBy | null>;
  ask: (prompt: EndPrompt) => Promise<string | null>;
  askShootout: () => Promise<Record<string, number> | null>;
  warn: (key: 'offline' | 'notSent' | 'pending' | 'outdated') => void;
  /** N2: Einträge dieses Spiels, die noch im Ausgang warten (Konto). */
  pendingCount: () => Promise<number>;
  /** N2: den Ausgang dieses Spiels jetzt senden lassen (`OutboxSender.kick`). */
  flush: () => Promise<void>;
  warnStale: (now: string) => Promise<void>;
}

/** Sekunden als `m:ss`. */
export function formatRest(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const scoreOf = (state: MatchState, entry: ValidMatchEntry): string =>
  `${effectiveScoreFor(state, entry.ctx.teamAId)}:${effectiveScoreFor(state, entry.ctx.teamBId)}`;

/** `null` = nichts gespeichert (abgebrochen, ohne Netz, inzwischen geändert); sonst die ID des Eintrags. */
export async function endMatchFromSchedule(input: EndMatchInput): Promise<string | null> {
  const { engine, entry } = input;
  const id = entry.matchId;
  if (!input.online()) {
    input.warn('offline');
    return null;
  }
  const state = engine.view(id)?.result.state;
  if (!state) {
    return null;
  }
  const basedOn = state.lastScoreEventId;
  const holder = input.field !== null ? await input.readHolder(input.field) : null;
  const restSeconds = endPromptRestSeconds(state, engine.serverNow());
  const answer = await input.ask({
    kind: 'end',
    matchNumber: entry.meta.number,
    score: `${input.entered.home}:${input.entered.away}`,
    rest: restSeconds === null ? null : formatRest(restSeconds),
    controlledBy: holder ? { field: holder.field, holder: holder.holder } : null,
  });
  if (answer === null) {
    return null; // „Nein“: Spiel läuft unverändert weiter
  }
  let shootout: Record<string, number> | undefined;
  if (input.knockout && input.entered.home === input.entered.away) {
    const answered = await input.askShootout();
    if (answered === null) {
      return null; // ohne Strafstoßergebnis nichts gespeichert (@FU-094)
    }
    shootout = answered;
  }
  if (!input.guest && (await input.pendingCount()) > 0) {
    await input.flush().catch(() => undefined);
    if ((await input.pendingCount()) > 0) {
      input.warn('pending'); // N2: nichts gesendet
      return null;
    }
  }
  await engine.catchUp(id);
  const now = engine.view(id)?.result.state;
  if (!now || routeForStatus(now.status) !== 'end' || now.lastScoreEventId !== basedOn) {
    await input.warnStale(now ? scoreOf(now, entry) : scoreOf(state, entry));
    return null;
  }
  if (!input.online()) {
    input.warn('offline');
    return null;
  }
  const scores = { [entry.ctx.teamAId]: input.entered.home, [entry.ctx.teamBId]: input.entered.away };
  if (input.guest) {
    return input.commands.endWithResult(id, entry.ctx, 'leitung', scores, shootout, input.knockout, basedOn);
  }
  return sendNow(input, scores, shootout, basedOn);
}

/** H2: sofort senden; `null` = nicht gesendet (Hinweis gezeigt, nichts vorgemerkt), Server-Ablehnung wirft. */
async function sendNow(input: EndMatchInput, scores: Record<string, number>, shootout: Record<string, number> | undefined, basedOn: string | null): Promise<string | null> {
  const { engine, entry } = input;
  const view = engine.view(entry.matchId);
  if (!view) {
    return null;
  }
  const event = buildEndWithResultEvent(view, engine.serverNow(), { ctx: entry.ctx, actor: 'leitung', scores, shootout, knockout: input.knockout, basedOn });
  let result: Awaited<ReturnType<OutboxSender['sendNow']>>;
  try {
    result = await input.sender.sendNow(entry.matchId, [event]);
  } catch {
    // N3: vielleicht hat der Server schon gespeichert (Antwort verloren) -- einmal abgleichen
    await engine.catchUp(entry.matchId).catch(() => undefined);
    if (engine.view(entry.matchId)?.result.state.accepted[event.id]) {
      return event.id;
    }
    input.warn('notSent');
    return null;
  }
  if (isClientOutdated(result)) {
    input.warn('outdated');
    return null;
  }
  const first = result.results[0];
  if (first?.status === 'rejected') {
    throw new MatchCommandRejectedError((first.code ?? 'INVALID_PAYLOAD') as ErrorCode, first.detail);
  }
  if (first?.status !== 'accepted' && first?.status !== 'duplicate') {
    input.warn('notSent');
    return null;
  }
  // N3: angenommen -- ein gescheiterter Abgleich ist kein Fehler, das Spiel ist am Server beendet
  await engine.catchUp(entry.matchId).catch(() => undefined);
  return event.id;
}
