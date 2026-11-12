/**
 * Kopfblock von Zuschauer-Seite (Paket Z2, @ZM-141) und Spielplan der Turnierleitung (@ZP-109): läuft gerade, sonst als Nächstes, sonst
 * zuletzt beendet. Eine Quelle für beide; die Verwaltung zeigt „zuletzt beendet“ nicht (alle beendet → keine Karte).
 *
 * Die Ansicht (`core/view`, `TournamentView.current`) entscheidet, welches Spiel in welche Gruppe gehört; hier wird nur
 * gewählt, was oben steht. Unterbrochene Spiele (Halbzeit, angehaltene Uhr, Strafstoßschießen) zählen als laufend und sind nie
 * „als Nächstes“ (@ZM-041); „als Nächstes“ ist das früheste Spiel ohne Ergebnis, auch wenn seine Anstoßzeit schon vorbei ist
 * (Daniel 21.10.). Ohne Ergebnisse für die Zielgruppe (Kindermodus, „Ergebnisse aus“) gibt es keinen Block „zuletzt beendet“.
 *
 * Der Block folgt keinem Filter (Gruppe, Status, „Nur meine“): oben steht immer, was im ganzen Turnier läuft (@ZM-141).
 */
import type { MatchView, TournamentView } from '../../core/view';

export type CurrentBlock =
  | { kind: 'live'; matches: readonly MatchView[] }
  | { kind: 'next'; match: MatchView }
  | { kind: 'last'; match: MatchView };

export function currentBlockOf(view: TournamentView): CurrentBlock | null {
  const { live, next, lastFinished } = view.current;
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

/**
 * Kästen in Teamfarbe (Weste bei Leibchen, @ZM-158, @ZM-161) – nur mit sichtbaren Ergebnissen (Kindermodus: keine). Ein laufendes Spiel
 * zeigt sie nur bei eingeschaltetem Live-Stand (sonst „laufendes Spiel ohne Stand“, Zone 1 „Beim Öffnen“, @ZM-116), das nächste Spiel
 * mit 0 : 0 (Zuschauer, @ZM-195) bzw. leer (Verwaltung), das zuletzt beendete mit Ring beim Sieger und Pokal in der Finalrunde (@ZM-158, @OB-064).
 */
export function kastenOf(mv: MatchView, view: TournamentView): MatchView['boxes'] | undefined {
  const { results, liveScore } = view.rules;
  return results && (!mv.isLive || liveScore) ? mv.boxes : undefined;
}
