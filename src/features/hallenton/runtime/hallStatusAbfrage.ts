/**
 * Stand der Hallen-Lautsprecher eines Turniers (H3b-3, Grundlage von `useHallStatus`): `hall_sound_status` alle 5 s, solange
 * gestartet. Volle Sicht mit `manageScreens`, sonst die schmale Sicht (entscheidet der Server).
 *
 * „Status unbekannt“ statt eines alten Stands (@HT-041): ohne eigenes Netz (`online()` falsch) sofort, sonst sobald die
 * letzte erfolgreiche Antwort älter als 10 s ist (zwei Abfragen in Folge gescheitert) – ein Netzverlust zeigt sich so nach
 * höchstens 15 s, eine Rückkehr mit der nächsten Antwort (≤ 5 s). Die Alter misst die Uhr des Geräts nur als Abstand seit
 * dem Empfang (monoton); der Stand selbst rechnet nur mit Server-Alter (@HT-042). Nichts wirft.
 */
import type { HallArgs, HallErgebnis, HallStatusAntwort } from '../../../core/repositories/hallentonRpc';
import { lautsprecherLage, type LautsprecherLage } from './hallStatusAuswertung';
import type { Zeitgeber } from './zeitgeber';

export const HALL_STATUS_TAKT_MS = 5000;
export const HALL_STATUS_GUELTIG_MS = 10_000;

export type HallStatusStand = 'laedt' | 'aktuell' | 'unbekannt' | 'kein_recht';

export interface HallStatusSchnappschuss {
  stand: HallStatusStand;
  /** Nur bei `aktuell`. */
  antwort: HallStatusAntwort | null;
  /** Je Feld mit Lautsprecher (nur bei `aktuell`); Felder ohne fehlen (neutral). */
  felder: Readonly<Record<number, LautsprecherLage>>;
}

export interface HallStatusAbfrageDeps {
  turnierId: string;
  deviceId: string;
  rpc: (args: HallArgs<'hall_sound_status'>) => Promise<HallErgebnis<HallStatusAntwort>>;
  online: () => boolean;
  zeitgeber: Zeitgeber;
}

export interface HallStatusAbfrage {
  start(): void;
  stop(): void;
  /** Sofort neu lesen (z. B. nach einem Testton). */
  abfragen(): void;
  getSnapshot(): HallStatusSchnappschuss;
  subscribe(fn: () => void): () => void;
}

const UNBEKANNT: HallStatusSchnappschuss = { stand: 'unbekannt', antwort: null, felder: {} };

function felderAus(antwort: HallStatusAntwort): Record<number, LautsprecherLage> {
  const felder: Record<number, LautsprecherLage> = {};
  for (const s of antwort.speakers) {
    felder[s.field] = lautsprecherLage({ state: s.state, ageMs: s.ageMs, outputHint: s.outputHint }, antwort.serverNow);
  }
  return felder;
}

export function erzeugeHallStatusAbfrage(d: HallStatusAbfrageDeps): HallStatusAbfrage {
  const zuhoerer = new Set<() => void>();
  let letzte: { antwort: HallStatusAntwort; um: number } | null = null;
  let keinRecht = false;
  let versucht = false;
  let laeuft = false;
  let gestartet = false;
  const ab: Array<() => void> = [];
  let ablauf: (() => void) | null = null;
  let snapshot: HallStatusSchnappschuss = { stand: 'laedt', antwort: null, felder: {} };

  function baue(): HallStatusSchnappschuss {
    if (keinRecht) {
      return { stand: 'kein_recht', antwort: null, felder: {} };
    }
    if (letzte !== null && d.online() && d.zeitgeber.jetzt() - letzte.um <= HALL_STATUS_GUELTIG_MS) {
      return { stand: 'aktuell', antwort: letzte.antwort, felder: felderAus(letzte.antwort) };
    }
    return versucht || !d.online() ? UNBEKANNT : { stand: 'laedt', antwort: null, felder: {} };
  }

  function melden(): void {
    const neu = baue();
    if (JSON.stringify(neu) !== JSON.stringify(snapshot)) {
      snapshot = neu;
      for (const fn of [...zuhoerer]) {
        fn();
      }
    }
  }

  function abfragen(): void {
    if (!gestartet || laeuft) {
      return;
    }
    if (!d.online()) {
      versucht = true;
      melden();
      return;
    }
    laeuft = true;
    void d.rpc({ p_tournament_id: d.turnierId, p_device_id: d.deviceId })
      .catch((): HallErgebnis<HallStatusAntwort> => ({ ok: false, grund: 'netz' }))
      .then((antwort) => {
        laeuft = false;
        versucht = true;
        if (!gestartet) {
          return;
        }
        keinRecht = !antwort.ok && antwort.grund === 'kein_recht';
        if (antwort.ok) {
          letzte = { antwort, um: d.zeitgeber.jetzt() };
          ablauf?.();
          ablauf = d.zeitgeber.spaeter(melden, HALL_STATUS_GUELTIG_MS + 1); // veraltet auch ohne weitere Antwort
        }
        melden();
      });
  }

  return {
    start() {
      if (gestartet) {
        return;
      }
      gestartet = true;
      melden(); // ein Stand aus einer früheren Einbindung kann inzwischen veraltet sein
      ab.push(d.zeitgeber.wiederholen(abfragen, HALL_STATUS_TAKT_MS));
      abfragen();
    },
    stop() {
      gestartet = false;
      for (const fn of ab.splice(0)) {
        fn();
      }
      ablauf?.();
      ablauf = null;
    },
    abfragen,
    getSnapshot: () => snapshot,
    subscribe(fn) {
      zuhoerer.add(fn);
      return () => {
        zuhoerer.delete(fn);
      };
    },
  };
}
