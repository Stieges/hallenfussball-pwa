/**
 * Aktionen der Startseite, die mehr tun als die Liste anzuzeigen (aus `App.tsx` herausgelöst, damit sie sich direkt testen lassen):
 * - Import (@W1-041): speichern, erst danach meldet der Dialog „Import erfolgreich“; scheitert das Speichern, wirft die Funktion
 *   und der Dialog zeigt den Fehler (nichts ist importiert). „Weiter“ nach einem Import ohne Spielplan öffnet den Assistenten bei Schritt 2.
 * - „Papierkorb leeren“ (@LZ-094): löscht alle Turniere im Papierkorb; was sich nicht löschen lässt, nennt die Meldung mit Namen.
 */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Tournament } from '../types/tournament';
import type { EmptyTrashResult } from './useTournaments';
import { useToast } from '../components/ui/Toast';
import { captureFeatureError } from '../lib/sentry';

interface DashboardActionsDeps {
  saveTournament: (tournament: Tournament) => Promise<void>;
  emptyTrash: () => Promise<EmptyTrashResult>;
}

export interface DashboardActions {
  importTournament: (tournament: Tournament) => Promise<void>;
  continueImport: (tournament: Tournament) => void;
  emptyTrashWithReport: () => Promise<void>;
}

export function useDashboardActions({ saveTournament, emptyTrash }: DashboardActionsDeps): DashboardActions {
  const { t } = useTranslation('common');
  const { showError } = useToast();
  const navigate = useNavigate();

  const importTournament = useCallback(async (tournament: Tournament): Promise<void> => {
    try {
      if (tournament.matches.length > 0) {
        // Vollständiger Import: mit Spielplan, „Bereit“ auf der Startseite
        await saveTournament({ ...tournament, status: 'published' });
      } else {
        // Teilimport (Teamliste): Entwurf, der Assistent öffnet beim Weiter bei Schritt 2 (Spielplan erstellen)
        await saveTournament({ ...tournament, lastVisitedStep: 2 });
      }
    } catch (error) {
      console.error('[Dashboard] Failed to import tournament:', error);
      if (error instanceof Error) { captureFeatureError(error, 'tournament', 'import'); }
      throw error;
    }
  }, [saveTournament]);

  const continueImport = useCallback((tournament: Tournament) => {
    void navigate(`/tournament/${tournament.id}/edit?step=2`);
  }, [navigate]);

  const emptyTrashWithReport = useCallback(async () => {
    try {
      const { failed } = await emptyTrash();
      if (failed.length > 0) {
        captureFeatureError(new Error('emptyTrash: not all deleted'), 'tournament', 'emptyTrash', { failed: failed.length });
        showError(t('errors.emptyTrashFailed', { names: failed.map((f) => `„${f.title}“`).join(', ') }));
      }
    } catch (error) {
      console.error('[Dashboard] Failed to empty trash:', error);
      if (error instanceof Error) { captureFeatureError(error, 'tournament', 'emptyTrash'); }
      showError(t('errors.deleteTournament'));
    }
  }, [emptyTrash, showError, t]);

  return { importTournament, continueImport, emptyTrashWithReport };
}
