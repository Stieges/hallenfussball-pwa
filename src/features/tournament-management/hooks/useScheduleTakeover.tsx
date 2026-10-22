/**
 * useScheduleTakeover (B-49, @FU-081, Befund C-SPIELPLAN-UEBERNEHMEN-FEHLT): Will jemand im Spielplan ein Ergebnis für ein
 * laufendes Spiel eintragen, dessen Feld ein anderes Gerät steuert, sieht er „Feld 2 wird gerade von Tom gesteuert“.
 * - Turnierleitung (`leadMatches`): Rückfrage mit „Spielleitung übernehmen“ – auch wenn Toms Gerät nicht mehr erreichbar ist
 *   (@FU-081 Z. 5); nach der Übernahme geht es ins Cockpit des Spiels (`onTaken`).
 * - Helfer: nur der Hinweis (übernehmen erst nach 30 s Funkstille, @FU-032 MVP+).
 * Der Stand wird beim Eintrag frisch gelesen (kein Abfrage-Takt im Spielplan). Unbekannt (ohne Netz, Gast) oder frei bzw.
 * eigenes Gerät → `false`, der Aufrufer zeigt wie bisher „Spiel läuft – Ergebnis erst nach dem Abpfiff“.
 *
 * Für Variante A („Spiel beenden und Ergebnis eintragen“, @FU-115): Ihre Rückfrage kann `openTakeover` für den Knopf
 * „Spielleitung übernehmen“ nutzen; der Halter-Leser braucht die Geräte-ID (`getDeviceId()`), sonst sieht das steuernde Gerät
 * sich selbst als fremden Halter.
 */
import { useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { fieldControlView } from '../../../core/fieldControl/fieldControlView';
import { useCan } from '../../auth/hooks/useCan';
import { fieldHolderText } from '../../match-engine/fieldHolderText';
import { useFieldControl } from '../../match-engine/useFieldControl';
import { useTakeoverDialog, type TakeoverRequest } from '../../match-engine/useTakeoverDialog';

export interface ScheduleTakeoverInput {
  tournamentId: string;
  showWarning: (message: string) => void;
  /** Nach gelungener Übernahme (z. B. ins Cockpit des Spiels). */
  onTaken?: (matchId: string) => void;
}

export interface ScheduleTakeover {
  /** `true` = fremd gesteuertes Feld, Hinweis bzw. Rückfrage steht; `false` = nicht fremd gesteuert oder unbekannt. */
  offerTakeover: (matchId: string, field: number | null) => Promise<boolean>;
  openTakeover: (request: TakeoverRequest) => void;
  dialog: ReactNode;
}

export function useScheduleTakeover({ tournamentId, showWarning, onTaken }: ScheduleTakeoverInput): ScheduleTakeover {
  const { t } = useTranslation('tournament');
  const { t: tCockpit } = useTranslation('cockpit');
  const istLeitung = useCan('leadMatches', tournamentId);
  const fc = useFieldControl(tournamentId, { poll: false });
  const { refresh } = fc;
  const { open, dialog } = useTakeoverDialog(fc.takeOver);

  const offerTakeover = useCallback(async (matchId: string, field: number | null): Promise<boolean> => {
    if (field === null) {
      return false;
    }
    const view = fieldControlView(await refresh(), field);
    if (view.kind !== 'foreign') {
      return false;
    }
    const feldName = t('management.field', { number: field });
    const halter = fieldHolderText(view.info);
    if (!istLeitung) {
      showWarning(halter !== null
        ? tCockpit('steuer.gesteuert', { feld: feldName, name: halter })
        : tCockpit('steuer.gesteuertOhneName', { feld: feldName }));
      return true;
    }
    open({ field, feldName, epoch: view.epoch, halter, onTaken: () => { onTaken?.(matchId); } });
    return true;
  }, [refresh, t, tCockpit, istLeitung, showWarning, open, onTaken]);

  return { offerTakeover, openTakeover: open, dialog };
}
