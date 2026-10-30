/**
 * Monitor im selben Browser bei einem Turnier nur auf diesem Gerät (R5 PR 1, @ZM-179; Daniel 2026-10-29 F3: Zusage
 * „höchstens 1 Sekunde“ nur für einen Monitor im selben Browser).
 *
 * - Stand: Die Einträge eines solchen Turniers liegen nicht in der Turnierkopie, sondern in den Engine-Kopien
 *   (IndexedDB `hallenfussball-matches`). Ohne sie sah der Monitor kein Tor (Spike 29.10., Report R5-1). Der Monitor
 *   legt sie deshalb wie die Verwaltung (`applyEngineOverlay`) über die Turnierkopie – nur lesend.
 * - Signal: Die Engine meldet jede geänderte Kopie über den `BroadcastChannel` an andere Tabs (W10); dazu das
 *   `storage`-Ereignis (Speicher-Rückfall ohne IndexedDB). Beides löst nur einen Abruf aus.
 */
import { BROADCAST_CHANNELS } from '../../constants/storage';
import {
  applyEngineOverlay,
  engineOverlayFields,
  LocalMatchStore,
  viewOfCopy,
  type EngineOverlayFields,
  type MatchCopy,
  type MatchEngineView,
} from '../../core/match/client';
import type { Tournament } from '../../types/tournament';

/** Quelle der Engine-Kopien (Tests geben einen Ersatz). */
export interface LocalCopySource {
  all(): Promise<MatchCopy[]>;
}

let defaultSource: LocalCopySource | null = null;

/** Optionen der Überlagerung. */
export interface LocalOverlayOptions {
  /**
   * @ZM-180 (L2b): nur vom Server bestätigte Einträge (`confirmed`, `acked`), keine wartenden. Für ein Turnier, das der
   * Server kennt: Dann ist der Monitor lokal nie weiter als der Server und springt beim Wechsel auf die Cloud nicht von
   * einem lokalen „Endstand“ auf einen älteren Server-Stand zurück. Ein Turnier nur auf diesem Gerät (@ZM-179) zeigt
   * weiter auch die wartenden Einträge sofort.
   */
  onlyConfirmed?: boolean;
}

/**
 * @ZM-180: Kennt der Server das Turnier? Ja, wenn die lokale Kopie eine Änderungszählung der Cloud trägt
 * (`changeRevision`, nur ein Cloud-Abruf setzt sie, A-10) oder eine Kette eigener bestätigter Uploads (`ownUploadsFrom`,
 * nur `confirmUpload` setzt sie) – dieselbe Regel wie `knownFromCloud` der Warteschlange (BP-1, @FU-123).
 */
export function isKnownToServer(tournament: Pick<Tournament, 'changeRevision' | 'ownUploadsFrom'>): boolean {
  return tournament.changeRevision !== undefined || tournament.ownUploadsFrom !== undefined;
}

interface Candidate {
  view: MatchEngineView;
  fields: EngineOverlayFields;
  updatedAt: number;
}

const TERMINAL: ReadonlySet<EngineOverlayFields['matchStatus']> = new Set(['finished', 'skipped']);

/**
 * @ZM-180 (L2a): Welche Kopie eines Spiels zeigt den weiteren Fortschritt? Beendet (bzw. ausgefallen) vor laufend, sonst
 * der längere Verlauf; `updatedAt` nur bei Gleichstand – ein bloßes Öffnen der Kopie durch ein anderes Konto setzt es neu.
 */
function isFurther(candidate: Candidate, held: Candidate): boolean {
  const doneCandidate = TERMINAL.has(candidate.fields.matchStatus);
  if (doneCandidate !== TERMINAL.has(held.fields.matchStatus)) {
    return doneCandidate;
  }
  if (candidate.view.log.length !== held.view.log.length) {
    return candidate.view.log.length > held.view.log.length;
  }
  return candidate.updatedAt > held.updatedAt;
}

/**
 * Turnierkopie mit dem Stand der Engine-Kopien dieses Browsers (je Spiel die Kopie mit dem weitesten Fortschritt, @ZM-180);
 * bei Lesefehler unverändert.
 */
export async function withLocalEngineState(
  tournament: Tournament,
  source?: LocalCopySource,
  options: LocalOverlayOptions = {},
): Promise<Tournament> {
  let copies: MatchCopy[];
  try {
    copies = await (source ?? (defaultSource ??= new LocalMatchStore())).all();
  } catch {
    return tournament;
  }
  const furthest = new Map<string, Candidate>();
  for (const stored of copies) {
    const copy = options.onlyConfirmed === true ? { ...stored, pending: [] } : stored;
    const view = viewOfCopy(copy);
    if (view.log.length === 0) {
      continue;
    }
    const candidate: Candidate = { view, fields: engineOverlayFields(view, copy.ctx), updatedAt: copy.updatedAt };
    const held = furthest.get(copy.matchId);
    if (held === undefined || isFurther(candidate, held)) {
      furthest.set(copy.matchId, candidate);
    }
  }
  const overlays = new Map<string, EngineOverlayFields>();
  for (const match of tournament.matches) {
    const candidate = furthest.get(match.id.toLowerCase());
    // Ein in der Turnierkopie schon abgeschlossenes Spiel (beendet, ausgefallen) bleibt, wie es dort steht: die
    // Überlagerung bringt nur laufende Einträge schneller an den Monitor (Fixrunde, CI-Befund a36c/zm151).
    if (candidate === undefined || match.matchStatus === 'finished' || match.matchStatus === 'skipped') {
      continue;
    }
    // Ohne Farbe im Anpfiff-Ereignis bleibt die getragene Farbe der Turnierkopie (nie löschen, @ZM-154/@ZM-159).
    overlays.set(match.id, { ...candidate.fields, kit: candidate.fields.kit ?? match.kit });
  }
  return applyEngineOverlay(tournament, overlays);
}

/** Hört auf Änderungen in diesem Browser (andere Tabs). Gibt die Abmeldung zurück. */
export function subscribeLocalDisplaySignal(onSignal: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const onStorage = (): void => { onSignal(); };
  window.addEventListener('storage', onStorage);
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(BROADCAST_CHANNELS.MATCH_ENGINE);
  channel?.addEventListener('message', onStorage);
  return () => {
    window.removeEventListener('storage', onStorage);
    channel?.close();
  };
}
