/**
 * Antwort der Server-Funktion `public_tournament(share_code, since_version)` für die Zuschauer-Seite (B-15, Adapter (b)).
 *
 * Den Vertrag prüft und übersetzt der B-14-Parser `parsePublicPayload` (`core/repositories/publicPayload.ts`, Server:
 * `supabase/migrations/20261117_104_public_payload.sql`). Hier wird nur in die Ergebnisse der Zuschauer-Seite übersetzt:
 *   not_found → „nicht gefunden“ (sicher, nie bei einer Störung, @ZM-068)
 *   unchanged → Version ohne Inhalt
 *   full      → Turnier mit Teamnamen an den Ereignissen
 *   delta     → geänderte Spiele (+ entfernte Kennungen); Kopfdaten und Teams bringt der Server nur in einer vollen Antwort
 * `version` wird als Zeichenkette gehalten (Stand-Speicher), `server_now` gleicht die Uhr ab (@ZM-026).
 * Jede Abweichung vom Vertrag wirft und gilt als „nicht erreichbar“ (@ZM-109).
 */
import { parsePublicPayload } from '../../core/repositories/publicPayload';
import { withEventTeamNames } from './publicDelta';
import type { PublicFetchResult } from './publicSource';

export interface ParsedReply {
  result: PublicFetchResult;
  /** Serverzeit der Antwort (ms), `undefined` bei „nicht gefunden“ */
  serverNowMs?: number;
}

/** Prüft und übersetzt die Antwort; wirft bei einer Abweichung vom Vertrag. */
export function parsePublicReply(raw: unknown): ParsedReply {
  const reply = parsePublicPayload(raw);
  switch (reply.kind) {
    case 'not-found':
      return { result: { kind: 'not-found' } };
    case 'unchanged':
      return { result: { kind: 'unchanged', version: String(reply.version) }, serverNowMs: reply.serverNowMs };
    case 'full':
      return {
        result: { kind: 'full', version: String(reply.version), tournament: withEventTeamNames(reply.tournament) },
        serverNowMs: reply.serverNowMs,
      };
    case 'delta':
      return {
        result: {
          kind: 'delta',
          version: String(reply.version),
          baseVersion: String(reply.baseVersion),
          delta: { matches: reply.matches, removedMatchIds: reply.removedMatchIds },
        },
        serverNowMs: reply.serverNowMs,
      };
  }
}
