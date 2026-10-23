/**
 * Eine Spiel-Warteschlange des Ausgangs (C2a, RC8): je Spiel ein eigener Lauf,
 * eigener Backoff und eine eigene Pause -- ein haengendes Spiel blockiert kein anderes.
 * Die Warteschlange gehoert zu genau einem Konto (`accountId`, Fixrunde 1 I1): sie wird
 * beim Start/Stop/Kontowechsel NICHT verworfen, solange ein Lauf noch aussteht -- sonst
 * koennte ein zweiter, unabhaengiger Lauf fuer dasselbe Spiel entstehen.
 */
import { backoffMsFor } from '../../utils/syncRetryTiming';
import type { OutboxPause, OutboxTimers, TimeoutHandle } from './outboxTypes';

/** 1, 2, 5, 5, 5 ... s (F4-Zusatz, Fundament L76/L157) -- zaehlt nicht als Fehlversuch, Erfolg setzt zurueck. */

export class MatchQueue {
  running: Promise<void> | null = null;
  wantsRun = false;
  pause: OutboxPause | null = null;
  private timer: TimeoutHandle | null = null;
  private backoffStep = 0;

  constructor(
    readonly matchId: string,
    readonly key: string,
    /** Konto, fuer das diese Warteschlange angelegt wurde (I1) -- unveraenderlich. */
    readonly accountId: string,
    private readonly timers: OutboxTimers,
    /** Startet den naechsten Versuch (Rueckruf des Senders, darf asynchron sein). */
    private readonly onRetry: (queue: MatchQueue) => Promise<void>,
  ) {}

  /** Naechster Wert der Folge 1, 2, 5, 5, 5 ... s (F4-Zusatz, Fundament L76/L157) und einen Schritt weiter. */
  takeBackoffMs(): number {
    const ms = backoffMsFor(this.backoffStep);
    this.backoffStep += 1;
    return ms;
  }

  resetBackoff(): void {
    this.backoffStep = 0;
  }

  /** Haelt die Warteschlange bis zum naechsten Versuch an (Grund im Status). */
  scheduleRetry(kind: OutboxPause, ms: number): void {
    this.clearPause();
    this.pause = kind;
    this.timer = this.timers.setTimeout(() => {
      this.clearPause();
      return this.onRetry(this);
    }, ms);
  }

  clearPause(): void {
    if (this.timer !== null) {
      this.timers.clearTimeout(this.timer);
      this.timer = null;
    }
    this.pause = null;
  }
}
