/**
 * Einstellungen der Turnierverwaltung mit dem schmalen Speicherweg der Einstellung „Plätze ausspielen“ (Fixrunde TB-6):
 * `PlayOutPlacesService` schreibt nur dieses Feld mit Versionsprüfung, danach lädt die Verwaltung frisch. Eigene Datei, damit
 * nur der Reiter „Einstellungen“ das Repository aus dem Kontext braucht.
 */
import { useMemo, type ComponentProps } from 'react';
import { useRepositories } from '../../core/contexts/RepositoryContext';
import { PlayOutPlacesService } from '../../core/services/PlayOutPlacesService';
import { SettingsTab } from './SettingsTab';

type Props = Omit<ComponentProps<typeof SettingsTab>, 'onSavePlayOutPlaces'> & {
  /** Nach dem Speichern: Turnier frisch laden. */
  onPlacesSaved: () => void;
};

export const SettingsTabConnected = ({ onPlacesSaved, ...rest }: Props) => {
  const { tournamentRepository } = useRepositories();
  const tournamentId = rest.tournament.id;
  const save = useMemo(() => {
    const service = new PlayOutPlacesService(tournamentRepository);
    return async (places: number[]) => {
      try {
        return await service.update(tournamentId, places);
      } finally {
        onPlacesSaved(); // auch nach einem Fehler frisch laden: der Stand auf dem Schirm soll der der Cloud sein
      }
    };
  }, [tournamentRepository, tournamentId, onPlacesSaved]);
  return <SettingsTab {...rest} onSavePlayOutPlaces={save} />;
};
