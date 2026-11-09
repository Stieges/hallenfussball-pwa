/**
 * Zuschauer-Seite „Schneller zum Spielplan“ (@ZM-196, @ZM-197, @ZM-175): reine Regeln.
 * Erwartung aus dem Gherkin; Fixture „Hallencup Nord“.
 */
import { describe, it, expect } from 'vitest';
import { buildTournamentView } from '../../../core/view';
import type { Standing, Tournament } from '../../../types/tournament';
import { fPAUSE, fZEIT, GAME, NORD, SUED, MITTE } from '../../../core/view/__fixtures__/hallencupNord';
import { myTeamFacts } from '../publicMyTeamFacts';
import { hiddenFilterKeys } from '../publicFilterState';
import type { ViewFilters } from '../publicScheduleFilters';

const view = (t: Tournament) => buildTournamentView(t, { audience: 'viewer', medium: 'app', locale: 'de' });
const standing = (t: Tournament, id: string, over: Partial<Standing>): Standing => ({
  team: t.teams.find((x) => x.id === id)!, played: 1, won: 0, drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 1, goalDifference: -1, points: 0, place: 4, ...over,
});

describe('@ZM-175 Block „Mein Team“: nächstes Spiel und Tabellenplatz', () => {
  it('@ZM-175 nächstes Spiel des Teams: das früheste noch nicht angepfiffene, mit Nummer, Uhrzeit, Feld und Gegner', async () => {
    const { tournament } = await fZEIT();
    const v = view(tournament);
    const spiel9 = v.byId.get(tournament.matches[GAME[9]].id)!;
    const team = spiel9.home.teamId!;
    const facts = myTeamFacts({ view: v, standings: [], teamId: team, groupCount: 2 });
    expect(facts.next).toMatchObject({ number: spiel9.matchNumber, time: '14:40', field: spiel9.field, opponent: spiel9.away.label });
  });

  it('@ZM-141 Gegenbeispiel: ein laufendes Spiel steht im Kopf, im Block nicht als „Als Nächstes“', async () => {
    const { tournament } = await fPAUSE();
    const v = view(tournament);
    const spiel7 = v.byId.get(tournament.matches[GAME[7]].id)!;
    const facts = myTeamFacts({ view: v, standings: [], teamId: spiel7.home.teamId!, groupCount: 2 });
    expect(facts.next?.number).not.toBe(spiel7.matchNumber);
  });

  it('@ZM-175 ein Team ohne weiteres Spiel hat kein „Als Nächstes“', async () => {
    const { tournament } = await fZEIT();
    const matches = tournament.matches.map((m) => ({ ...m, matchStatus: 'finished' as const, scoreA: 1, scoreB: 0 }));
    expect(myTeamFacts({ view: view({ ...tournament, matches }), standings: [], teamId: NORD, groupCount: 2 }).next).toBeUndefined();
  });

  it('@ZM-175 Tabelle: Platz, Punkte und – bei mehreren Gruppen – die Gruppe', async () => {
    const { tournament } = await fZEIT();
    const facts = myTeamFacts({ view: view(tournament), standings: [standing(tournament, NORD, { place: 1, points: 7 })], teamId: NORD, groupCount: 2 });
    expect(facts.table).toEqual({ place: 1, points: 7, group: 'A' });
    const eine = myTeamFacts({ view: view(tournament), standings: [standing(tournament, NORD, { place: 1, points: 7 })], teamId: NORD, groupCount: 1 });
    expect(eine.table).toEqual({ place: 1, points: 7 });
  });

  it('@ZM-199 Gegenbeispiel: vor dem ersten beendeten Spiel steht kein Platz', async () => {
    const { tournament } = await fZEIT();
    const facts = myTeamFacts({ view: view(tournament), standings: [standing(tournament, SUED, { played: 0, place: 1 })], teamId: SUED, groupCount: 2 });
    expect(facts.table).toBeUndefined();
  });

  it('@ZM-175 Gegenbeispiel: im Kindermodus und bei ausgeschalteten Tabellen steht kein Platz', async () => {
    const { tournament } = await fZEIT();
    const s = [standing(tournament, MITTE, { place: 2 })];
    expect(myTeamFacts({ view: view({ ...tournament, hideScoresForPublic: true }), standings: s, teamId: MITTE, groupCount: 2 }).table).toBeUndefined();
    expect(myTeamFacts({ view: view({ ...tournament, hideRankingsForPublic: true }), standings: s, teamId: MITTE, groupCount: 2 }).table).toBeUndefined();
  });
});

describe('@ZM-197 Filter hinter der Taste', () => {
  const alle: ViewFilters = { showOnlyMyTeam: false, myTeamId: null, selectedGroup: null, selectedPhase: 'all', selectedStatus: 'all' };

  it('@ZM-197 QR-Einstieg: alles auf „Alle“, nichts gesetzt', () => {
    expect(hiddenFilterKeys(alle)).toEqual([]);
  });

  it('@ZM-197 Status „Beendet“ gesetzt: ein Filter', () => {
    expect(hiddenFilterKeys({ ...alle, selectedStatus: 'finished' })).toEqual(['status:finished']);
  });

  it('@ZM-197 Phase und Status: zwei Filter, Phase zuerst', () => {
    expect(hiddenFilterKeys({ ...alle, selectedPhase: 'final', selectedStatus: 'live' })).toEqual(['phase:final', 'status:live']);
  });

  it('@ZM-197 Gegenbeispiel: die Gruppen-Auswahl zählt nicht (sie steht sichtbar in der Zeile)', () => {
    expect(hiddenFilterKeys({ ...alle, selectedGroup: 'B' })).toEqual([]);
  });

  it('@ZM-197 Altlink „Nur Mein Team“ bleibt sichtbar, aber nur mit gewähltem Team', () => {
    expect(hiddenFilterKeys({ ...alle, showOnlyMyTeam: true, myTeamId: NORD })).toEqual(['myTeam']);
    expect(hiddenFilterKeys({ ...alle, showOnlyMyTeam: true, myTeamId: null })).toEqual([]);
  });
});
