/**
 * Zugriff auf die Server-Revisionen des Turnier-Repositorys (A-08f3b, `useEngineCatchUpOnCloudChange`).
 * Der a2-Hook `useServerLedMatchIds` (Übergangssperre der Schnelleingabe) ist mit A-08f3e2 entfernt.
 * Ohne Konto-Repository (Gast, Tests ohne `RepositoryProvider`) `null`.
 */
import { useRepositories } from '../core/contexts/RepositoryContext';
import { isServerRevisionSource, type ServerRevisionSource } from '../core/repositories/serverRevisionRegistry';

/** `RepositoryContext.tsx` ist für A-08f3 nicht freigegeben; ohne Provider liefert dieser Zugriff `null`. */
export function useServerRevisionSource(): ServerRevisionSource | null {
  try {
    const repository = useRepositories().tournamentRepository;
    return isServerRevisionSource(repository) ? repository : null;
  } catch {
    return null;
  }
}
