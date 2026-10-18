/**
 * A-08f3c2 Regel Q (Plan `task-A-08f3-plan.md` v4 § 2.3, Review v2 § 4 Nr. 3 (c)–(e)): Wann darf eine ganze Cloud-Kopie
 * die lokale Kopie eines Turniers ersetzen? Nur wenn vor UND nach dem Lesen nichts Eigenes wartet (Warteschlange oder
 * gerade laufendes Schreiben), der Abschluss-Zähler gleich geblieben ist (H1: ein während des Lesens gesendeter Eintrag
 * fehlt in der gelesenen Kopie) und kein geschützter Eintrag des Turniers im Dead-Letter liegt (H2: bis „verworfen“ oder
 * erfolgreich wiederholt). Sonst nur der Feldweg; der nächste Takt versucht es still neu (kein Hinweis).
 * Anforderungen: @FU-002, @FU-004, @TM-027 (`docs/anforderungen/…`).
 */
import type { MutationType } from '../services/MutationQueue';

/** Lesesicht der Warteschlange (Bereich = Turnier-ID). */
export interface QueueProgress {
  completedCount(scope: string): number;
  hasPending(scope: string): boolean;
  hasFailed(scope: string, types: readonly MutationType[]): boolean;
}

/** Dead-Letter-Einträge, die die lokale Kopie schützen (Spielplan-Spalten, Metadaten, ganzes Turnier). */
export const PROTECTED_DEAD_LETTER: readonly MutationType[] = ['SAVE_TOURNAMENT', 'UPDATE_TOURNAMENT_METADATA', 'UPDATE_MATCHES', 'UPDATE_MATCH'];

export interface QueueSnapshot {
  busy: boolean;
  completed: number;
}

export class CloudQueueGuard {
  /** Eigene Schreibvorgänge, die lokal laufen und noch nicht in der Warteschlange stehen. */
  private readonly writes = new Map<string, number>();

  constructor(private readonly queue: QueueProgress) {}

  /** Lokales Schreiben + Einreihen als eine Einheit (zwischen beiden darf keine ganze Kopie übernommen werden). */
  async track<T>(tournamentId: string, write: () => Promise<T>): Promise<T> {
    this.writes.set(tournamentId, (this.writes.get(tournamentId) ?? 0) + 1);
    try {
      return await write();
    } finally {
      this.writes.set(tournamentId, (this.writes.get(tournamentId) ?? 1) - 1);
    }
  }

  /** Vor dem Lesen merken. */
  snapshot(tournamentId: string): QueueSnapshot {
    return { busy: this.busy(tournamentId), completed: this.queue.completedCount(tournamentId) };
  }

  /** Im Kettenschritt der Übernahme (M3): ganze Kopie nur, wenn Q erfüllt ist. */
  mayAdoptWhole(tournamentId: string, before: QueueSnapshot): boolean {
    return !before.busy
      && !this.busy(tournamentId)
      && this.queue.completedCount(tournamentId) === before.completed
      && !this.queue.hasFailed(tournamentId, PROTECTED_DEAD_LETTER);
  }

  private busy(tournamentId: string): boolean {
    return (this.writes.get(tournamentId) ?? 0) > 0 || this.queue.hasPending(tournamentId);
  }
}
