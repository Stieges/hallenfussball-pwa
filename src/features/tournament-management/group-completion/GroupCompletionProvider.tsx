/**
 * Anbieter für „Gruppe abschließen“ (GA4 A-13c): hält den Ablauf (`useGroupCompletion`), stellt ihn Tabellen und Spielplan
 * bereit und zeigt den jeweiligen Dialog. Steht in der Turnierverwaltung innerhalb von `StandingTieProvider` (Rechte, Netz,
 * Neuladen). Der Banner kommt nicht in den Verwaltungskopf, sondern wird per Import in `TabellenTab` und `ScheduleTab` gesetzt.
 */
import type { ReactNode } from 'react';
import type { Tournament } from '../../../types/tournament';
import { GroupCompletionContext } from './groupCompletionContext';
import { GroupCompletionDialogs } from './GroupCompletionDialogs';
import { useGroupCompletion } from './useGroupCompletion';

export const GroupCompletionProvider = ({ tournament, children }: { tournament: Tournament; children: ReactNode }) => {
  const api = useGroupCompletion(tournament);
  return (
    <GroupCompletionContext.Provider value={api}>
      {children}
      <GroupCompletionDialogs api={api} />
    </GroupCompletionContext.Provider>
  );
};
