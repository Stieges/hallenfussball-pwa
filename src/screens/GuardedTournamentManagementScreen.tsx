/**
 * A-17c (@HE-055, @HE-070, @OB-053): Turnier-Fenster mit Wächter. Helfer-Geräte mit Eintrag im Zugangs-Index werden vor dem
 * Laden des Turniers geprüft (entzogen, nur zusehen, abgeschlossen, Anfrage offen oder abgelehnt); alle anderen sehen das
 * Fenster unverändert. Eigene Datei, damit `TournamentManagementScreen.tsx` nicht weiter wächst.
 */
import type { ComponentProps } from 'react';
import { useLocation } from 'react-router-dom';
import { HelperAccessGuard } from '../features/helpers/components/HelperAccessGuard';
import { getTabFromPath } from '../features/tournament-management/utils/tournamentTabUtils';
import { TournamentManagementScreen } from './TournamentManagementScreen';

export const GuardedTournamentManagementScreen = (props: ComponentProps<typeof TournamentManagementScreen>) => {
  const { pathname } = useLocation();
  const activeTab = getTabFromPath(pathname.split('/')[3]);
  return (
    <HelperAccessGuard tournamentId={props.tournamentId} activeTab={activeTab}>
      <TournamentManagementScreen {...props} />
    </HelperAccessGuard>
  );
};
