/**
 * Serverzeit auf der Zuschauer-Seite (B-15, @ZM-026, Befund C-RESTZEIT-GERAETEUHR).
 *
 * Die Uhr der Spiele ist in Serverzeit verankert (`live_state.anchorAt`). Die Restzeit rechnet deshalb nie mit der Uhr des
 * Handys allein: `nowMs()` ist Geräteuhr plus der zuletzt gemessene Abstand zum Server. Geht das Handy 40 Sekunden vor,
 * ändert das die Restzeit nicht. Der Abstand ändert sich nur zwischen zwei Abrufen (nie mittendrin), damit Anzeige und
 * Abruf dieselbe Grundlage haben.
 */
import { callServerTime } from '../../core/repositories/appendMatchEventsRpc';
import { supabase } from '../../lib/supabase';
import { withTimeout } from './withTimeout';

export interface ServerClock {
  /** Jetzt in Serverzeit (ms) */
  nowMs(): number;
}

/** Abstand aus der Serverzeit, die jede Antwort der Server-Funktion mitbringt (Adapter (b)); keine eigene Anfrage. */
export class ObservedServerClock implements ServerClock {
  private offsetMs = 0;

  constructor(private readonly deviceNow: () => number = () => Date.now()) {}

  /** Die Antwort kam auf eine Anfrage, die um `requestedAtMs` raus ging und um `receivedAtMs` ankam (Geräteuhr). */
  observe(serverNowMs: number, requestedAtMs: number, receivedAtMs: number): void {
    if (Number.isFinite(serverNowMs)) {
      this.offsetMs = Math.round(serverNowMs - (requestedAtMs + receivedAtMs) / 2);
    }
  }

  nowMs(): number {
    return this.deviceNow() + this.offsetMs;
  }
}

/** Neu messen nach so langer Zeit (ms): die Geräteuhr driftet nur langsam. */
const REMEASURE_AFTER_MS = 10 * 60 * 1000;
/** Nach einem Fehlschlag frühestens nach dieser Zeit erneut (ms). */
const RETRY_AFTER_MS = 60 * 1000;
/** So lange wartet ein Abruf höchstens auf die Messung (ms). */
const MEASURE_TIMEOUT_MS = 2500;

/**
 * Abstand über den vorhandenen Aufruf `server_time` (Adapter (a): die Antwort des heutigen Weges hat keine Serverzeit).
 * Eine kleine Anfrage beim Öffnen, danach höchstens alle 10 Minuten; misslingt sie, gilt die Geräteuhr und es wird
 * frühestens nach einer Minute wieder versucht.
 */
export class MeasuredServerClock implements ServerClock {
  private offsetMs = 0;
  private nextMeasureAt = 0;

  nowMs(): number {
    return Date.now() + this.offsetMs;
  }

  /** Misst, wenn es Zeit dafür ist; wartet höchstens 2,5 Sekunden und wirft nie. */
  async ensureMeasured(): Promise<void> {
    const startedAt = Date.now();
    if (startedAt < this.nextMeasureAt) {
      return;
    }
    this.nextMeasureAt = startedAt + RETRY_AFTER_MS;
    try {
      const serverMs = await withTimeout(callServerTime(supabase), MEASURE_TIMEOUT_MS);
      this.offsetMs = Math.round(serverMs - (startedAt + Date.now()) / 2);
      this.nextMeasureAt = Date.now() + REMEASURE_AFTER_MS;
    } catch {
      // Geräteuhr bleibt; der nächste Versuch kommt nach RETRY_AFTER_MS
    }
  }
}
