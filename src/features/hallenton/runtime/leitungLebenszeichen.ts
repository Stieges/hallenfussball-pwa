/**
 * Lebenszeichen des leitenden Geräts (H3b-3, Plan „Leitendes Gerät“, @HT-034, @HT-035): `hall_field_lead_heartbeat` alle 5 s
 * je Feld, solange dieses Gerät das Feld steuert (`ownFields`, aus `useFieldControl … isMine`) und dort ein Spiel angepfiffen
 * ist (laufend oder angehalten). Daraus sehen die anderen Geräte „Feld 1: Handy ohne Netz“ (Alter rechnet der Server).
 *
 * Gilt auf jedem angemeldeten Gerät, auch ohne Lautsprecher-Funktion; die Last bleibt gering: nur eigene Felder, nur während
 * eines angepfiffenen Spiels. Die Antwort (Zustand des Lautsprechers, `outputHint`) liegt je Turnier und Feld für die
 * Cockpit-Hinweise von H4 bereit (`stand`, @HT-040, @HT-050). Endet das Spiel oder die Steuer, fällt der Stand weg; eine
 * gescheiterte Anfrage lässt den alten Stand altern (der Hook macht daraus nach 15 s „unbekannt“). Nichts wirft.
 */
import type { HallArgs, HallErgebnis, HallLeadHeartbeatAntwort } from '../../../core/repositories/hallentonRpc';
import type { Zeitgeber } from './zeitgeber';

export const LEITUNG_LEBENSZEICHEN_MS = 5000;

export interface LeitungStand {
  status: HallLeadHeartbeatAntwort['status'];
  speaker: HallLeadHeartbeatAntwort['speaker'];
  serverNow: number;
  /** Monotone Zeit des Empfangs (`zeitgeber.jetzt()`). */
  empfangenUm: number;
}

export interface LeitungDeps {
  deviceId: string;
  eigeneFelder: () => Record<string, readonly number[]>;
  angepfiffen: (turnierId: string, feld: number) => boolean;
  rpc: (args: HallArgs<'hall_field_lead_heartbeat'>) => Promise<HallErgebnis<HallLeadHeartbeatAntwort>>;
  zeitgeber: Zeitgeber;
}

export interface LeitungLebenszeichen {
  start(): void;
  stop(): void;
  stand(turnierId: string, feld: number): LeitungStand | null;
  /** Zählt jede Änderung (für `useSyncExternalStore`). */
  version(): number;
  jetzt(): number;
  subscribe(fn: () => void): () => void;
}

const schluessel = (turnierId: string, feld: number): string => `${turnierId}|${feld}`;

export function erzeugeLeitungLebenszeichen(d: LeitungDeps): LeitungLebenszeichen {
  const staende = new Map<string, LeitungStand>();
  const laufend = new Set<string>();
  const zuhoerer = new Set<() => void>();
  let aktiv = new Set<string>();
  let stand = 0;
  let stoppen: (() => void) | null = null;

  const melden = (): void => {
    stand += 1;
    for (const fn of [...zuhoerer]) {
      fn();
    }
  };

  function runde(): void {
    const jetzt = new Set<string>();
    const auftraege: Array<{ turnierId: string; feld: number }> = [];
    for (const [turnierId, felder] of Object.entries(d.eigeneFelder())) {
      for (const feld of felder) {
        if (d.angepfiffen(turnierId, feld)) {
          jetzt.add(schluessel(turnierId, feld));
          auftraege.push({ turnierId, feld });
        }
      }
    }
    aktiv = jetzt;
    let geaendert = false;
    for (const key of [...staende.keys()]) {
      if (!aktiv.has(key)) {
        staende.delete(key);
        geaendert = true;
      }
    }
    if (geaendert) {
      melden();
    }
    for (const { turnierId, feld } of auftraege) {
      senden(turnierId, feld);
    }
  }

  function senden(turnierId: string, feld: number): void {
    const key = schluessel(turnierId, feld);
    if (laufend.has(key)) {
      return;
    }
    laufend.add(key);
    void d.rpc({ p_tournament_id: turnierId, p_field: feld, p_device_id: d.deviceId })
      .catch((): HallErgebnis<HallLeadHeartbeatAntwort> => ({ ok: false, grund: 'netz' }))
      .then((antwort) => {
        laufend.delete(key);
        if (stoppen === null || !aktiv.has(key) || !antwort.ok) {
          return;
        }
        staende.set(key, { status: antwort.status, speaker: antwort.speaker, serverNow: antwort.serverNow, empfangenUm: d.zeitgeber.jetzt() });
        melden();
      });
  }

  return {
    start() {
      if (stoppen !== null) {
        return;
      }
      stoppen = d.zeitgeber.wiederholen(runde, LEITUNG_LEBENSZEICHEN_MS);
      runde();
    },
    stop() {
      stoppen?.();
      stoppen = null;
      aktiv = new Set();
      if (staende.size > 0) {
        staende.clear();
        melden();
      }
    },
    stand: (turnierId, feld) => staende.get(schluessel(turnierId, feld)) ?? null,
    version: () => stand,
    jetzt: () => d.zeitgeber.jetzt(),
    subscribe(fn) {
      zuhoerer.add(fn);
      return () => {
        zuhoerer.delete(fn);
      };
    },
  };
}
