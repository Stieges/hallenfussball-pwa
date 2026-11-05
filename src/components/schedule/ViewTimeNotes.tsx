/**
 * B-27: „(war hh:mm)“ an den Spielkarten aus der gemeinsamen Ansicht (@ZP-003, @ZP-004, @ZP-005, @ZP-046; ohne „voraussichtlich“,
 * @ZM-105). Zuschauer-Seite und alle Ansichten ohne eigenen Spielplan der Leitung bekommen die Hinweise von hier;
 * liefert die Leitung schon ihren Kontext (`ScheduleTimeShift`), bleibt der unverändert.
 */
import { useContext, useMemo, type ReactNode } from 'react';
import type { TournamentView } from '../../core/view';
import { MatchTimeShiftContext, type MatchTimeShiftSlotsValue } from './matchTimeShiftContext';

export function ViewTimeNotes({ view, children }: { view: TournamentView | undefined; children: ReactNode }) {
  const outer = useContext(MatchTimeShiftContext);
  const slots = useMemo<MatchTimeShiftSlotsValue>(() => ({
    originalTimeOf: (id) => view?.byId.get(id)?.originalKickoff?.time,
  }), [view]);
  if (outer !== null || view === undefined) {
    return <>{children}</>;
  }
  return <MatchTimeShiftContext.Provider value={slots}>{children}</MatchTimeShiftContext.Provider>;
}
