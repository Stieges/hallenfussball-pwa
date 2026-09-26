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
 * Fixrunde 1, Minor (c): haengt einen Verweis auf den AUSLOESENDEN Eintrag an, ohne
 * einen vorhandenen `detail`-Wert zu verlieren. Server-Codes werden nie ueberschrieben --
 * dieser Verweis dient nur der Erklaerung ("wegen welchem Eintrag").
 */
function withDependsOn(detail: unknown, dependsOnEventId: string | undefined): unknown {
  if (dependsOnEventId === undefined) {
    return detail;
  }
  const base = typeof detail === 'object' && detail !== null ? detail : {};
  return { ...base, dependsOnEventId };
}

/** Fixrunde 2, M-f: Position i traegt eine (nicht-null) `id`, die von `batch[i].id` abweicht. */
export interface IdMismatch {
  index: number;
  expectedId: string;
  receivedId: string;
}

export interface BuildResolutionOutput {
  resolution: BatchResolution;
  /** Nichts wird deswegen anders zugeordnet (Index bleibt massgeblich) -- nur sichtbar gemacht. */
  idMismatches: IdMismatch[];
}

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
): BuildResolutionOutput {
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
  // M-f: `id` ist laut Brief "nur zur Kontrolle" -- zugeordnet wird IMMER ueber den Index
  // (siehe I2b), aber eine Abweichung ist wahrscheinlich ein Serverfehler und darf nicht
  // still verworfen werden.
  const idMismatches: IdMismatch[] = [];
  for (let i = 0; i < batch.length; i += 1) {
    const receivedId = results[i].id;
    if (receivedId !== null && receivedId !== batch[i].id) {
      idMismatches.push({ index: i, expectedId: batch[i].id, receivedId });
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
    // result.status === 'rejected': der Server hat DIESEN Eintrag beantwortet -- sein
    // Code bleibt IMMER erhalten (Minor c/Fixrunde 1). W4 (Ziel-Verweis auf einen im
    // selben Lauf abgelehnten Eintrag) haengt nur einen Verweis in `detail` an.
    const dependsOnEventId =
      typeof event.targetId === 'string' && rejectedIds.has(event.targetId) ? event.targetId : undefined;
    const detail = withDependsOn(result.detail, dependsOnEventId);
    rejected.push({
      event,
      code: result.code ?? FALLBACK_CODE,
      ...(detail !== undefined ? { detail } : {}),
      rejectedAt: now,
    });
  }

  // B3: ein abgelehnter Start-/Freigabe-Typ reisst ALLE uebrigen pending mit -- auch
  // die, die noch gar nicht gesendet wurden. W4 greift auch ohne B3 (Ziel-Verweis).
  // Diese Eintraege wurden nie gesendet -- es gibt keinen Server-Code zu erhalten,
  // aber `detail` verweist auf den auslösenden Eintrag (Minor c/Fixrunde 1).
  const cascadeRoot = batch.find((event) => rejectedIds.has(event.id) && CASCADE_TYPES.has(event.type));
  for (const event of pending) {
    if (sentIds.has(event.id)) {
      continue;
    }
    const dependsOnEventId =
      typeof event.targetId === 'string' && rejectedIds.has(event.targetId) ? event.targetId : cascadeRoot?.id;
    if (dependsOnEventId === undefined) {
      continue;
    }
    rejectedIds.add(event.id);
    rejected.push({ event, code: DEPENDS_ON_REJECTED, detail: { dependsOnEventId }, rejectedAt: now });
  }

  return { resolution: { ackedIds, rejected, reviewIds }, idMismatches };
}
