/**
 * Der Monitor nach dem Abschluss (R3-7; @LZ-076, @LZ-077 Z. 1, @ZM-121 Z. 1 und 4, @ZM-012 Z. 2, @ET-045) – rein, ohne React.
 *
 * Der Endstand kommt nie aus der Live-Tabelle, sondern allein aus dem beim Abschluss gespeicherten Stand des Servers
 * (`display_final_standings`, nie selbst rechnen). Er gilt, solange das Turnier „abgeschlossen“ ist (beendet bleibt beendet, @ZM-180:
 * kommt ein älterer Spielstand nach, ändert er nichts) – und nach dem Wiederöffnen über den Betreiber (@LZ-091), solange der Server ihn
 * weiter liefert: dann unverändert bis zum neuen Abschluss (@ZM-121 Z. 2; den Stand gibt es beim Server nur nach einem Abschluss).
 * Im Kindermodus steht statt des Endstands der Satz „Turnier beendet – danke fürs Mitspielen“, nie ein Platz; die Entscheidung trifft
 * der Monitor selbst, auch wenn der Server (fälschlich) Plätze liefert.
 */
import type { PublicFinalStandings } from '../../core/repositories/publicFinalStandings';
import type { FinalStandingRow, ScorerRow } from '../../core/standings/finalStandings';
import type { TournamentView } from '../../core/view';
import type { Tournament } from '../../types/tournament';
import { showsKidsEnded } from '../public-view/showsFinalStandings';
import type { EndFolie, ProgramSlide } from './slideProgramme';

export type MonitorEnd =
  | { kind: 'none' }
  /** Abgeschlossen (Cloud), der Endstand ist noch nicht da oder der Abruf scheiterte: das Live-Programm bleibt trotzdem weg (@LZ-076 nach Neuladen). */
  | { kind: 'pending' }
  | { kind: 'kids' }
  | {
    kind: 'final';
    finishedAt: string;
    ranking: readonly FinalStandingRow[];
    /** `null` = Torschützen-Schalter aus: keine Liste (@ZM-012 Z. 2); sonst die gespeicherte Liste (kann leer sein). */
    scorers: readonly ScorerRow[] | null;
  };

/** Kein Abschluss (oder noch kein Stand): der Monitor zeigt sein Programm unverändert. */
export const NO_END: MonitorEnd = { kind: 'none' };
const PENDING_END: MonitorEnd = { kind: 'pending' };
/** Kindermodus nach dem Ende: „Turnier beendet – danke fürs Mitspielen“ statt eines Endstands (@ZM-121 Z. 4). */
export const KIDS_END: MonitorEnd = { kind: 'kids' };

export function monitorEnd(tournament: Pick<Tournament, 'lifecycleStatus'>, view: TournamentView, finalStandings: PublicFinalStandings, cloud = true): MonitorEnd {
  const abgeschlossen = tournament.lifecycleStatus === 'finished';
  if (abgeschlossen && showsKidsEnded(tournament, view)) { return KIDS_END; }
  if (finalStandings.status !== 'final' || !view.rules.results) {
    // Nicht abgeschlossen ohne Endstand vom Server: normales Programm. Abgeschlossen: das Live-Programm bleibt weg (pending).
    return abgeschlossen && cloud ? PENDING_END : NO_END;
  }
  return {
    kind: 'final',
    finishedAt: finalStandings.finishedAt,
    ranking: finalStandings.snapshot.ranking,
    scorers: finalStandings.scorersPublic ? finalStandings.snapshot.scorers : null,
  };
}

/** Folien, die nach dem Abschluss dem Endstand weichen (@ZM-121): Live-Spiel, Tabellen, Nächste Spiele, Spielplan, Torschützen-Zwischenstand. */
const REPLACED_TYPES: ReadonlySet<string> = new Set([
  'live', 'standings', 'all-standings', 'schedule-field', 'schedule-group', 'next-matches', 'top-scorers',
]);

export const END_STANDINGS_SLIDE: EndFolie = { id: 'endstand-folie', type: 'final-standings', duration: null };
export const END_SCORERS_SLIDE: EndFolie = { id: 'torschuetzen-endstand-folie', type: 'final-scorers', duration: null };

/**
 * Das Folienprogramm nach dem Abschluss: vorn die Folie „Endstand“ (danach „Torschützen“, nur mit Schalter und mindestens einem
 * Tor), dahinter bleiben Sponsor, eigener Text und Zuschauer-QR in ihrer Reihenfolge (@ZM-121). Ohne Abschluss unverändert.
 */
export function applyEnd(slides: readonly ProgramSlide[], end: MonitorEnd): ProgramSlide[] {
  if (end.kind === 'none') { return [...slides]; }
  const kept = slides.filter((slide) => !REPLACED_TYPES.has(slide.type));
  const scorers = end.kind === 'final' && end.scorers !== null && end.scorers.length > 0 ? [END_SCORERS_SLIDE] : [];
  return [END_STANDINGS_SLIDE, ...scorers, ...kept];
}
