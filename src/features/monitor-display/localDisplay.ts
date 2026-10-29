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
} from '../../core/match/client';
import type { Tournament } from '../../types/tournament';

/** Quelle der Engine-Kopien (Tests geben einen Ersatz). */
export interface LocalCopySource {
  all(): Promise<MatchCopy[]>;
}

let defaultSource: LocalCopySource | null = null;

/** Turnierkopie mit dem Stand der Engine-Kopien dieses Browsers (jüngste Kopie je Spiel); bei Lesefehler unverändert. */
export async function withLocalEngineState(tournament: Tournament, source?: LocalCopySource): Promise<Tournament> {
  let copies: MatchCopy[];
  try {
    copies = await (source ?? (defaultSource ??= new LocalMatchStore())).all();
  } catch {
    return tournament;
  }
  const newest = new Map<string, MatchCopy>();
  for (const copy of copies) {
    const held = newest.get(copy.matchId);
    if (held === undefined || copy.updatedAt > held.updatedAt) {
      newest.set(copy.matchId, copy);
    }
  }
  const overlays = new Map<string, EngineOverlayFields>();
  for (const match of tournament.matches) {
    const copy = newest.get(match.id.toLowerCase());
    if (copy === undefined) {
      continue;
    }
    const view = viewOfCopy(copy);
    if (view.log.length > 0) {
      overlays.set(match.id, engineOverlayFields(view, copy.ctx));
    }
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
