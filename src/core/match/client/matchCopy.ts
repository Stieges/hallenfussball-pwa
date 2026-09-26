/**
 * Form der lokalen Spielkopie (RC6, PC7) und reine Uebergaenge an ihren Listen.
 * `LocalMatchStore` kapselt nur noch die Transaktionen darum.
 */
import type { EngineEvent, MatchContext } from '../types';
import type { EngineEventWithSeq } from './catchUp';

/** Record-Format 2 (C2a): mit `rejected`, `review` und optionalem `tournamentId`. */
export const MATCH_COPY_FORMAT_VERSION = 2;

export interface RejectedEntry {
  event: EngineEvent;
  code: string;
  detail?: unknown;
  /** Wanduhr-Zeit der Ablehnung (D-C1, Klartext spaeter in C2b). */
  rejectedAt: number;
}

export interface MatchCopy {
  formatVersion: number;
  accountId: string;
  matchId: string;
  /** Turnier zur Zaehlung je Turnier (PC8); fehlt, zaehlt der Kopien-Schluessel ''. */
  tournamentId?: string;
  ctx: MatchContext;
  /** Bestaetigte Ereignisse mit Server-`seq` (Wasserstand). */
  confirmed: EngineEventWithSeq[];
  watermarkSeq: number;
  /** Vom Server bestaetigt, noch nicht nachgeladen (V3). */
  acked: EngineEvent[];
  /** Offener Ausgang (RC1): ohne `seq` (N5). */
  pending: EngineEvent[];
  /** Ablehnungsliste (D-C1). */
  rejected: RejectedEntry[];
  /** „wartet auf Turnierleitung" -- der Server liefert `review` erst ab F. */
  review: EngineEvent[];
  updatedAt: number;
}

/** Form einer Kopie vor C2a (DB-Version 1) -- ohne `rejected`/`review`/`tournamentId`. */
export type LegacyMatchCopy = Omit<MatchCopy, 'formatVersion' | 'rejected' | 'review'> & {
  formatVersion: number;
  rejected?: RejectedEntry[];
  review?: EngineEvent[];
};

/** Schluessel der Kopie (PC7): Konto und Spiel, Ereignis-ID eindeutig. */
export function matchCopyKey(accountId: string, matchId: string): string {
  return `${accountId}|${matchId}`;
}

/** Bringt eine alte Kopie auf das aktale Record-Format, ohne etwas zu verlieren. */
export function normalizeCopy(value: LegacyMatchCopy): MatchCopy {
  return {
    ...value,
    formatVersion: MATCH_COPY_FORMAT_VERSION,
    rejected: value.rejected ?? [],
    review: value.review ?? [],
  };
}

export interface BatchResolution {
  ackedIds: string[];
  rejected: RejectedEntry[];
  reviewIds: string[];
}

/** pending -> acked/rejected/review in einem Schritt (V3), Reihenfolge der Listen bleibt. */
export function applyResolution(copy: MatchCopy, resolution: BatchResolution): void {
  const ackedIds = new Set(resolution.ackedIds);
  const reviewIds = new Set(resolution.reviewIds);
  const rejectedIds = new Set(resolution.rejected.map((entry) => entry.event.id));
  const stillPending: EngineEvent[] = [];
  const movedAcked: EngineEvent[] = [];
  const movedReview: EngineEvent[] = [];
  for (const event of copy.pending) {
    if (ackedIds.has(event.id)) {
      movedAcked.push(event);
    } else if (reviewIds.has(event.id)) {
      movedReview.push(event);
    } else if (!rejectedIds.has(event.id)) {
      stillPending.push(event);
    }
  }
  const known = new Set(copy.pending.map((event) => event.id));
  copy.pending = stillPending;
  copy.acked = copy.acked.concat(movedAcked);
  copy.review = copy.review.concat(movedReview);
  copy.rejected = copy.rejected.concat(resolution.rejected.filter((entry) => known.has(entry.event.id)));
  copy.updatedAt = Date.now();
}

/** Alle offenen Eintraege ablehnen (54000 „Spiel voll", 55000 „Spiel weg"). */
export function rejectAllPendingEntries(copy: MatchCopy, code: string, rejectedAt: number): void {
  const entries: RejectedEntry[] = copy.pending.map((event) => ({ event, code, rejectedAt }));
  copy.pending = [];
  copy.rejected = copy.rejected.concat(entries);
  copy.updatedAt = Date.now();
}

/** „Verstanden" (D-C1): bestaetigte Ablehnungen aus der Liste nehmen. */
export function dismissRejectedEntries(copy: MatchCopy, ids: string[]): void {
  const dismissed = new Set(ids);
  copy.rejected = copy.rejected.filter((entry) => !dismissed.has(entry.event.id));
  copy.updatedAt = Date.now();
}
