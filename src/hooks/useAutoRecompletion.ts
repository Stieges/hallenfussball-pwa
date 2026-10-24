/**
 * A-15b (R2 PR 2): Anbindung des Auslösers „erneut abschließen nach einer Korrektur“ an die Turnierverwaltung – Recht
 * (`manageLifecycle`), Netz und Repository (lokaler Speicher = Gast). Eingehängt im Bildschirm der Turnierverwaltung, damit er
 * läuft, sobald die Turnierleitung das Turnier offen hat, auch ohne geöffneten Reiter „Tabellen“ (@TM-071 „ohne Zutun“).
 */
import { useMemo } from 'react';
import type { Tournament } from '../types/tournament';
import { useRepositories } from '../core/contexts/RepositoryContext';
import { LocalStorageRepository } from '../core/repositories/LocalStorageRepository';
import { useCan } from '../features/auth/hooks/useCan';
import { useIsOnline } from './useOnlineStatus';
import { useRecompletionAfterCorrection } from './useRecompletionAfterCorrection';

export function useAutoRecompletion(tournamentId: string, tournament: Tournament | null, reloadFresh: () => void): void {
  const { tournamentRepository } = useRepositories();
  const canManage = useCan('manageLifecycle', tournamentId);
  const online = useIsOnline();
  const local = tournamentRepository instanceof LocalStorageRepository;
  const completeGroup = useMemo(() => tournamentRepository.completeGroup?.bind(tournamentRepository), [tournamentRepository]);
  useRecompletionAfterCorrection(tournament, {
    ...(completeGroup !== undefined ? { completeGroup } : {}),
    canManage,
    online: online || local,
    local,
    onDone: reloadFresh,
  });
}
