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
 *     `basedOn` zusätzlich (STALE_BASE).
 * Rein bis auf die übergebenen Abhängigkeiten (kein React).
 */
import { effectiveScoreFor, type MatchState } from '../../../core/match';
import type { MatchCommands } from '../../../core/match/client';
import type { ValidMatchEntry } from '../../../hooks/engineMatchModel';
import type { FieldHolder } from '../../../core/repositories/fieldControlStateRpc';
import { endPromptRestSeconds, routeForStatus } from './scoreChangeHelpers';

/** Rückfrage „Spiel beenden und Ergebnis eintragen“ (`rest` = Restzeit „2:00“, `null` = Spielzeit abgelaufen). */
export interface EndPrompt {
  kind: 'end';
  matchNumber: number;
  score: string;
  rest: string | null;
  /** @FU-115: ein anderes Gerät steuert das Feld (Feldnummer und Halter, z. B. „Tom (Handy)“). */
  controlledBy: { field: number; holder: string | null } | null;
}

export interface EndMatchEngine {
  catchUp(matchId: string): Promise<unknown>;
  view(matchId: string): { result: { state: MatchState } } | null;
  serverNow(): number;
}

export interface EndMatchInput {
  engine: EndMatchEngine;
  commands: Pick<MatchCommands, 'endWithResult'>;
  entry: ValidMatchEntry;
  field: number | null;
  scoreA: number;
  scoreB: number;
  knockout: boolean;
  online: () => boolean;
  readHolder: (field: number) => Promise<FieldHolder | null>;
  ask: (prompt: EndPrompt) => Promise<string | null>;
  askShootout: () => Promise<Record<string, number> | null>;
  warn: (key: 'offline') => void;
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
    score: `${input.scoreA}:${input.scoreB}`,
    rest: restSeconds === null ? null : formatRest(restSeconds),
    controlledBy: holder ? { field: holder.field, holder: holder.holder } : null,
  });
  if (answer === null) {
    return null; // „Nein“: Spiel läuft unverändert weiter
  }
  let shootout: Record<string, number> | undefined;
  if (input.knockout && input.scoreA === input.scoreB) {
    const answered = await input.askShootout();
    if (answered === null) {
      return null; // ohne Strafstoßergebnis nichts gespeichert (@FU-094)
    }
    shootout = answered;
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
  const scores = { [entry.ctx.teamAId]: input.scoreA, [entry.ctx.teamBId]: input.scoreB };
  return input.commands.endWithResult(id, entry.ctx, 'leitung', scores, shootout, input.knockout, basedOn);
}
