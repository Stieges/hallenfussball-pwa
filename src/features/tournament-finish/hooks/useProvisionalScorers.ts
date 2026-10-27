/**
 * Torschützenliste des noch laufenden Turniers (R3-5, @ET-042 „vorläufig“): `computeScorers` über die Ereignisse der
 * Spielsteuerung (wie der Abschluss, `loadEngineEventsForExport`), neu gelesen, sobald sich ein Spielstand ändert. Gelingt das
 * Lesen nicht (kein Netz), zählen die am Spiel gespeicherten Ereignisse, und `incomplete` ist `true` – die Ansicht zeigt dann
 * „Torschützen evtl. unvollständig“ (kein stiller Rückfall, Review #397 m-2). Ohne Spielsteuerung (Gast, lokales Turnier) ist
 * `match.events` die einzige Quelle und vollständig. Nach dem Abschluss wird sie NICHT benutzt: dann gilt nur die gespeicherte Liste (@ET-045).
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

export interface ProvisionalScorers {
  scorers: ScorerRow[];
  /** Die Ereignisse der Spielsteuerung ließen sich nicht lesen: Rückfall auf die am Spiel gespeicherten, evtl. unvollständig. */
  incomplete: boolean;
}

export function useProvisionalScorers(tournament: Tournament, enabled: boolean): ProvisionalScorers {
  const context = useMatchEngineContextOptional();
  const [engineEvents, setEngineEvents] = useState<EngineEventsById | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const signature = signatureOf(tournament);
  useEffect(() => {
    if (!enabled || context === null) {
      return undefined;
    }
    let alive = true;
    loadEngineEventsForExport(tournament, context).then(
      (events) => { if (alive) { setEngineEvents(events); setFailed(false); } },
      () => { if (alive) { setEngineEvents(undefined); setFailed(true); } },
    );
    return () => { alive = false; };
    // Neu lesen nur bei geändertem Spielstand, nicht bei jeder neuen Objektidentität des Turniers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, context, signature, tournament.id]);
  const scorers = useMemo(() => (enabled ? computeScorers(tournament, engineEvents) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, signature, engineEvents, tournament.teams]);
  return { scorers, incomplete: enabled && context !== null && failed };
}
