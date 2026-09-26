/**
 * OutboxSender (C2a, RC8/RC9, V8/V10): schickt den Ausgang je Spiel in Stapeln
 * (≤ 50, Einfuegereihenfolge, nur `pending`) und behandelt jede Ergebnis- und
 * Fehlerklasse. Je Spiel eine eigene Warteschlange mit eigenem Backoff (RC8).
 * Der Sender aendert `watermarkSeq`/`confirmed` nie -- nach angenommenen Eintraegen
 * ruft er nur `requestCatchUp(matchId)` auf (das Nachladen verdrahtet C3).
 */
import { isClientOutdated } from '../../repositories/appendMatchEventsRpc';
import { MatchQueue } from './matchQueue';
import { matchCopyKey } from './matchCopy';
import { OutboxStatusBook } from './outboxStatus';
import { buildResolution } from './outboxResolution';
import type { OutboxApi, OutboxPause, OutboxSenderDeps, OutboxStatus, OutboxTimers } from './outboxTypes';
import type { LocalMatchStore } from './LocalMatchStore';
import { classifySendFailure } from './sendErrors';

/** V10: Stapel ≤ 50 (der Server laesst bis 200 zu). */
const BATCH_LIMIT = 50;
const NOT_READY_RETRY_MS = 60000;
const PERMANENT_RETRY_MS = 30000;
const MATCH_FULL_CODE = 'MATCH_FULL';
const MATCH_GONE_CODE = 'MATCH_GONE';

type BatchOutcome = 'continue' | 'done' | 'halt';

export class OutboxSender {
  private readonly store: LocalMatchStore;
  private readonly api: OutboxApi;
  private readonly clientFormat: number;
  private readonly deviceId: string | undefined;
  private readonly timers: OutboxTimers;
  private readonly now: () => number;
  private readonly requestCatchUp: (matchId: string) => void;
  private readonly book = new OutboxStatusBook();

  private accountId: string | null = null;
  private started = false;
  private readonly queues = new Map<string, MatchQueue>();

  constructor(deps: OutboxSenderDeps) {
    this.store = deps.store;
    this.api = deps.api;
    this.clientFormat = deps.clientFormat;
    this.deviceId = deps.deviceId;
    this.timers = deps.timers;
    this.now = deps.now;
    this.requestCatchUp = deps.requestCatchUp;
  }

  /** Startet fuer ein Konto (D-C2: andere Konten bleiben unangetastet). Gast tut nichts (V14). */
  async start(accountId: string): Promise<void> {
    this.haltAll();
    this.queues.clear();
    this.accountId = accountId;
    this.started = true;
    this.book.set({ clientOutdated: false });
    if (accountId === 'guest') {
      await this.refresh();
      return;
    }
    await this.book.ensurePersistentStorage();
    await this.kick();
  }

  /** Haelt an und loescht nichts -- weder Eintraege noch andere Konten (D-C2). */
  stop(): void {
    this.started = false;
    this.haltAll();
    this.queues.clear();
    this.book.set({ pausedMatches: {} });
  }

  /** Sofort senden („neuer Eintrag", „wieder online") -- hebt eine Backoff-Pause auf. */
  async kick(matchId?: string): Promise<void> {
    if (!this.started || this.isGuest()) {
      return;
    }
    await this.refresh();
    const queues =
      matchId !== undefined
        ? [this.queueFor(matchId)]
        : (await this.store.forAccount(this.accountId ?? ''))
            .filter((copy) => copy.pending.length > 0)
            .map((copy) => this.queueFor(copy.matchId));
    for (const queue of queues) {
      if (queue.pause === 'backoff') {
        queue.clearPause();
      }
    }
    await Promise.all(queues.map((queue) => this.pump(queue)));
  }

  /** V8: hebt die notReady-Pause eines Spiels auf (22023, Teams offen). */
  async notifyMatchChanged(matchId: string): Promise<void> {
    if (!this.started || this.isGuest()) {
      return;
    }
    const queue = this.queues.get(matchId);
    if (queue?.pause !== 'notReady') {
      return;
    }
    queue.clearPause();
    await this.pump(queue);
  }

  /** RC9: weiter nach `TOKEN_REFRESHED`/`SIGNED_IN` desselben Kontos (ruft C3 auf). */
  async resumeAuth(): Promise<void> {
    if (!this.book.authRequired) {
      return;
    }
    this.book.set({ authRequired: false });
    await this.kick();
  }

  getStatus(): OutboxStatus {
    return this.book.getStatus();
  }

  subscribe(listener: (status: OutboxStatus) => void): () => void {
    return this.book.subscribe(listener);
  }

  private isGuest(): boolean {
    return this.accountId === 'guest';
  }

  private canSend(): boolean {
    return this.started && !this.isGuest() && !this.book.authRequired && !this.book.clientOutdated;
  }

  private queueFor(matchId: string): MatchQueue {
    const existing = this.queues.get(matchId);
    if (existing) {
      return existing;
    }
    const queue = new MatchQueue(matchId, matchCopyKey(this.accountId ?? '', matchId), this.timers, (next) =>
      this.pump(next),
    );
    this.queues.set(matchId, queue);
    return queue;
  }

  /** Startet die Warteschlange eines Spiels (hoestens ein Aufruf gleichzeitig). */
  private pump(queue: MatchQueue): Promise<void> {
    queue.wantsRun = true;
    if (queue.running) {
      return queue.running;
    }
    const run = (async () => {
      while (queue.wantsRun) {
        queue.wantsRun = false;
        if (!this.canSend() || queue.pause !== null) {
          break;
        }
        const outcome = await this.sendOneBatch(queue);
        if (outcome === 'halt') {
          break;
        }
        if (outcome === 'continue') {
          // Stapel war dran -- weiter, solange pending nachgelegt ist.
          queue.wantsRun = true;
        }
      }
    })()
      .catch(() => undefined)
      .then(() => {
        queue.running = null;
        return queue.wantsRun ? this.pump(queue) : undefined;
      });
    queue.running = run;
    return run;
  }

  private async sendOneBatch(queue: MatchQueue): Promise<BatchOutcome> {
    try {
      return await this.tryOneBatch(queue);
    } catch (error) {
      try {
        return await this.handleFailure(queue, error);
      } catch {
        // Speicherfehler o. a.: Eintraege bleiben pending, spaeterer Versuch.
        this.book.set({ lastError: classifySendFailure(error).message });
        queue.scheduleRetry('backoff', PERMANENT_RETRY_MS);
        return 'done';
      }
    }
  }

  private async tryOneBatch(queue: MatchQueue): Promise<BatchOutcome> {
    const copy = await this.store.load(this.accountId ?? '', queue.matchId);
    if (!copy || copy.pending.length === 0) {
      return 'done';
    }
    const batch = copy.pending.slice(0, BATCH_LIMIT);
    const result = await this.api.appendMatchEvents(queue.matchId, batch, {
      clientFormat: this.clientFormat,
      ...(this.deviceId !== undefined ? { deviceId: this.deviceId } : {}),
    });
    if (isClientOutdated(result)) {
      // Die neue App sendet dieselben IDs erneut -- bis `start()` neu nichts tun.
      this.haltAll();
      this.book.set({ clientOutdated: true });
      await this.refresh();
      return 'halt';
    }
    // Zuordnung ueber den Index (id nur zur Kontrolle), alles in einer Transaktion.
    const resolution = buildResolution(batch, result.results, copy.pending, this.now());
    await this.store.resolveBatch(queue.key, resolution);
    queue.resetBackoff();
    this.book.set({ lastError: null });
    if (resolution.ackedIds.length > 0) {
      this.requestCatchUp(queue.matchId);
    }
    await this.refresh();
    return 'continue';
  }

  private async handleFailure(queue: MatchQueue, error: unknown): Promise<BatchOutcome> {
    const failure = classifySendFailure(error);
    this.book.set({ lastError: failure.message });
    switch (failure.kind) {
      case 'auth': {
        this.haltAll();
        this.book.set({ authRequired: true });
        await this.refresh();
        return 'halt';
      }
      case 'notReady': {
        // V8: nur dieses Spiel, Eintraege werden NICHT abgelehnt.
        queue.scheduleRetry('notReady', NOT_READY_RETRY_MS);
        await this.refresh();
        return 'done';
      }
      case 'matchFull':
      case 'matchGone': {
        await this.store.rejectAllPending(queue.key, failure.kind === 'matchFull' ? MATCH_FULL_CODE : MATCH_GONE_CODE);
        await this.refresh();
        return 'continue';
      }
      case 'transient': {
        queue.scheduleRetry('backoff', queue.takeBackoffMs());
        await this.refresh();
        return 'done';
      }
      case 'permanent': {
        queue.scheduleRetry('backoff', PERMANENT_RETRY_MS);
        await this.refresh();
        return 'done';
      }
    }
  }

  /** Haelt alle Warteschlangen an (auth, CLIENT_OUTDATED) -- Eintraege bleiben pending. */
  private haltAll(): void {
    for (const queue of this.queues.values()) {
      queue.clearPause();
    }
  }

  private async refresh(): Promise<void> {
    const pausedMatches: Record<string, OutboxPause> = {};
    for (const queue of this.queues.values()) {
      if (queue.pause !== null) {
        pausedMatches[queue.matchId] = queue.pause;
      }
    }
    await this.book.countCopies(this.store, this.accountId, pausedMatches);
  }
}
