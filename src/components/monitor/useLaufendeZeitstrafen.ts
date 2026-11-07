/**
 * Laufende Zeitstrafen der Live-Folie (@ZM-182, @ZM-192): aus den öffentlichen Ereignissen und dem Feinstatus eines Spiels, im
 * Sekundentakt der Serverzeit (`NowSourceContext`) neu gerechnet; ohne Zeitstrafe kein Takt.
 */
import { laufendeZeitstrafen, KEINE_ZEITSTRAFEN, type OeffentlicheZeitstrafen } from '../../core/view';
import type { RuntimeMatchEvent } from '../../types/tournament';
import { useTickingNow } from '../schedule/useTickingNow';

/** Öffentliche Ereignisse und Feinstatus eines Spiels (wie aus `public_payload`). */
export interface ZeitstrafenQuelle {
  events: readonly RuntimeMatchEvent[] | undefined;
  liveState: unknown;
}

/** Laufende Zeitstrafen beider Seiten, im Sekundentakt der Serverzeit neu gerechnet; ohne Quelle keine. */
export function useLaufendeZeitstrafen(quelle: ZeitstrafenQuelle | undefined, homeId: string, awayId: string): OeffentlicheZeitstrafen {
  const mitStrafen = quelle?.events?.some((event) => event.type === 'TIME_PENALTY') ?? false;
  const nowMs = useTickingNow(mitStrafen, true);
  if (!mitStrafen || quelle === undefined) {
    return KEINE_ZEITSTRAFEN;
  }
  return laufendeZeitstrafen({ events: quelle.events, liveState: quelle.liveState, homeId, awayId, nowMs });
}

