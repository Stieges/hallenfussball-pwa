/**
 * Verbindung der Tabellen-Ansichten mit dem Eintragen von Gleichstands-Entscheidungen (Paket TB-B, TB-6b/c).
 * Die Tabellen (`GroupTables`, `TabellenTab`) bleiben Darstellung; wer entscheiden darf, ob ein Netz da ist, der Dienst und
 * das Neuladen nach dem Speichern kommen aus diesem Kontext. Ohne Anbieter (Zuschauer, Monitor, Vorschau) gibt es keine Tasten.
 * Rechte: Oberfläche `manageLifecycle` (Turnierleitung, Co-Admin; der Server prüft `tournamentSettings`), R-TB-8.
 */
import { createContext, useContext } from 'react';
import type { StandingDecisionService } from '../../../core/services/StandingDecisionService';

export type StandingTieService = Pick<StandingDecisionService, 'decide' | 'withdraw'>;

export interface StandingTieContextValue {
  tournamentId: string;
  /** Turnierleitung oder Co-Admin (`manageLifecycle`): darf entscheiden und zurücknehmen. */
  canDecide: boolean;
  online: boolean;
  service: StandingTieService;
  /** Nach dem Speichern: Turnier frisch laden. */
  onChanged: () => void;
  /** Sprung in die Turnierregeln (Einstellung „Diese Plätze müssen bei Gleichstand ausgespielt werden“). */
  openRules: () => void;
}

export const StandingTieContext = createContext<StandingTieContextValue | null>(null);

/** Der Kontext oder `null` (keine Anbieter-Ansicht: nur Marken, keine Tasten). */
export const useStandingTie = (): StandingTieContextValue | null => useContext(StandingTieContext);


