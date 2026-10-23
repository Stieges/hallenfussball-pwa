/**
 * Hinweis „Stand von 14:32 – keine Verbindung“ (B-15, @ZM-032, @ZM-033, @ZM-111, @ZM-109).
 *
 * Er erscheint erst, wenn der letzte erfolgreiche Abruf 20 Sekunden her ist; einzelne Aussetzer bleiben still. Die Uhrzeit
 * ist die Ortszeit des Turniers, nicht die des Handys.
 */
import { toTournamentLocal, TOURNAMENT_TIME_ZONE } from '../../core/view';
import { useTickingNow } from '../../components/schedule/useTickingNow';

/** So lange ohne erfolgreichen Abruf bleibt die Seite still (ms). */
export const CONNECTION_HINT_AFTER_MS = 20_000;

/** Der letzte erfolgreiche Abruf, solange danach Abrufe scheitern; sonst `null`. */
export interface ContactLoss {
  /** Serverzeit des letzten Erfolgs (ms) */
  lastAtMs: number;
  /** Geräteuhr des letzten Erfolgs (ms) */
  lastDeviceMs: number;
}

export interface ConnectionHint {
  /** „14:32“ in Ortszeit des Turniers */
  time: string;
}

export function useConnectionHint(loss: ContactLoss | null): ConnectionHint | null {
  const deviceNow = useTickingNow(loss !== null);
  if (loss === null || deviceNow - loss.lastDeviceMs < CONNECTION_HINT_AFTER_MS) {
    return null;
  }
  return { time: toTournamentLocal(new Date(loss.lastAtMs), TOURNAMENT_TIME_ZONE).time };
}
