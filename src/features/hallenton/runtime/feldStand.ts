/**
 * Feldstand des Hallen-Lautsprechers (H3b-2a/2b, Plan „H3b – Einbau“, Einbau-Vertrag des Planers): was das Gerät je Feld
 * sicher weiß, als `FeldStand` für `planeHallToene`. Ohne React, alle Abhängigkeiten injiziert.
 *
 * - Spielplan alle 10 s und sofort, wenn das aktuelle Spiel eines Felds endet; das aktuelle Spiel je Feld wie das Cockpit.
 *   Ein Spiel, das vom Feld geht, bleibt 10 s gehalten, damit sein Ende (z. B. von Hand, @HT-007) noch ankommt.
 * - Eine Sammelabfrage der Ereignisse je Takt für alle aktuellen Spiele (Wasserstand je Spiel), Stand mit `reduceMatch` nur
 *   im Speicher. Eine unlesbare Zeile betrifft nur ihr Spiel: seine Antwort altert, die übrigen bleiben frisch.
 * - Regel 2 („Hupe und Anzeige sagen dasselbe“, 07.11., @HT-033 Zeilen 1–3, 7, 10–12): immer der Stand am Server mit dem
 *   Alter der Antwort, wie der Monitor – auch wenn dieses Gerät das Feld selbst leitet. Die eigene Engine zählt nicht.
 * - Zwei Zeitwerte: `letzteAntwortAt` (letzte erfolgreiche Sammelabfrage, @HT-011) und `bekanntSeit` je Feld (@HT-051).
 * - Takt: 1 s bei angepfiffenem Spiel (laufend/angehalten, @HT-007), sonst 5 s, Minimum mit dem Planer; nach einem
 *   gescheiterten Versuch eng (N-2, Ruling 2b). Halbzeitpause, offene Entscheidung und Strafstoßschießen bleiben bei 5 s:
 *   aus ihnen folgt kein Ton, der früher bekannt sein müsste (Bericht H3b-2b, Befund 3). Ein neues Spiel sofort abfragen.
 * - Ohne echtes Konto nicht verfügbar; nach Turnierende (abgeschlossen oder 55000) still aus. Solange die Konto-Prüfung
 *   aussteht (Start ohne Netz), gilt der lokale Spielplan: die Felder kennen dann ihr Spiel, haben aber keine Antwort und
 *   warnen „keine Verbindung“ (@HT-033 Zeilen 4, 11) – so ist der Lautsprecher nicht bereit und das Cockpit tönt (Regel 3).
 * Lesen je Takt einmal in der Reihenfolge `aktualisieren` → `staende` (`staende` merkt `bekanntSeit` und das Halten);
 * `naechsterAbfrageTaktMs` liest nur den zuletzt gewählten Stand. Alle Zeiten sind Serverzeit (@HT-010).
 */
import { reduceMatch, type MatchContext, type MatchState } from '../../../core/match';
import type { EngineEventWithSeq } from '../../../core/match/client';
import type { FeldStand } from '../../../core/hallenton';
import type { FeldKennung } from './aktuellesSpielJeFeld';
import { ladeEreignisse, ladeSpielplan, pruefeEchtesKonto, type AbfrageErgebnis, type FeldStandClient } from './feldStandAbfragen';
import { erzeugeBekanntSeitMerker } from './feldStandMerker';
import { erzeugeFeldWahl, istAngepfiffen, planSpielAus, type PlanSpiel } from './feldStandSpiele';
import { echterZeitgeber, type Zeitgeber } from './zeitgeber';

export const SPIELPLAN_TAKT_MS = 10_000;
export const TAKT_ANGEPFIFFEN_MS = 1000;
export const TAKT_RUHE_MS = 5000;
export { HALTEN_NACH_WECHSEL_MS } from './feldStandSpiele';
/** Ist der Spielplan sofort fällig, frühestens 1 s nach dem letzten Versuch erneut lesen (kein Nachfragen im 250-ms-Takt). */
const SPIELPLAN_WIEDERHOLEN_MS = 1000;

export type FeldStandVerfuegbarkeit = 'pruefe' | 'verfuegbar' | 'nichtVerfuegbar' | 'turnierBeendet';

export interface FeldStandDeps {
  client: FeldStandClient | null;
  /** Abgeglichene Serverzeit (`ClockSync.serverNow`). */
  serverNow: () => number;
  turnierId: string;
  /** Felder (1, 2, …), für die dieses Gerät Hallen-Lautsprecher ist. */
  lautsprecherFelder: () => readonly number[];
  /** Spielplan aus der lokalen Turnierkopie, solange der Server keinen geliefert hat (Start ohne Netz, Befund 6a). */
  lokalerSpielplan?: () => readonly PlanSpiel[] | null;
  /** Zeitgeber für den Abbruch nach 3 s; im Test `ManuelleUhr`. */
  zeitgeber?: Zeitgeber;
}

export interface FeldStandQuelle {
  /** Im Takt aufrufen (z. B. alle 250 ms): fragt ab, was fällig ist. Läuft schon eine Runde, wartet der Aufruf auf sie. */
  aktualisieren(nowServer: number, planerTaktMs?: number | null): Promise<void>;
  /** Stand je Lautsprecher-Feld mit Spiel (zwei bekannte Teams); leer, solange nicht verfügbar. */
  staende(): FeldStand[];
  /** Abstand der Sammelabfragen in ms (1000 oder 5000, ggf. kürzer nach Planer); liest nur, ändert nichts. */
  naechsterAbfrageTaktMs(planerTaktMs?: number | null): number;
  letzteAntwortAt(): number | null;
  /** Ist der letzte Versuch am Netz (Konto, Spielplan, Sammelabfrage) gescheitert? (N-2, Warnung im Ruhezustand) */
  letzterVersuchGescheitert(): boolean;
  verfuegbarkeit(): FeldStandVerfuegbarkeit;
  /** Spiel-IDs, deren Ereignisse diese App nicht lesen kann (Diagnose, z. B. „App aktualisieren“). */
  unlesbareSpiele(): string[];
}

interface ServerSpiel {
  ctx: MatchContext;
  log: EngineEventWithSeq[];
  wasserstand: number;
  state: MatchState;
  /** Serverzeit, zu der der Stand dieses Spiels zuletzt neu ankam (bzw. das Spiel aktuell wurde). */
  geaendertAt: number;
  /** Serverzeit der letzten Sammelabfrage, die dieses Spiel lesbar beantwortet hat; `null` = noch keine. */
  antwortAt: number | null;
  unlesbar: boolean;
}

export function erzeugeFeldStand(deps: FeldStandDeps): FeldStandQuelle {
  const zeitgeber = deps.zeitgeber ?? echterZeitgeber;
  let verfuegbar: FeldStandVerfuegbarkeit = deps.client ? 'pruefe' : 'nichtVerfuegbar';
  let plan: PlanSpiel[] | null = null;
  let spielplanVersuchAt: number | null = null;
  let spielplanFaellig = false;
  let letzteAntwortAt: number | null = null;
  let ereignisVersuchAt: number | null = null;
  let laeuft: Promise<void> | null = null;
  let kontoVersuchAt: number | null = null;
  let gescheitert = false;
  let letzteWahl = new Map<FeldKennung, PlanSpiel>();
  const serverSpiele = new Map<string, ServerSpiel>();
  const merker = erzeugeBekanntSeitMerker();
  const feldWahl = erzeugeFeldWahl();

  const felder = (): number[] => [...new Set(deps.lautsprecherFelder())].sort((a, b) => a - b);

  function beenden(): void {
    verfuegbar = 'turnierBeendet';
    plan = null;
    serverSpiele.clear();
    merker.leeren();
  }

  /** k6: nur Konto und Sammelabfrage zählen für N-2; ein gescheiterter Spielplan lässt die Antwort nicht altern. */
  function fehlschlag(ergebnis: AbfrageErgebnis<unknown>, zaehlt = true): void {
    gescheitert ||= zaehlt;
    if (!ergebnis.ok && ergebnis.grund === 'turnierBeendet') {
      beenden();
    }
  }

  /** Aktuelles Spiel je Lautsprecher-Feld nach dem Spielplan, wie das Cockpit. */
  function aktuelleSpiele(now: number): Map<FeldKennung, PlanSpiel> {
    const eigene = felder();
    const spiele = plan ?? deps.lokalerSpielplan?.() ?? null;
    letzteWahl = spiele === null || eigene.length === 0 ? new Map<FeldKennung, PlanSpiel>() : feldWahl(spiele, eigene, now);
    return letzteWahl;
  }

  /** `bekanntSeit` bleibt, solange der Stand gleich bleibt (auch beim Wechsel des leitenden Geräts, @HT-033 Zeilen 10, 12). */
  function merke(kennung: FeldKennung, matchId: string, state: MatchState, geaendertAt: number, now: number): number {
    const gemerkt = merker.merke(kennung, matchId, state, geaendertAt, now);
    if (gemerkt.spielEndete) {
      spielplanFaellig = true; // das aktuelle Spiel ist zu Ende: das nächste ohne 10 s Warten kennen
    }
    return gemerkt.bekanntSeit;
  }

  const antwortAlterMs = (now: number, seit: number | null): number => (seit === null ? Number.POSITIVE_INFINITY : now - seit);

  function staende(): FeldStand[] {
    if (verfuegbar !== 'verfuegbar' && verfuegbar !== 'pruefe') {
      return [];
    }
    const now = deps.serverNow();
    const ergebnis: FeldStand[] = [];
    for (const [kennung, spiel] of aktuelleSpiele(now)) {
      if (spiel.ctx === null) {
        continue;
      }
      const server = serverSpiele.get(spiel.id);
      const state = server?.state ?? reduceMatch([], spiel.ctx).state;
      const bekanntSeit = merke(kennung, spiel.id, state, server?.geaendertAt ?? now, now);
      const alter = antwortAlterMs(now, server ? server.antwortAt : letzteAntwortAt);
      ergebnis.push({ feldId: kennung, ctx: spiel.ctx, state, antwortAlterMs: alter, bekanntSeit });
    }
    return ergebnis;
  }

  function naechsterAbfrageTaktMs(planerTaktMs: number | null, wahl: ReadonlyMap<FeldKennung, PlanSpiel>): number {
    if (gescheitert) {
      return TAKT_ANGEPFIFFEN_MS; // N-2 (Ruling 2b): nach einem gescheiterten Versuch sofort und eng nachfragen
    }
    const angepfiffen = [...wahl.values()].some((spiel) => {
      return istAngepfiffen(serverSpiele.get(spiel.id)?.state.status ?? spiel.status);
    });
    const takt = angepfiffen ? TAKT_ANGEPFIFFEN_MS : TAKT_RUHE_MS;
    return planerTaktMs === null ? takt : Math.min(takt, planerTaktMs);
  }

  async function ladePlan(client: FeldStandClient, now: number): Promise<void> {
    const faellig = spielplanVersuchAt === null
      || now - spielplanVersuchAt >= SPIELPLAN_TAKT_MS
      || (spielplanFaellig && now - spielplanVersuchAt >= SPIELPLAN_WIEDERHOLEN_MS);
    if (!faellig) {
      return;
    }
    spielplanVersuchAt = now;
    const ergebnis = await ladeSpielplan(client, deps.turnierId, zeitgeber);
    if (!ergebnis.ok) {
      fehlschlag(ergebnis, false);
      return;
    }
    if (ergebnis.wert.abgeschlossen) {
      beenden();
      return;
    }
    spielplanFaellig = false;
    plan = ergebnis.wert.spiele.map((zeile) => planSpielAus(zeile, ergebnis.wert.datum));
  }

  async function ladeStaende(client: FeldStandClient, now: number, planerTaktMs: number | null): Promise<void> {
    const wahl = aktuelleSpiele(now);
    const aktuelle = [...wahl.values()].flatMap((spiel) => (spiel.ctx ? [spiel.ctx] : []));
    // ein neues aktuelles Spiel sofort abfragen, sonst im Takt
    const neuesSpiel = aktuelle.some((ctx) => !serverSpiele.has(ctx.matchId));
    if (!neuesSpiel && ereignisVersuchAt !== null && now - ereignisVersuchAt < naechsterAbfrageTaktMs(planerTaktMs, wahl)) {
      return;
    }
    for (const matchId of serverSpiele.keys()) {
      if (!aktuelle.some((ctx) => ctx.matchId === matchId)) {
        serverSpiele.delete(matchId);
      }
    }
    if (aktuelle.length === 0) {
      return;
    }
    for (const ctx of aktuelle) {
      if (!serverSpiele.has(ctx.matchId)) {
        // neues aktuelles Spiel: Wasserstand 0, Stand ab dem leeren Log; das Alter erbt die letzte Antwort (N1), damit es
        // bis zur ersten eigenen Antwort nicht als „nie beantwortet“ warnt – scheitert sie, altert es wie alle
        serverSpiele.set(ctx.matchId, { ctx, log: [], wasserstand: 0, state: reduceMatch([], ctx).state, geaendertAt: now, antwortAt: letzteAntwortAt, unlesbar: false });
      }
    }
    ereignisVersuchAt = now;
    const wasserstaende = new Map(aktuelle.map((ctx) => [ctx.matchId, serverSpiele.get(ctx.matchId)?.wasserstand ?? 0] as const));
    const ergebnis = await ladeEreignisse(client, wasserstaende, zeitgeber);
    if (!ergebnis.ok) {
      fehlschlag(ergebnis); // letzteAntwortAt bleibt stehen, die Antwort altert (@HT-011)
      return;
    }
    const antwortAt = deps.serverNow();
    letzteAntwortAt = antwortAt;
    gescheitert = false;
    for (const ctx of aktuelle) {
      const spiel = serverSpiele.get(ctx.matchId);
      if (spiel) {
        const unlesbar = ergebnis.wert.unlesbar.has(ctx.matchId);
        serverSpiele.set(ctx.matchId, { ...spiel, unlesbar, antwortAt: unlesbar ? spiel.antwortAt : antwortAt });
      }
    }
    for (const [matchId, neu] of ergebnis.wert.neu) {
      const spiel = serverSpiele.get(matchId);
      if (!spiel || neu.length === 0) {
        continue;
      }
      const log = [...spiel.log, ...neu].sort((a, b) => a.seq - b.seq);
      const state = reduceMatch(log, spiel.ctx).state;
      serverSpiele.set(matchId, { ...spiel, log, state, wasserstand: log[log.length - 1].seq, geaendertAt: antwortAt });
      if (state.status === 'finished' && spiel.state.status !== 'finished') {
        spielplanFaellig = true;
      }
    }
  }

  async function runde(now: number, planerTaktMs: number | null): Promise<void> {
    const client = deps.client;
    if (!client || verfuegbar === 'nichtVerfuegbar' || verfuegbar === 'turnierBeendet') {
      return;
    }
    if (verfuegbar === 'pruefe') {
      // gescheiterte Prüfung (z. B. Start ohne Netz) frühestens im Abstand des Spielplans wiederholen, nicht je Takt
      if (kontoVersuchAt !== null && now - kontoVersuchAt < SPIELPLAN_TAKT_MS) {
        return;
      }
      kontoVersuchAt = now;
      const konto = await pruefeEchtesKonto(client, zeitgeber);
      if (!konto.ok) {
        fehlschlag(konto);
        return;
      }
      verfuegbar = konto.wert ? 'verfuegbar' : 'nichtVerfuegbar';
      if (!konto.wert) {
        return;
      }
    }
    await ladePlan(client, now);
    if (verfuegbar === 'verfuegbar') {
      // Befund 5: die Zeit nach dem Spielplan neu lesen (er kann bis zu 3 s hängen)
      await ladeStaende(client, deps.serverNow(), planerTaktMs);
    }
  }

  return {
    aktualisieren(nowServer, planerTaktMs = null) {
      laeuft ??= runde(nowServer, planerTaktMs).finally(() => {
        laeuft = null;
      });
      return laeuft;
    },
    staende,
    naechsterAbfrageTaktMs: (planerTaktMs = null) => naechsterAbfrageTaktMs(planerTaktMs, letzteWahl),
    letzteAntwortAt: () => letzteAntwortAt,
    letzterVersuchGescheitert: () => gescheitert,
    verfuegbarkeit: () => verfuegbar,
    unlesbareSpiele: () => [...serverSpiele.values()].filter((spiel) => spiel.unlesbar).map((spiel) => spiel.ctx.matchId),
  };
}
