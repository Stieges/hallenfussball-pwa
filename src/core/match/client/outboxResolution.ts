/**
 * Zuordnung Server-Ergebnis -> lokale Uebergaenge (C2a): die Ergebnisse kommen je
 * gesendetem Ereignis in derselben Reihenfolge, zugeordnet wird ueber den INDEX
 * (`id` ist nur zur Kontrolle). Dazu die Folgeablehnung B3 (ueber Stapelgrenzen)
 * und W4 (Eintrag zeigt mit `targetId` auf einen Abgelehnten).
 */
import type { AppendEventResult } from '../../repositories/appendMatchEventsRpc';
import type { EngineEvent } from '../types';
import type { BatchResolution, RejectedEntry } from './matchCopy';

/** B3: nach diesen abgelehnten Typen reissen alle uebrigen pending mit (RC8). */
const CASCADE_TYPES = new Set(['MATCH_START', 'RESUME', 'SECTION_START', 'REOPEN', 'UNSKIP']);

export const DEPENDS_ON_REJECTED = 'DEPENDS_ON_REJECTED';

/** Server lehnt ab, ohne Code zu nennen (Umschlag unlesbar) -- nicht still verwerfen. */
const FALLBACK_CODE = 'UNKNOWN';

/**
 * Baut den Stapel-Uebergang fuer GENAU einen Aufruf. `pending` ist die vollstaendige
 * Ausgangsliste der Kopie VOR dem Senden -- alles ausserhalb `batch` wird bei B3/W4
 * mit abgelehnt. Wasserstand und `confirmed` bleiben unberuehrt.
 */
export function buildResolution(
  batch: EngineEvent[],
  results: AppendEventResult[],
  pending: readonly EngineEvent[],
  now: number,
): BatchResolution {
  if (results.length !== batch.length) {
    throw new Error(`append_match_events: ${results.length} Ergebnisse fuer ${batch.length} Ereignisse`);
  }
  const sentIds = new Set(batch.map((event) => event.id));
  const rejectedIds = new Set<string>();
  for (let i = 0; i < batch.length; i += 1) {
    if (results[i].status === 'rejected') {
      rejectedIds.add(batch[i].id);
    }
  }

  const ackedIds: string[] = [];
  const reviewIds: string[] = [];
  const rejected: RejectedEntry[] = [];
  for (let i = 0; i < batch.length; i += 1) {
    const event = batch[i];
    const result = results[i];
    if (result.status === 'accepted' || result.status === 'duplicate' || result.status === 'noop') {
      ackedIds.push(event.id);
      continue;
    }
    if (result.status === 'review') {
      reviewIds.push(event.id);
      continue;
    }
    // W4: Ziel-Verweis auf einen im selben Lauf abgelehnten Eintrag -> mit ihm gruppiert.
    const depends = typeof event.targetId === 'string' && rejectedIds.has(event.targetId);
    rejected.push({
      event,
      code: depends ? DEPENDS_ON_REJECTED : (result.code ?? FALLBACK_CODE),
      ...(result.detail !== undefined ? { detail: result.detail } : {}),
      rejectedAt: now,
    });
  }

  // B3: ein abgelehnter Start-/Freigabe-Typ reisst ALLE uebrigen pending mit -- auch
  // die, die noch gar nicht gesendet wurden. W4 greift auch ohne B3 (Ziel-Verweis).
  const cascade = batch.some((event) => rejectedIds.has(event.id) && CASCADE_TYPES.has(event.type));
  for (const event of pending) {
    if (sentIds.has(event.id)) {
      continue;
    }
    const depends = typeof event.targetId === 'string' && rejectedIds.has(event.targetId);
    if (!cascade && !depends) {
      continue;
    }
    rejectedIds.add(event.id);
    rejected.push({ event, code: DEPENDS_ON_REJECTED, rejectedAt: now });
  }

  return { ackedIds, rejected, reviewIds };
}
