/**
 * MatchEngine (C3a-1): Orchestriert je Konto Store/Uhr/Sender/Nachladen und
 * liefert die Ansicht fuer den Lesepfad. Framework-frei (LAYERING), alle
 * Abhaengigkeiten injiziert.
 *
 * @see .superpowers/sdd/2026-09-26-pr-c-ausgang/task-C3a-brief.md (v2, Teil 1)
 */
import { computeView, type ViewCopy, type ViewResult } from './view';
import { type LocalMatchStore, type MatchCopy } from './LocalMatchStore';
import type { ClockSync } from './ClockSync';
import type { EngineEvent, MatchContext } from '../types';
import type { EngineEventWithSeq } from './catchUp';

/** Minimaler Ausschnitt von `OutboxSender`, den `MatchEngine` braucht (start/stop je Konto). */
export interface EngineSender {
  start(accountId: string): Promise<void>;
  stop(): void;
}

/** W10: injizierbarer Kanal fuer Mehrere-Tabs-Benachrichtigung; echte Umsetzung im Provider per `BroadcastChannel`. */
export interface MatchBroadcastChannel {
  postMessage(message: { matchId: string }): void;
  addEventListener(type: 'message', listener: (event: { data: { matchId: string } }) => void): void;
  close?(): void;
}

export interface MatchEngineDeps {
  store: LocalMatchStore;
  clock: ClockSync;
  sender: EngineSender;
  fetchConfirmed: (
    matchId: string,
    watermarkSeq: number,
  ) => Promise<{ events: EngineEventWithSeq[]; newWatermark: number }>;
  now: () => number;
  /** W10, optional (Provider haengt einen echten `BroadcastChannel` ein). */
  broadcast?: MatchBroadcastChannel;
}

export interface EngineMatchStatus {
  lastError: string | null;
  /** W2: Server-Stand weicht dauerhaft ab, kein weiterer `resetConfirmed`-Versuch. */
  divergent: boolean;
}

export interface MatchEngineView {
  result: ViewResult;
  log: EngineEvent[];
  /** Anzahl bestaetigter Ereignisse (Lesepfad-`version`, 1.3). */
  confirmedCount: number;
}

function engineMatchStatus(): EngineMatchStatus {
  return { lastError: null, divergent: false };
}

/** B2: bestaetigter Log (nach seq) + offene Eintraege ohne bereits bestaetigte IDs, in Einfuegereihenfolge. */
function buildLog(copy: MatchCopy): EngineEvent[] {
  const confirmedIds = new Set(copy.confirmed.map((event) => event.id));
  const seen = new Set<string>();
  const log: EngineEvent[] = [];
  for (const event of copy.confirmed) {
    log.push(event);
    seen.add(event.id);
  }
  for (const event of [...copy.acked, ...copy.pending]) {
    if (confirmedIds.has(event.id) || seen.has(event.id)) {
      continue;
    }
    seen.add(event.id);
    log.push(event);
  }
  return log;
}

export class MatchEngine {
  private accountId: string | null = null;
  private readonly copies = new Map<string, MatchCopy>();
  private readonly inFlightCatchUp = new Map<string, Promise<void>>();
  /** I2: waehrend ein `catchUp` laeuft eingegangene weitere Anfragen -- hoechstens EIN Nachzuegler
   * je Spiel (nicht gestapelt), s. `catchUp`. */
  private readonly rerunRequested = new Set<string>();
  /** I1/W3: Spiele, die die Sammelabfrage (oder ein spaeterer `catchUp`-Erfolg) als Engine-Spiel
   * erkannt hat -- `ensureMatch` selbst loest KEIN `catchUp` mehr aus (das war die W3-Verletzung),
   * nur `catchUpLoaded()` fuer qualifizierende Spiele. */
  private readonly knownEngineMatches = new Set<string>();
  /** W2: Schluessel (Anzahl bestaetigter Ereignisse + letzter seq), bei dem zuletzt zurueckgesetzt wurde. */
  private readonly resetOnce = new Map<string, string>();
  private readonly statusByMatch = new Map<string, EngineMatchStatus>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly deps: MatchEngineDeps) {
    this.deps.broadcast?.addEventListener('message', (event) => {
      void this.refreshCopy(event.data.matchId);
    });
  }

  async start(accountId: string): Promise<void> {
    this.accountId = accountId;
    this.copies.clear();
    this.statusByMatch.clear();
    this.resetOnce.clear();
    this.inFlightCatchUp.clear();
    await this.deps.sender.start(accountId);
  }

  /** Haelt an, loescht aber nichts (Ausgang/Kopien bleiben in IndexedDB). */
  stop(): void {
    this.deps.sender.stop();
  }

  /** I1: legt/aktualisiert nur die Kopie -- kein automatisches `catchUp` mehr (das war die
   * W3-Verletzung: eine Abfrage je Spiel bei JEDEM Laden, egal ob Engine-Spiel oder nicht). Wer
   * nachladen will, ruft nach der Sammelabfrage `markEngineMatches`/`catchUpLoaded` auf. */
  async ensureMatch(matchId: string, ctx: MatchContext, tournamentId?: string): Promise<void> {
    const accountId = this.requireAccount();
    await this.deps.store.create(accountId, matchId, ctx, tournamentId);
    await this.refreshCopy(matchId);
    this.announce(matchId);
  }

  /** I1/W3: als (Server-)Engine-Spiel markieren -- qualifiziert danach fuer `catchUpLoaded()`. */
  markEngineMatches(matchIds: Iterable<string>): void {
    for (const matchId of matchIds) {
      this.knownEngineMatches.add(matchId);
    }
  }

  /** I4: `catchUp` fuer alle geladenen Spiele, die dafuer qualifizieren (bekanntes Engine-Spiel ODER
   * offene eigene Eintraege) -- fuer `online` (Provider) und nach der Sammelabfrage (`useEngineMatches`). */
  async catchUpLoaded(): Promise<void> {
    const matchIds = [...this.copies.keys()].filter((matchId) => this.qualifiesForCatchUp(matchId));
    await Promise.all(matchIds.map((matchId) => this.catchUp(matchId)));
  }

  private qualifiesForCatchUp(matchId: string): boolean {
    if (this.knownEngineMatches.has(matchId)) {
      return true;
    }
    const copy = this.copies.get(matchId);
    return copy !== undefined && (copy.pending.length > 0 || copy.acked.length > 0);
  }

  /**
   * RC7: Nachladen ab Wasserstand. W3 Single-Flight MIT Nachzuegler (I2): ein laufender Aufruf wird
   * geteilt; waehrend er laeuft eingehende weitere Anfragen sammeln sich zu HOECHSTENS einem
   * zusaetzlichen Lauf danach (nicht gestapelt, aber auch nicht verloren -- ein Realtime-Push
   * waehrend die Abfrage schon unterwegs ist, geht so nicht unter).
   */
  async catchUp(matchId: string): Promise<void> {
    const existing = this.inFlightCatchUp.get(matchId);
    if (existing) {
      this.rerunRequested.add(matchId);
      return existing;
    }
    const run = this.runCatchUpWithRerun(matchId).finally(() => {
      this.inFlightCatchUp.delete(matchId);
    });
    this.inFlightCatchUp.set(matchId, run);
    return run;
  }

  private async runCatchUpWithRerun(matchId: string): Promise<void> {
    let runAgain = true;
    while (runAgain) {
      await this.runCatchUp(matchId);
      runAgain = this.rerunRequested.delete(matchId);
    }
  }

  private async runCatchUp(matchId: string, options?: { fromZero?: boolean }): Promise<void> {
    const accountId = this.requireAccount();
    if (accountId === 'guest') {
      return;
    }
    const copy = await this.deps.store.load(accountId, matchId);
    if (!copy) {
      return;
    }
    const watermark = options?.fromZero ? 0 : copy.watermarkSeq;
    try {
      const { events, newWatermark } = await this.deps.fetchConfirmed(matchId, watermark);
      if (events.length > 0 || newWatermark !== copy.watermarkSeq) {
        await this.deps.store.applyConfirmed(accountId, matchId, events, newWatermark);
      }
      await this.refreshCopy(matchId);
      this.setStatus(matchId, { lastError: null, divergent: this.statusFor(matchId).divergent });
      await this.checkNeedsFullReload(matchId);
      this.announce(matchId);
    } catch (error) {
      // Fehler wird als Status sichtbar gemacht, die Kopie bleibt unveraendert.
      this.setStatus(matchId, {
        lastError: error instanceof Error ? error.message : String(error),
        divergent: this.statusFor(matchId).divergent,
      });
      this.notify();
    }
  }

  /** W2: hoechstens ein `resetConfirmed` je Spiel/Stand, danach `divergent: true` statt Endlosschleife. */
  private async checkNeedsFullReload(matchId: string): Promise<void> {
    const view = this.view(matchId);
    if (!view?.result.needsFullReload) {
      return;
    }
    const copy = this.copies.get(matchId);
    if (!copy) {
      return;
    }
    const standKey = `${copy.confirmed.length}:${copy.watermarkSeq}`;
    if (this.resetOnce.get(matchId) === standKey) {
      this.setStatus(matchId, { lastError: this.statusFor(matchId).lastError, divergent: true });
      this.notify();
      return;
    }
    this.resetOnce.set(matchId, standKey);
    const accountId = this.requireAccount();
    await this.deps.store.resetConfirmed(accountId, matchId);
    await this.refreshCopy(matchId);
    await this.runCatchUp(matchId, { fromZero: true });
  }

  /** B2: `{ result, log }` aus der gecachten Kopie (computeView cacht selbst inkrementell, I7). */
  view(matchId: string): MatchEngineView | null {
    const copy = this.copies.get(matchId);
    if (!copy) {
      return null;
    }
    const viewCopy: ViewCopy = {
      accountId: copy.accountId,
      matchId: copy.matchId,
      confirmed: copy.confirmed,
      acked: copy.acked,
      pending: copy.pending,
    };
    return { result: computeView(viewCopy, copy.ctx), log: buildLog(copy), confirmedCount: copy.confirmed.length };
  }

  status(matchId: string): EngineMatchStatus {
    return this.statusFor(matchId);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  serverNow(): number {
    return this.deps.clock.serverNow();
  }

  private statusFor(matchId: string): EngineMatchStatus {
    return this.statusByMatch.get(matchId) ?? engineMatchStatus();
  }

  private setStatus(matchId: string, status: EngineMatchStatus): void {
    this.statusByMatch.set(matchId, status);
  }

  private async refreshCopy(matchId: string): Promise<void> {
    const accountId = this.requireAccount();
    const copy = await this.deps.store.load(accountId, matchId);
    if (copy) {
      this.copies.set(matchId, copy);
    } else {
      this.copies.delete(matchId);
    }
    this.notify();
  }

  /** W10: eigene Aenderung anderen Tabs melden (kein Echo im selben Kontext bei echtem `BroadcastChannel`). */
  private announce(matchId: string): void {
    this.deps.broadcast?.postMessage({ matchId });
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private requireAccount(): string {
    if (this.accountId === null) {
      throw new Error('MatchEngine.start(accountId) wurde nicht aufgerufen');
    }
    return this.accountId;
  }
}
