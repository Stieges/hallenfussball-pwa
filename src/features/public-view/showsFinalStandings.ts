import type { PublicFinalStandings } from '../../core/repositories/publicFinalStandings';
import type { TournamentView } from '../../core/view';
import type { Tournament } from '../../types/tournament';

/** Gilt der Endstand für die Ansicht? Nur mit gespeichertem Endstand vom Server, der alle Teams trägt (`placement.state`). */
export function showsFinalStandings(view: TournamentView, finalStandings: PublicFinalStandings): boolean {
  return finalStandings.status === 'final' && view.placement.state === 'final';
}

/**
 * Kindermodus nach dem Ende (E7, @ZM-121 Z. 4, „Kindermodus überstimmt alle Schalter“): der Satz „Turnier beendet – danke fürs Mitspielen“
 * hängt am öffentlichen Stand (Turnier abgeschlossen ∧ Kindermodus), nicht am Endstand des Servers – der liefert im Kindermodus `none`.
 */
export function showsKidsEnded(tournament: Pick<Tournament, 'lifecycleStatus'>, view: TournamentView): boolean {
  return tournament.lifecycleStatus === 'finished' && !view.rules.results;
}
