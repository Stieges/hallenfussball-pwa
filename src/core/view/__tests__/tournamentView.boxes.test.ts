/**
 * Aufgabe 2.1 (Spielanzeige): `MatchView.boxes` über `buildTournamentView` – alle Flächen lesen die Kastenfarben aus
 * derselben Ansicht (@ZM-160, @ZM-161, @ZM-140, @ZM-154, @ZM-163:teil, @W3-028).
 * Gherkin: docs/anforderungen/2026-10-02_zuschauer-und-monitor.md, 2026-09-27_wizard-turniertag-vorbereiten.md (@W3-028).
 */
import { describe, expect, it } from 'vitest';
import { buildTournamentView } from '../tournamentView';
import type { TournamentViewInput } from '../types';
import { pendingSlot, teamSlot } from '../../models/matchSlot';
import { DEFAULT_AWAY_BOX_COLOR, DEFAULT_HOME_BOX_COLOR, type SpectatorDisplaySettings } from '../../models/spectatorDisplay';
import type { Match, Team } from '../../../types/tournament';

const GELB = '#FFCC00';
const ROT = '#DC0000';
const GRUEN = '#009933';
const WEISS = '#FFFFFF';
const BLAU_STD = DEFAULT_HOME_BOX_COLOR;
const ROT_STD = DEFAULT_AWAY_BOX_COLOR;

const NORD = '00000000-0000-4000-8000-000000000001';
const SUED = '00000000-0000-4000-8000-000000000006';

function team(id: string, name: string, primary?: string): Team {
  return primary === undefined ? { id, name } : { id, name, colors: { primary } };
}

function spiel(id: string, matchNumber: number, home: string, away: string, extra: Partial<Match> = {}): Match {
  return { id, matchNumber, round: 1, field: 1, slotA: teamSlot(home), slotB: teamSlot(away), ...extra };
}

function input(teams: Team[], matches: Match[], spectatorDisplay?: SpectatorDisplaySettings): TournamentViewInput {
  return {
    teams,
    matches,
    date: '2026-11-28',
    hideScoresForPublic: false,
    hideRankingsForPublic: false,
    isPublic: true,
    shareCode: 'NORD26',
    ...(spectatorDisplay === undefined ? {} : { spectatorDisplay }),
  };
}

const screen = { audience: 'screen', medium: 'app', locale: 'de' } as const;
const boxesOf = (i: TournamentViewInput, id: string) => buildTournamentView(i, screen).byId.get(id)?.boxes;

describe('@ZM-160 MatchView.boxes in der getragenen Farbe', () => {
  it('@ZM-160 Spiel 7 FC Nord Rot, SV Süd Weiß angepfiffen: view.boxes home Rot, away Weiß', () => {
    const teams = [team(NORD, 'FC Nord', ROT), team(SUED, 'SV Süd', WEISS)];
    const spiel7 = spiel('spiel-7', 7, NORD, SUED, { matchStatus: 'running', scoreA: 1, scoreB: 0, kit: { a: ROT, b: WEISS } });
    const boxes = boxesOf(input(teams, [spiel7]), 'spiel-7');
    expect(boxes?.home).toEqual({ fill: { kind: 'solid', color: ROT }, bib: false });
    expect(boxes?.away).toEqual({ fill: { kind: 'solid', color: WEISS }, bib: false });
  });

  it('@ZM-160 alle Zielgruppen lesen dieselben Kästen (Verwaltung, Zuschauer, Monitor)', () => {
    const teams = [team(NORD, 'FC Nord', ROT), team(SUED, 'SV Süd', WEISS)];
    const i = input(teams, [spiel('spiel-7', 7, NORD, SUED, { matchStatus: 'running', kit: { a: ROT, b: WEISS } })]);
    const of = (audience: 'organizer' | 'viewer' | 'screen') =>
      buildTournamentView(i, { audience, medium: 'app', locale: 'de' }).byId.get('spiel-7')?.boxes;
    expect(of('organizer')).toEqual(of('screen'));
    expect(of('viewer')).toEqual(of('screen'));
  });

  it('@ZM-160 Gegenbeispiel: ohne Ansicht-Einstellung gilt die Vorbelegung, mit „Teamfarben aus“ die Standardfarben (@ZM-154)', () => {
    const teams = [team(NORD, 'FC Nord', ROT), team(SUED, 'SV Süd', WEISS)];
    const matches = [spiel('spiel-7', 7, NORD, SUED, { matchStatus: 'running', kit: { a: ROT, b: WEISS } })];
    const aus = boxesOf(input(teams, matches, { teamColors: false, homeColor: BLAU_STD, awayColor: ROT_STD }), 'spiel-7');
    expect(aus?.home.fill).toEqual({ kind: 'solid', color: BLAU_STD });
    expect(aus?.away.fill).toEqual({ kind: 'solid', color: ROT_STD });
  });
});

describe('@ZM-161 @ZM-140 Weste in der Ansicht (bis D.1 ohne gespeicherte Trikotfarbe)', () => {
  it('@ZM-161 ohne gespeicherte Trikotfarbe: Streifen in der aktuellen Teamfarbe (Rot)', () => {
    const teams = [team(SUED, 'SV Süd', ROT), team(NORD, 'FC Nord', WEISS)];
    const spiel12 = spiel('spiel-12', 12, SUED, NORD, { matchStatus: 'running', kit: { a: GELB, b: WEISS, bibSide: 'a' } });
    const boxes = boxesOf(input(teams, [spiel12]), 'spiel-12');
    expect(boxes?.home).toEqual({ fill: { kind: 'vest', center: GELB, stripes: ROT }, bib: true });
    expect(boxes?.away).toEqual({ fill: { kind: 'solid', color: WEISS }, bib: false });
  });

  it('@ZM-140 Team ohne Teamfarbe in Leibchen: Streifen Blau (Standardfarbe Heim)', () => {
    const teams = [team(SUED, 'SV Süd'), team(NORD, 'FC Nord', WEISS)];
    const spiel12 = spiel('spiel-12', 12, SUED, NORD, { matchStatus: 'running', kit: { a: GELB, b: WEISS, bibSide: 'a' } });
    expect(boxesOf(input(teams, [spiel12]), 'spiel-12')?.home.fill).toEqual({ kind: 'vest', center: GELB, stripes: BLAU_STD });
  });
});

describe('@ZM-163:teil @W3-028 Runde und Farbe ab dem Anpfiff', () => {
  it('@ZM-163:teil MatchView.phase unterscheidet Gruppe und Finalrunde für die Kästen', () => {
    const teams = [team(NORD, 'FC Nord', ROT), team(SUED, 'SV Süd', WEISS)];
    const gruppe = spiel('spiel-7', 7, NORD, SUED, { matchStatus: 'finished', scoreA: 2, scoreB: 1, kit: { a: ROT, b: WEISS } });
    const finale = spiel('finale', 15, NORD, SUED, { isFinal: true, matchStatus: 'finished', scoreA: 2, scoreB: 1, kit: { a: ROT, b: WEISS } });
    const view = buildTournamentView(input(teams, [gruppe, finale]), screen);
    expect(view.byId.get('spiel-7')?.phase).toBe('groupStage');
    expect(view.byId.get('finale')?.phase).toBe('final');
    expect(view.byId.get('finale')?.boxes).toEqual(view.byId.get('spiel-7')?.boxes);
  });

  it('@W3-028 Gegenbeispiel: nach dem Anpfiff geänderte Teamfarbe färbt die Kastenfläche nicht um', () => {
    // SV Süd wurde mit Rot angepfiffen; danach trägt Olli Grün als Teamfarbe ein.
    const teams = [team(SUED, 'SV Süd', GRUEN), team(NORD, 'FC Nord', WEISS)];
    const laufend = spiel('spiel-12', 12, SUED, NORD, { matchStatus: 'running', kit: { a: ROT, b: WEISS } });
    const naechstes = spiel('spiel-14', 14, SUED, NORD, { matchStatus: 'scheduled' });
    const view = buildTournamentView(input(teams, [laufend, naechstes]), screen);
    expect(view.byId.get('spiel-12')?.boxes.home.fill).toEqual({ kind: 'solid', color: ROT });
    // „ab dem nächsten Spiel“ gilt die neue Farbe
    expect(view.byId.get('spiel-14')?.boxes.home.fill).toEqual({ kind: 'solid', color: GRUEN });
  });

  it('@ZM-159 offene Spielseite („Erster Gruppe B“, noch kein Team): Kasten in der Standardfarbe der Seite', () => {
    const teams = [team(NORD, 'FC Nord', WEISS)];
    const offen: Match = { ...spiel('hf-1', 13, NORD, NORD), slotB: pendingSlot({ kind: 'groupRank', group: 'B', rank: 1 }) };
    expect(boxesOf(input(teams, [offen]), 'hf-1')?.away.fill).toEqual({ kind: 'solid', color: ROT_STD });
  });
});
