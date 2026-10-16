/**
 * A-08f3a2 (Plan `task-A-08f3-plan.md` v4): Spiele, deren Spielstand der Server führt (Revision > 1), als Menge.
 * Übergang bis e2: Die Schnelleingabe sperrt diese Spiele wie heute (Befund C-SCHNELLEINGABE-SPERRE-STATUS).
 * Ohne Konto-Repository (Gast, Tests ohne `RepositoryProvider`) leer. Rückbau in e2.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { useRepositories } from '../core/contexts/RepositoryContext';
import { isServerRevisionSource, type ServerRevisionSource } from '../core/repositories/serverRevisionRegistry';

const EMPTY: ReadonlySet<string> = new Set();

/** `RepositoryContext.tsx` ist für A-08f3 nicht freigegeben; ohne Provider liefert dieser Zugriff `null`. */
export function useServerRevisionSource(): ServerRevisionSource | null {
  try {
    const repository = useRepositories().tournamentRepository;
    return isServerRevisionSource(repository) ? repository : null;
  } catch {
    return null;
  }
}

export function useServerLedMatchIds(tournamentId: string | undefined): ReadonlySet<string> {
  const source = useServerRevisionSource();
  const subscribe = useCallback(
    (onChange: () => void) => (source && tournamentId ? source.subscribeServerRevisions(tournamentId, onChange) : () => undefined),
    [source, tournamentId],
  );
  const snapshot = useCallback(
    () => (source && tournamentId ? source.serverLedMatchIds(tournamentId) : EMPTY),
    [source, tournamentId],
  );
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
