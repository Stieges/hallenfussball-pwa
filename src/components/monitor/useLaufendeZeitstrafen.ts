/**
 * Laufende Zeitstrafen der Live-Folie (@ZM-182, @ZM-192): aus den öffentlichen Ereignissen und dem Feinstatus eines Spiels, im
 * Sekundentakt der Serverzeit (`NowSourceContext`) neu gerechnet; der Takt läuft nur, solange eine Strafe bei laufender Uhr
 * abläuft – ohne Zeitstrafe, bei stehender Uhr und nach Ablauf aller Strafen gibt es keinen.
 */
import { useContext } from 'react';
import { laufendeZeitstrafen, KEINE_ZEITSTRAFEN, type OeffentlicheZeitstrafen } from '../../core/view';
import type { RuntimeMatchEvent } from '../../types/tournament';
import { NowSourceContext, useTickingNow } from '../schedule/useTickingNow';

/** Öffentliche Ereignisse und Feinstatus eines Spiels (wie aus `public_payload`). */
export interface ZeitstrafenQuelle {
  events: readonly RuntimeMatchEvent[] | undefined;
  liveState: unknown;
}

/** Laufende Zeitstrafen beider Seiten, im Sekundentakt der Serverzeit neu gerechnet; ohne Quelle keine. */
export function useLaufendeZeitstrafen(quelle: ZeitstrafenQuelle | undefined, homeId: string, awayId: string): OeffentlicheZeitstrafen {
  const serverNow = useContext(NowSourceContext);
  const mitStrafen = quelle !== undefined && (quelle.events?.some((event) => event.type === 'TIME_PENALTY') ?? false);
  // Stand zum Zeitpunkt des Renderns: nur daran entscheidet sich, ob ein Takt nötig ist
  const jetzt = mitStrafen
    ? laufendeZeitstrafen({ events: quelle.events, liveState: quelle.liveState, homeId, awayId, nowMs: serverNow() })
    : KEINE_ZEITSTRAFEN;
  const taktNoetig = !jetzt.steht && (jetzt.home.length > 0 || jetzt.away.length > 0);
  const nowMs = useTickingNow(taktNoetig, true);
  if (!taktNoetig || quelle === undefined) {
    return jetzt;
  }
  return laufendeZeitstrafen({ events: quelle.events, liveState: quelle.liveState, homeId, awayId, nowMs });
}
