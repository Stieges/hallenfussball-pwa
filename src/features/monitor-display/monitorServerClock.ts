/**
 * Serverzeit am Hallenmonitor (R5 PR 2; @ZM-176, @ME-031, Befund C-MONITOR-UHR-RECHNER).
 *
 * Die Uhr eines Spiels ist in Serverzeit verankert (`live_state.anchorAt`). Der Monitor rechnet deshalb nie mit der Uhr des
 * Hallen-Rechners allein: `nowMs()` ist Geräteuhr plus Abstand zum Server. Den Abstand misst jede Antwort von
 * `display_tournament` (`server_now`) mit; es gilt die Messung mit der kürzesten Laufzeit (Hin- und Rückweg) unter den letzten
 * acht Antworten – eine lange, ungleich verteilte Laufzeit verfälscht den Abstand sonst um bis zur Hälfte ihrer Dauer.
 * Ohne Messung (lokales Turnier, Server nie erreicht) gilt die Geräteuhr.
 */

/** So viele Antworten fließen in die Wahl des Abstands ein (Plan R5 PR 2). */
export const SERVER_CLOCK_SAMPLES = 8;

interface Messung {
  abstandMs: number;
  laufzeitMs: number;
}

export class MonitorServerClock {
  private messungen: Messung[] = [];
  private abstandMs = 0;
  private aktiv = true;

  constructor(private readonly deviceNow: () => number = () => Date.now()) {}

  /** Die Antwort mit `serverNowMs` kam auf eine Anfrage, die um `requestedAtMs` raus ging und um `receivedAtMs` ankam (Geräteuhr). */
  observe(serverNowMs: number, requestedAtMs: number, receivedAtMs: number): void {
    // Keine gültige Serverzeit (0 = keine Angabe) oder unmögliche Laufzeit: Messung verwerfen, der bisherige Abstand bleibt
    if (!Number.isFinite(serverNowMs) || serverNowMs <= 0 || receivedAtMs < requestedAtMs) {
      return;
    }
    this.messungen.push({ abstandMs: Math.round(serverNowMs - (requestedAtMs + receivedAtMs) / 2), laufzeitMs: receivedAtMs - requestedAtMs });
    if (this.messungen.length > SERVER_CLOCK_SAMPLES) {
      this.messungen.shift();
    }
    const beste = this.messungen.reduce((a, b) => (b.laufzeitMs < a.laufzeitMs ? b : a));
    this.abstandMs = beste.abstandMs;
    this.aktiv = true;
  }

  /** Der Stand kommt aus diesem Gerät (lokales Turnier): seine Zeitpunkte gelten in Geräteuhr. */
  useDeviceClock(): void {
    this.aktiv = false;
  }

  /** Jetzt in Serverzeit (ms). */
  nowMs(): number {
    return this.deviceNow() + (this.aktiv ? this.abstandMs : 0);
  }
}
