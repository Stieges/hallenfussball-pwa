/**
 * useRepository Hook
 *
 * Returns the repository instance from context.
 * This guarantees we use the same sync/state-aware instance across the app.
 */

import { useRepositoryContext } from '../core/contexts/RepositoryContext';
import { ITournamentRepository } from '../core/repositories/ITournamentRepository';

export function useRepository(): ITournamentRepository {
  return useRepositoryContext();
}

/**
 * Legacy accessors - should ideally be removed or updated to use Context if possible.
 * Since hooks can't export functions that use hooks internally without being hooks themselves,
 * we warn here.
 */
export function getRepository(): never {
  throw new Error('getRepository() is deprecated. Use useRepository() hook inside components.');
}

export default useRepository;
