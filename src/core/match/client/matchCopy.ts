/**
 * Form der lokalen Spielkopie (RC6, PC7) und reine Uebergaenge an ihren Listen.
 * `LocalMatchStore` kapselt nur noch die Transaktionen darum.
 */
import { ERROR_CODES, type EngineEvent, type MatchContext } from '../types';
import type { EngineEventWithSeq } from './catchUp';

/** Code fuer eine per Kaskade abgelehnte Folge (B3) -- selbe Quelle wie `outboxResolution.ts`. */
const DEPENDS_ON_REJECTED = ERROR_CODES.DEPENDS_ON_REJECTED;

/** Record-Format 2 (C2a): mit `rejected`, `review` und optionalem `tournamentId`. */
export const MATCH_COPY_FORMAT_VERSION = 2;

/** B-50: Grund einer Server-Antwort `review`; `change` nur bei `RIGHTS_REVOKED` (revoked | removed | watch_only). */
export interface ReviewReason {
  code: string;
  change?: string;
}

/** Grund des Servers für „an die Turnierleitung übergeben“ (@HE-056, @FU-017, @HE-080). */
export const RIGHTS_REVOKED = 'RIGHTS_REVOKED';

/**
 * B-50 Review M2: Hat das Gerät das Schreibrecht zurück, sind die übergebenen Einträge (`RIGHTS_REVOKED`) als übergeben
 * abgeschlossen – sie liegen in Ollis Klärungsliste, das Gerät führt sie nicht weiter. Andere Klärungseinträge bleiben.
 */
export function closeHandedOverEntries(copy: MatchCopy): void {
  const reasons = copy.reviewReasons ?? {};
  const handedOver = new Set(copy.review.filter((event) => reasons[event.id]?.code === RIGHTS_REVOKED).map((event) => event.id));
  if (handedOver.size === 0) {
    return;
  }
  copy.review = copy.review.filter((event) => !handedOver.has(event.id));
  copy.reviewReasons = Object.fromEntries(Object.entries(reasons).filter(([id]) => !handedOver.has(id)));
  copy.updatedAt = Date.now();
}

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
  /** „wird geprüft" -- der Server liefert `review` erst ab F. */
  review: EngineEvent[];
  /** B-50: Grund des Servers je Eintrag in `review` (z. B. `RIGHTS_REVOKED` mit Art `watch_only`, @HE-056, @FU-017). */
  reviewReasons?: Record<string, ReviewReason>;
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

/**
 * C3a-0, M-b: Kaskade eines abgelehnten B3-/W4-Ausloesers, angewendet auf den
 * Bestand ZUM COMMIT-ZEITPUNKT (`copy.pending` in `applyResolution`) statt auf
 * den Schnappschuss vor dem Senden -- ein waehrend des Aufrufs per `addPending`
 * neu hinzugekommener Eintrag reisst sonst nicht mit.
 */
export interface CascadeInfo {
  /** IDs, die in DIESEM Aufruf abgelehnt wurden (W4-Zielverweis). */
  rejectedIds: string[];
  /** Ausloesender Eintrag eines B3-Kaskadentyps (MATCH_START/RESUME/...), falls vorhanden. */
  rootId?: string;
  rejectedAt: number;
}

export interface BatchResolution {
  ackedIds: string[];
  rejected: RejectedEntry[];
  reviewIds: string[];
  /** B-50: Grund des Servers je Eintrag in `reviewIds`. */
  reviewReasons?: Record<string, ReviewReason>;
  /** A-08b3 (B2, @FU-070): Server-Antwort `noop` -- Eintrag wird aus `pending` entfernt, nicht `acked`. */
  droppedIds?: string[];
  cascade?: CascadeInfo;
}

/** pending -> acked/rejected/review in einem Schritt (V3), Reihenfolge der Listen bleibt. */
export function applyResolution(copy: MatchCopy, resolution: BatchResolution): void {
  const ackedIds = new Set(resolution.ackedIds);
  const reviewIds = new Set(resolution.reviewIds);
  const droppedIds = new Set(resolution.droppedIds ?? []);
  const explicitRejected = new Map(resolution.rejected.map((entry) => [entry.event.id, entry]));
  const cascade = resolution.cascade;
  const cascadeRejectedIds = cascade !== undefined ? new Set(cascade.rejectedIds) : null;
  const presentIds = new Set(copy.pending.map((event) => event.id));
  const stillPending: EngineEvent[] = [];
  const movedAcked: EngineEvent[] = [];
  const movedReview: EngineEvent[] = [];
  const cascaded: RejectedEntry[] = [];
  for (const event of copy.pending) {
    if (ackedIds.has(event.id)) {
      movedAcked.push(event);
      continue;
    }
    if (reviewIds.has(event.id)) {
      movedReview.push(event);
      continue;
    }
    if (droppedIds.has(event.id)) {
      continue;
    }
    if (explicitRejected.has(event.id)) {
      continue;
    }
    if (cascade !== undefined) {
      const dependsOnEventId =
        typeof event.targetId === 'string' && cascadeRejectedIds?.has(event.targetId)
          ? event.targetId
          : cascade.rootId;
      if (dependsOnEventId !== undefined) {
        cascaded.push({
          event,
          code: DEPENDS_ON_REJECTED,
          detail: { dependsOnEventId },
          rejectedAt: cascade.rejectedAt,
        });
        continue;
      }
    }
    stillPending.push(event);
  }
  copy.pending = stillPending;
  copy.acked = copy.acked.concat(movedAcked);
  copy.review = copy.review.concat(movedReview);
  if (movedReview.length > 0 && resolution.reviewReasons) {
    const reasons = { ...(copy.reviewReasons ?? {}) };
    for (const event of movedReview) {
      const reason = resolution.reviewReasons[event.id];
      if (reason !== undefined) {
        reasons[event.id] = reason;
      }
    }
    copy.reviewReasons = reasons;
  }
  copy.rejected = copy.rejected.concat(
    resolution.rejected.filter((entry) => presentIds.has(entry.event.id)),
    cascaded,
  );
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
