/**
 * useTeamColumns – die beiden Team-Spalten in Anzeige-Reihenfolge (Aufgabe 3.3).
 * Bindet Modell (`toTeamColumnModel`), Knöpfe (`teamKnoepfe`, Zustand und Recht) und die Tipps der Hülle zusammen.
 * Quelle der Fouls bis B-11a: `useFoulCounts` über das ganze Spiel; Grenze aus `cockpitSettings.foulLimit` (@SL-099, @SL-102).
 */
import { useMemo } from 'react';
import type { SperrHinweis } from '../../../core/match';
import type { MatchCockpitSettings } from '../../../types/tournament';
import type { CockpitKasten } from '../typesFarben';
import type { TeamColumnProps } from '../areas/TeamColumn';
import type { PhaseView } from '../engine/phaseView';
import type { CockpitPhase } from '../model/cockpitPhase';
import type { Side } from '../model/cockpitTypes';
import { teamKnoepfe, toTeamColumnModel } from '../model/toTeamColumnModel';
import type { LiveMatch } from '../types';
import type { TeamSideHandlers } from './useCockpitCommands';

export interface TeamColumnsArgs {
  match: LiveMatch | null;
  view: PhaseView | null;
  phase: CockpitPhase;
  settings: MatchCockpitSettings;
  /** Steuerrecht dieses Geräts; ohne es zeigen die Spalten nur Zähler und Strafen (@SL-018). */
  kannSteuern: boolean;
  fouls: Record<Side, number>;
  sperrHinweise: readonly SperrHinweis[];
  order: { links: Side; rechts: Side };
  handlers: Record<Side, TeamSideHandlers>;
  /** Tastenkürzel an (Schalter, Steuerrecht, Laptop): links `1`/`F`, rechts `2`/`J` – die angezeigte Seite (@SL-153). */
  tasten?: boolean;
  /** Kästen je Seite des Spiels (`home`/`away`) – die Anzeigeseite legt `order` darüber (@SL-065, Seiten tauschen). */
  kasten: CockpitKasten;
}

export type TeamColumnPair = { links: Omit<TeamColumnProps, 'kompakt' | 'breit'>; rechts: Omit<TeamColumnProps, 'kompakt' | 'breit'> };

export function useTeamColumns({ match, view, phase, settings, kannSteuern, fouls, sperrHinweise, order, handlers, kasten, tasten = false }: TeamColumnsArgs): TeamColumnPair | null {
  return useMemo(() => {
    if (!match) { return null; }
    const knoepfe = teamKnoepfe(phase, kannSteuern);
    // @W2A-016, @W2A-029 (C-ZEITSTRAFE-BESCHRIFTUNG-FEST): Dauer aus der Regel des Spiels (Anpfiff); vorher die Einstellung
    const zeitstrafeSekunden = view?.penaltySeconds ?? match.timePenaltyDurationSeconds ?? settings.timePenaltyDurationSeconds;
    const spalte = (seite: Side): Omit<TeamColumnProps, 'kompakt' | 'breit'> => ({
      model: toTeamColumnModel({
        match, seite, view, zustand: phase.zustand, fouls: fouls[seite], foulGrenze: settings.foulLimit, sperrHinweise,
        zeitstrafeSekunden, unterzahl: null, darfErgaenzen: false, kartenArten: settings.enabledCards, kasten: kasten[seite],
      }),
      knoepfe,
      onTor: handlers[seite].onTor, onFoul: handlers[seite].onFoul, onZeitstrafe: handlers[seite].onZeitstrafe, onKarte: handlers[seite].onKarte,
    });
    return {
      links: { ...spalte(order.links), ...(tasten ? { taste: { tor: '1', foul: 'F' } } : {}) },
      rechts: { ...spalte(order.rechts), ...(tasten ? { taste: { tor: '2', foul: 'J' } } : {}) },
    };
  }, [match, view, phase, settings, kannSteuern, fouls, sperrHinweise, order, handlers, kasten, tasten]);
}
