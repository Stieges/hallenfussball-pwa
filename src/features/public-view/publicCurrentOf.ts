/**
 * Kopfblock der Zuschauer-Seite (Paket Z2, @ZM-141): läuft gerade, sonst als Nächstes, sonst zuletzt beendet.
 *
 * Die Ansicht (`core/view`, `TournamentView.current`) entscheidet, welches Spiel in welche Gruppe gehört; hier wird nur
 * gewählt, was oben steht. Unterbrochene Spiele (Halbzeit, angehaltene Uhr, Strafstoßschießen) zählen als laufend und sind nie
 * „als Nächstes“ (@ZM-041); „als Nächstes“ ist das früheste Spiel ohne Ergebnis, auch wenn seine Anstoßzeit schon vorbei ist
 * (Daniel 21.10.). Ohne Ergebnisse für die Zielgruppe (Kindermodus, „Ergebnisse aus“) gibt es keinen Block „zuletzt beendet“.
 *
 * Der Block steht an der Spitze der Spielliste darunter: Mit gewähltem Filter (Gruppe, „Nur meine“ …) gilt er für die gefilterten
 * Spiele (`visibleIds`), die Voreinstellung „Alle“ zeigt das ganze Turnier (Daniel 21.10.: Filter-Voreinstellung bleibt „Alle“).
 */
import { currentOf, type MatchView, type TournamentView } from '../../core/view';

export type PublicCurrent =
  | { kind: 'live'; matches: readonly MatchView[] }
  | { kind: 'next'; match: MatchView }
  | { kind: 'last'; match: MatchView };

export function publicCurrentOf(view: TournamentView, visibleIds?: ReadonlySet<string>): PublicCurrent | null {
  const { live, next, lastFinished } = visibleIds === undefined ? view.current : currentOf(view.matches.filter((m) => visibleIds.has(m.id)));
  if (live.length > 0) {
    return { kind: 'live', matches: live };
  }
  if (next !== undefined) {
    return { kind: 'next', match: next };
  }
  if (lastFinished !== undefined && view.rules.results) {
    return { kind: 'last', match: lastFinished };
  }
  return null;
}
