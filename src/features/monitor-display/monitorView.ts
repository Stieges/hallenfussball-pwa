/**
 * Die Ansicht des Hallen-Monitors (A-36c): EINE gemeinsame Turnier-Ansicht für alle Folien (Zielgruppe `screen`,
 * Medium `app`). Status, Seitentexte, Anstoßzeit, Endstand und Sichtbarkeit kommen nur von hier.
 * Die Sprache ist die feste Anzeigesprache (B-41, bis @ZM-126); `now` ist die Ortszeit des Turniers (@ZM-111).
 */
import { buildTournamentView, engineDetailFromMatches, toTournamentLocal, TOURNAMENT_TIME_ZONE, type TournamentView } from '../../core/view';
import { ANZEIGE_SPRACHE } from '../../i18n/anzeigeSprache';
import type { Tournament } from '../../types/tournament';
import { vorlaufMinuten } from './monitorVorlauf';
import type { RuleMatch } from './slideProgramme';

/** Der Zeitpunkt der Ansicht in ms: dieselbe Uhr, nach der `buildMonitorView` die Ortszeit bildet (jede neue Ansicht, ein Wert). */
export function monitorJetztMs(): number {
  return new Date().getTime();
}

export function buildMonitorView(tournament: Tournament): TournamentView {
  const now = new Date().getTime();
  return buildTournamentView({ ...tournament, engineDetail: engineDetailFromMatches(tournament.matches, now) }, {
    audience: 'screen',
    medium: 'app',
    locale: ANZEIGE_SPRACHE,
    now: toTournamentLocal(new Date(now), TOURNAMENT_TIME_ZONE),
  });
}

/**
 * Die Spiele für die Folienregeln (Anhalten, Überspringen, Vorlaufzeit): die Spiele der Ansicht, je Spiel ergänzt um die
 * Vorlaufzeit vor seinem Anpfiff (@ZM-138: Pausendauer des Turniers, mindestens 5 Minuten).
 */
export function buildMonitorRuleMatches(view: TournamentView, tournament: Tournament): RuleMatch[] {
  return view.matches.map((m) => ({
    id: m.id,
    field: m.field,
    isLive: m.isLive,
    isUpcoming: m.isUpcoming,
    matchNumber: m.matchNumber,
    kickoff: m.kickoff,
    vorlaufMin: vorlaufMinuten(tournament, m.phase),
  }));
}
