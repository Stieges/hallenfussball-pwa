/**
 * usePenaltyExpiryNotice – meldet eine abgelaufene Zeitstrafe in der Meldezeile (@SL-096).
 * Verglichen wird die Liste der Strafen der Engine-Ansicht mit der vorigen; eine Strafe, die mit Restzeit verschwindet
 * (Gegentor, Rücknahme, Abpfiff), gilt nicht als abgelaufen (`abgelaufeneStrafen`).
 */
import { useEffect, useRef } from 'react';
import type { PhasePenalty, PhaseView } from '../engine/phaseView';
import { abgelaufeneStrafen } from '../model/penaltyExpiry';
import type { Uebersetzer } from '../model/cockpitTypes';
import type { NoticeStufe } from './useCockpitNotices';

interface TeamRef { id: string; name: string }

export function usePenaltyExpiryNotice(
  matchId: string | undefined,
  view: PhaseView | null,
  teams: { home: TeamRef; away: TeamRef } | null,
  melde: (stufe: NoticeStufe, text: string) => void,
  t: Uebersetzer,
): void {
  const vorher = useRef<{ matchId: string | undefined; strafen: PhasePenalty[] }>({ matchId, strafen: [] });
  const strafen = view?.penalties;
  useEffect(() => {
    const aktuell = strafen ?? [];
    if (vorher.current.matchId === matchId && teams) {
      for (const id of abgelaufeneStrafen(vorher.current.strafen, aktuell)) {
        const strafe = vorher.current.strafen.find((p) => p.id === id);
        const team = strafe ? [teams.home, teams.away].find((x) => x.id === strafe.teamId) : undefined;
        if (strafe && team) {
          melde(2, strafe.playerNumber === undefined
            ? t('meldung.zeitstrafeAbgelaufenOhneNr', { team: team.name })
            : t('meldung.zeitstrafeAbgelaufen', { team: team.name, nummer: strafe.playerNumber }));
        }
      }
    }
    vorher.current = { matchId, strafen: aktuell };
  }, [matchId, strafen, teams, melde, t]);
}
