/**
 * Torschützenliste des noch laufenden Turniers (R3-5, @ET-042 „vorläufig“): `computeScorers` über die Ereignisse der
 * Spielsteuerung (wie der Abschluss, `loadEngineEventsForExport`), neu gelesen, sobald sich ein Spielstand ändert. Gelingt das
 * Lesen nicht (Gast, kein Netz), zählen die am Spiel gespeicherten Ereignisse – die Liste ist ohnehin „vorläufig“. Nach dem
 * Abschluss wird sie NICHT benutzt: dann gilt nur die gespeicherte Liste (@ET-045).
 */
import { useEffect, useMemo, useState } from 'react';
import type { Tournament } from '../../../types/tournament';
import type { EngineEventsById } from '../../../utils/calculations';
import { computeScorers } from '../../../core/standings/scorers';
import type { ScorerRow } from '../../../core/standings/finalStandings';
import { loadEngineEventsForExport } from '../../match-engine/loadEngineEventsForExport';
import { useMatchEngineContextOptional } from '../../match-engine/useMatchEngineContext';

const signatureOf = (tournament: Pick<Tournament, 'matches'>): string =>
  tournament.matches.map((m) => `${m.id}:${m.matchStatus ?? ''}:${m.scoreA ?? ''}-${m.scoreB ?? ''}:${m.events?.length ?? 0}`).join('|');

export function useProvisionalScorers(tournament: Tournament, enabled: boolean): ScorerRow[] {
  const context = useMatchEngineContextOptional();
  const [engineEvents, setEngineEvents] = useState<EngineEventsById | undefined>(undefined);
  const signature = signatureOf(tournament);
  useEffect(() => {
    if (!enabled || context === null) {
      return undefined;
    }
    let alive = true;
    loadEngineEventsForExport(tournament, context).then(
      (events) => { if (alive) { setEngineEvents(events); } },
      () => { if (alive) { setEngineEvents(undefined); } },
    );
    return () => { alive = false; };
    // Neu lesen nur bei geändertem Spielstand, nicht bei jeder neuen Objektidentität des Turniers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, context, signature, tournament.id]);
  return useMemo(() => (enabled ? computeScorers(tournament, engineEvents) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, signature, engineEvents, tournament.teams]);
}
