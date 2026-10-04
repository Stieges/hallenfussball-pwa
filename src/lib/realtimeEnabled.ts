/**
 * Realtime-/Cloud-Schalter (isRealtimeEnabled) für optional auswertende Hooks.
 *
 * Eigener Context + null-sicherer Hook statt `useRepositories()` (wirft ohne
 * RepositoryProvider): `useTournamentStartState` muss den Schalter auch in
 * isolierten Komponenten-Tests lesen können, OHNE dass deren Modul-Mocks
 * erweitert werden müssen. Default `false` = kein Cloud-Modus — dann entscheidet
 * die lokale Match-Liste allein (Ruling W1).
 * `RepositoryProvider` speist den Wert aus `isRealtimeEnabled` ein.
 *
 * Ablage in lib/ statt core/contexts/: core/ ist framework-free (kein React),
 * core/ darf aber aus lib/ importieren (wie bereits lib/supabase).
 */
import { createContext, useContext } from 'react';

export const RealtimeEnabledContext = createContext<boolean>(false);

export function useIsRealtimeEnabled(): boolean {
  return useContext(RealtimeEnabledContext);
}
