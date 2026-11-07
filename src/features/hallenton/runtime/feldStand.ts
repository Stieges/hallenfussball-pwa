/**
 * Feldstand des Hallen-Lautsprechers (H3b-2a, Plan „H3b – Einbau“, Einbau-Vertrag des Planers): was das Gerät je Feld
 * sicher weiß, als `FeldStand` für `planeHallToene`. Ohne React, alle Abhängigkeiten injiziert.
 *
 * - Spielplan alle 10 s und sofort, wenn das aktuelle Spiel eines Felds endet; das aktuelle Spiel je Feld wie das Cockpit
 *   (`aktuellesSpielJeFeld`). Ein Spiel, das gerade vom Feld geht, bleibt 10 s gehalten, damit sein Ende (z. B. von Hand,
 *   @HT-007) beim Planer ankommt, bevor das nächste Spiel das Feld übernimmt.
 * - Eine Sammelabfrage der Ereignisse je Takt für alle aktuellen Spiele (Wasserstand je Spiel, neues Spiel ab 0), Stand
 *   mit `reduceMatch` nur im Speicher: ein voller `MatchState` ohne lokale Ausstehende.
 * - Regel 2 (@HT-033 Zeilen 1, 3, 10, 11): Leitet das Gerät das Feld, gilt der Stand der eigenen Engine
 *   (`quelle = eigenesCockpit`), sonst der Stand am Server mit dem Alter der letzten Antwort.
 * - Zwei Zeitwerte: `letzteAntwortAt` (Serverzeit der letzten erfolgreichen Sammelabfrage; bleibt bei Fehler oder Abbruch
 *   stehen, @HT-011) und `bekanntSeit` je Feld (Serverzeit der letzten Änderung des Stands, @HT-051).
 * - Takt: 1 s, solange auf einem Lautsprecher-Feld ein Spiel angepfiffen ist (@HT-007), sonst 5 s; der Takt des Planers
 *   gilt, wenn er kürzer ist; ist die letzte Antwort älter als 3 s, sofort und eng (N-2). Ein neues aktuelles Spiel wird
 *   sofort abgefragt.
 * - Ohne echtes Konto (`is_real_account`) nicht verfügbar; nach Turnierende (abgeschlossen oder 55000) still aus.
 * Alle Zeiten sind Serverzeit (`serverNow`), die Uhr des Geräts zählt nie (@HT-010).
 */
import { reduceMatch, type MatchContext, type MatchState } from '../../../core/match';
import type { EngineEventWithSeq } from '../../../core/match/client';
import { ANTWORT_MAX_ALTER_MS, type FeldStand } from '../../../core/hallenton';
import type { FeldKennung } from './aktuellesSpielJeFeld';
import { ladeEreignisse, ladeSpielplan, pruefeEchtesKonto, type AbfrageErgebnis, type FeldStandClient } from './feldStandAbfragen';
import { erzeugeFeldWahl, feldSpielStatusAus, istAngepfiffen, planSpielAus, standKennung, type PlanSpiel } from './feldStandSpiele';
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
  /** „Leite ich Feld X?“ (`useFieldControl … isMine`). */
  leiteIchFeld: (feld: number) => boolean;
  /** Stand der eigenen Engine (`view(matchId)?.result.state`); `null`, wenn sie das Spiel nicht kennt. */
  eigeneSicht: (matchId: string) => MatchState | null;
  /** Zeitgeber für den Abbruch nach 3 s; im Test `ManuelleUhr`. */
  zeitgeber?: Zeitgeber;
}

export interface FeldStandQuelle {
  /** Im Takt aufrufen (z. B. alle 250 ms): fragt ab, was fällig ist. Läuft schon eine Runde, wartet der Aufruf auf sie. */
  aktualisieren(nowServer: number, planerTaktMs?: number | null): Promise<void>;
  /** Stand je Lautsprecher-Feld mit Spiel (zwei bekannte Teams); leer, solange nicht verfügbar. */
  staende(): FeldStand[];
  /** Abstand der Sammelabfragen in ms (1000 oder 5000, ggf. kürzer nach Planer). */
  naechsterAbfrageTaktMs(planerTaktMs?: number | null): number;
  letzteAntwortAt(): number | null;
  verfuegbarkeit(): FeldStandVerfuegbarkeit;
}

interface ServerSpiel {
  ctx: MatchContext;
  log: EngineEventWithSeq[];
  wasserstand: number;
  state: MatchState;
  /** Serverzeit, zu der der Stand dieses Spiels zuletzt neu ankam (bzw. das Spiel aktuell wurde). */
  geaendertAt: number;
}

interface FeldMerker {
  matchId: string;
  art: FeldStand['quelle']['art'];
  kennung: string;
  bekanntSeit: number;
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
  const serverSpiele = new Map<string, ServerSpiel>();
  const merker = new Map<FeldKennung, FeldMerker>();
  const feldWahl = erzeugeFeldWahl();

  const felder = (): number[] => [...new Set(deps.lautsprecherFelder())].sort((a, b) => a - b);

  const eigenerStand = (feld: number, matchId: string): MatchState | null => (deps.leiteIchFeld(feld) ? deps.eigeneSicht(matchId) : null);

  function beenden(): void {
    verfuegbar = 'turnierBeendet';
    plan = null;
    serverSpiele.clear();
    merker.clear();
  }

  function fehlschlag(ergebnis: AbfrageErgebnis<unknown>): void {
    if (!ergebnis.ok && ergebnis.grund === 'turnierBeendet') {
      beenden();
    }
  }

  /** Aktuelles Spiel je Lautsprecher-Feld; leitet das Gerät ein Feld, zählt für die Wahl der Status der eigenen Engine. */
  function aktuelleSpiele(now: number): Map<FeldKennung, PlanSpiel> {
    const eigene = felder();
    if (plan === null || eigene.length === 0) {
      return new Map();
    }
    const spiele = plan.map((spiel) => {
      const eigen = eigene.includes(spiel.field) ? eigenerStand(spiel.field, spiel.id) : null;
      return eigen ? { ...spiel, status: feldSpielStatusAus(eigen) } : spiel;
    });
    return feldWahl(spiele, eigene, now);
  }

  /** `bekanntSeit` bleibt, solange der Stand gleich bleibt – auch beim Wechsel der Quelle (@HT-033 Zeile 10). */
  function merke(kennung: FeldKennung, matchId: string, art: FeldMerker['art'], state: MatchState, geaendertAt: number, now: number): number {
    const stand = standKennung(state);
    const alt = merker.get(kennung);
    if (alt?.matchId === matchId && alt.kennung === stand) {
      merker.set(kennung, { ...alt, art });
      return alt.bekanntSeit;
    }
    const ausDaten = alt?.matchId === matchId && alt.art === art && art === 'server';
    const bekanntSeit = ausDaten ? geaendertAt : now;
    merker.set(kennung, { matchId, art, kennung: stand, bekanntSeit });
    if (alt?.matchId === matchId && state.status === 'finished') {
      spielplanFaellig = true; // das aktuelle Spiel ist zu Ende: das nächste ohne 10 s Warten kennen
    }
    return bekanntSeit;
  }

  function antwortAlterMs(now: number): number {
    return letzteAntwortAt === null ? Number.POSITIVE_INFINITY : now - letzteAntwortAt;
  }

  function staende(): FeldStand[] {
    if (verfuegbar !== 'verfuegbar') {
      return [];
    }
    const now = deps.serverNow();
    const ergebnis: FeldStand[] = [];
    for (const [kennung, spiel] of aktuelleSpiele(now)) {
      if (spiel.ctx === null) {
        continue;
      }
      const eigen = eigenerStand(spiel.field, spiel.id);
      if (eigen) {
        const bekanntSeit = merke(kennung, spiel.id, 'eigenesCockpit', eigen, now, now);
        ergebnis.push({ feldId: kennung, ctx: spiel.ctx, state: eigen, quelle: { art: 'eigenesCockpit' }, bekanntSeit });
        continue;
      }
      const server = serverSpiele.get(spiel.id);
      const state = server?.state ?? reduceMatch([], spiel.ctx).state;
      const bekanntSeit = merke(kennung, spiel.id, 'server', state, server?.geaendertAt ?? now, now);
      ergebnis.push({ feldId: kennung, ctx: spiel.ctx, state, quelle: { art: 'server', antwortAlterMs: antwortAlterMs(now) }, bekanntSeit });
    }
    return ergebnis;
  }

  function naechsterAbfrageTaktMs(planerTaktMs: number | null = null, now = deps.serverNow()): number {
    if (antwortAlterMs(now) > ANTWORT_MAX_ALTER_MS) {
      return TAKT_ANGEPFIFFEN_MS; // N-2: veraltete Antwort → sofort und eng nachfragen
    }
    const angepfiffen = [...aktuelleSpiele(now).values()].some((spiel) => {
      const state = eigenerStand(spiel.field, spiel.id) ?? serverSpiele.get(spiel.id)?.state;
      return istAngepfiffen(state?.status ?? spiel.status);
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
      fehlschlag(ergebnis);
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
    const aktuelle = [...aktuelleSpiele(now).values()].flatMap((spiel) => (spiel.ctx ? [spiel.ctx] : []));
    // ein neues aktuelles Spiel sofort abfragen, sonst im Takt
    const neuesSpiel = aktuelle.some((ctx) => !serverSpiele.has(ctx.matchId));
    if (!neuesSpiel && ereignisVersuchAt !== null && now - ereignisVersuchAt < naechsterAbfrageTaktMs(planerTaktMs, now)) {
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
        // neues aktuelles Spiel: Wasserstand 0, Stand ab dem leeren Log
        serverSpiele.set(ctx.matchId, { ctx, log: [], wasserstand: 0, state: reduceMatch([], ctx).state, geaendertAt: now });
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
    for (const [matchId, neu] of ergebnis.wert) {
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
      await ladeStaende(client, now, planerTaktMs);
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
    naechsterAbfrageTaktMs: (planerTaktMs = null) => naechsterAbfrageTaktMs(planerTaktMs),
    letzteAntwortAt: () => letzteAntwortAt,
    verfuegbarkeit: () => verfuegbar,
  };
}
