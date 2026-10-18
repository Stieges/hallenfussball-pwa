/**
 * A-36b Pflichttest (Teilplan A-36 § 4): Zustände, „läuft / als Nächstes / zuletzt beendet“, Uhrzeit, Endstand,
 * Platzierung – über `buildTournamentView` auf der Fixture „Hallencup Nord“ (Engine → cacheColumns → Mapper).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildTournamentView } from '../tournamentView';
import { viewStatusText } from '../status';
import { TOURNAMENT_TIME_ZONE, toTournamentLocal } from '../time';
import type { TournamentView, ViewAudience, ViewLocale, ViewMedium } from '../types';
import { getMatchWinner } from '../../../utils/calculations';
import type { Match, MatchDecidedBy } from '../../../types/tournament';
import { TeamIdSchema } from '../../models/schemas/MatchSlotSchema';
import { fAUS, fES, fHF, fNUR, fNV, fPAUSE, fZEIT, GAME, NORD, type Hallencup } from '../__fixtures__/hallencupNord';
import { EXPECTED_STATE, EXPECTED_TIME } from '../__fixtures__/expected';

vi.mock('i18next', async () => (await import('./realI18n')).realI18nModule());

const PUBLIC: Array<[ViewAudience, ViewMedium]> = [['viewer', 'app'], ['screen', 'app'], ['organizer', 'app']];
const build = (cup: Hallencup, audience: ViewAudience = 'viewer', medium: ViewMedium = 'app', locale: ViewLocale = 'de'): TournamentView =>
  buildTournamentView(cup.tournament, { audience, medium, locale });
const idOf = (cup: Hallencup, index: number): string => cup.tournament.matches[index].id;

let pause: Hallencup;
let aus: Hallencup;
let zeit: Hallencup;
const previousTz = process.env.TZ;

beforeAll(async () => {
  pause = await fPAUSE();
  aus = await fAUS();
  process.env.TZ = 'America/New_York'; // F-ZEIT: Gerät eine andere Zeitzone als das Turnier
  zeit = await fZEIT();
});
afterAll(() => {
  process.env.TZ = previousTz;
});

describe('@ZM-039 @ZM-040 @ZM-041 F-PAUSE: unterbrochen bleibt live, nie „nächstes Spiel“', () => {
  it.each(PUBLIC)('@ZM-039 @ZM-040 Spiel 7 angehalten bei 1:0, Spiel 8 läuft (%s·%s)', (audience, medium) => {
    const v = build(pause, audience, medium);
    for (const [index, key] of [[GAME[7], 'F-PAUSE spiel7'], [GAME[8], 'F-PAUSE spiel8']] as const) {
      const m = v.byId.get(idOf(pause, index));
      const expected = EXPECTED_STATE[key];
      expect(m?.status).toBe(expected.status);
      expect(m?.isLive).toBe(true);
      expect(m?.isUpcoming).toBe(false);
      expect([m?.score?.a, m?.score?.b]).toEqual(expected.score);
      expect(m?.score?.winner).toBeNull();
    }
  });

  it('@ZM-041 Spiel 7 ist auf Feld 1 nicht „nächstes Spiel“, Spiel 9 ist es; Spiel 9 nicht laufend', () => {
    const v = build(pause);
    const field = pause.tournament.matches[GAME[7]].field;
    const current = v.currentFor(field);
    expect(current.live.map((m) => m.id)).toEqual([idOf(pause, GAME[7])]);
    expect(current.next?.id).toBe(idOf(pause, GAME[9]));
    expect(v.current.live.map((m) => m.id).sort()).toEqual([idOf(pause, GAME[7]), idOf(pause, GAME[8])].sort());
  });

  it('@ZM-039 Engine-Feinstatus Halbzeit/Strafstoßschießen: live; Engine finished vor Cache running', () => {
    const id7 = idOf(pause, GAME[7]);
    const id8 = idOf(pause, GAME[8]);
    const engine = (id: string) => (id === id7 ? 'section_break' : id === id8 ? 'finished' : undefined);
    const v = buildTournamentView({ ...pause.tournament, engineStatus: engine }, { audience: 'screen', medium: 'app', locale: 'de' });
    expect(v.byId.get(id7)?.status).toBe('paused');
    expect(v.byId.get(id8)?.status).toBe('finished');
    expect(v.byId.get(id8)?.score?.decidedBy).toBeNull(); // 0:0 beendet, Gruppe: nicht entschieden
  });

  // Befund C-ABZEICHEN-WORT
  it.fails('@OB-066 @ZM-039 Wortlaut „Pause“ und „Live“ (de)', () => {
    expect(viewStatusText('paused', 'de')).toBe('Pause');
    expect(viewStatusText('running', 'de')).toBe('Live');
  });

  // EN-Wortlaut steht nicht im Gherkin; Bestandswert bleibt bis zur Entscheidung des Controllers
  it('@ZM-039 Wortlaut (en) bleibt wie im Fixture', () => {
    expect(viewStatusText('paused', 'en')).toBe(EXPECTED_STATE['F-PAUSE spiel7'].statusText.en);
    expect(viewStatusText('running', 'en')).toBe(EXPECTED_STATE['F-PAUSE spiel8'].statusText.en);
  });
});

describe('@ZM-104 F-AUS: ausgefallen ohne Ergebnis, nie laufend oder „nächstes Spiel“', () => {
  it.each(PUBLIC)('@ZM-104 Spiel 9 (%s·%s)', (audience, medium) => {
    const v = build(aus, audience, medium);
    const id9 = idOf(aus, GAME[9]);
    const m = v.byId.get(id9);
    expect(m).toMatchObject({ status: 'cancelled', isLive: false, isUpcoming: false });
    expect(m?.score).toBeUndefined();
    expect(v.current.next?.id).not.toBe(id9);
    expect(v.currentFor(m?.field ?? 0).next?.id).not.toBe(id9);
    expect(v.matches.some((x) => x.id === id9)).toBe(true); // im Filter „Alle“ sichtbar
  });

  it.each(['de', 'en'] as const)('@ZM-104 Wortlaut „ausgefallen“ (%s)', (locale) => {
    expect(viewStatusText('cancelled', locale)).toBe(EXPECTED_STATE['F-AUS spiel9'].statusText[locale]);
  });

  it('@ZM-104 F-WERT: gewertet mit Kennzeichen; im Kindermodus beendet, ohne Ergebnis und ohne Kennzeichen', () => {
    const id = idOf(aus, GAME[10]);
    const forfeit = { ...aus.tournament.matches[GAME[10]], matchStatus: 'finished', scoreA: 2, scoreB: 0 } as Match;
    const awarded = { ...forfeit, decidedBy: 'forfeit' as unknown as MatchDecidedBy }; // Daten liefert A-25
    const matches = aus.tournament.matches.map((m) => (m.id === id ? awarded : m));
    const normal = buildTournamentView({ ...aus.tournament, matches }, { audience: 'viewer', medium: 'app', locale: 'de' });
    expect(normal.byId.get(id)).toMatchObject({ status: 'awarded', score: { a: 2, b: 0 } });
    const kids = buildTournamentView({ ...aus.tournament, matches, hideScoresForPublic: true }, { audience: 'screen', medium: 'app', locale: 'de' });
    expect(kids.byId.get(id)?.status).toBe('finished');
    expect(kids.byId.get(id)?.score).toBeUndefined();
  });
});

describe('@ZM-111 @ZM-141 F-ZEIT: Ortszeit des Turniers, läuft / als Nächstes / zuletzt beendet', () => {
  it('@ZM-111 Spiel 9 steht mit 14:40, obwohl das Gerät in America/New_York steht', () => {
    const v = build(zeit);
    expect(v.byId.get(idOf(zeit, GAME[9]))?.kickoff).toEqual(EXPECTED_TIME.spiel9Kickoff);
  });

  it('@ZM-111 jetzt in Turnierzeit: 13:32 UTC ist 14:32 in Europe/Berlin', () => {
    expect(toTournamentLocal(new Date(Date.UTC(2026, 10, 28, 13, 32)), TOURNAMENT_TIME_ZONE)).toEqual(EXPECTED_TIME.now);
  });

  it('@ZM-141 kein Spiel läuft: Spiel 9 als nächstes Spiel (Feld 1 und ganzes Turnier), zuletzt beendet Spiel 8', () => {
    const v = buildTournamentView(zeit.tournament, { audience: 'viewer', medium: 'app', locale: 'de', now: EXPECTED_TIME.now });
    expect(v.current.live).toEqual([]);
    expect(v.current.next?.id).toBe(idOf(zeit, GAME[9]));
    expect(v.currentFor(zeit.tournament.matches[GAME[9]].field).next?.id).toBe(idOf(zeit, GAME[9]));
    expect(v.current.lastFinished?.id).toBe(idOf(zeit, GAME[8]));
  });

  it('@ZM-141 Gegenbeispiel: ein beendetes Spiel bleibt beendet mit Stand', () => {
    const m = build(zeit).byId.get(idOf(zeit, GAME[3]));
    expect(m).toMatchObject({ status: 'finished', isLive: false, isUpcoming: false, score: { a: 2, b: 1 } });
  });

  it('@ZM-105 Uhrzeiten der K.-o.-Spiele sind voraussichtlich, Gruppenspiele nicht', () => {
    const v = build(zeit);
    expect(v.byId.get(idOf(zeit, GAME.HF1))?.kickoffTentative).toBe(true);
    expect(v.byId.get(idOf(zeit, GAME.FINAL))?.kickoffTentative).toBe(true);
    expect(v.byId.get(idOf(zeit, GAME[9]))?.kickoffTentative).toBe(false);
  });
});

describe('@ET-002 @ET-013 @ZM-147 @ZM-077 Endstand in der Ansicht', () => {
  it('@ET-002 F-NV: HF2 4:1 n. V., Verlängerung 3:0', async () => {
    const cup = await fNV();
    const score = build(cup, 'screen').byId.get(idOf(cup, GAME.HF2))?.score;
    const expected = EXPECTED_STATE['F-NV hf2'];
    expect([score?.a, score?.b]).toEqual(expected.score);
    expect([score?.overtime?.a, score?.overtime?.b]).toEqual(expected.overtime);
    expect(score).toMatchObject({ decidedBy: expected.decidedBy, winner: expected.winner });
  });

  it('@ET-013 @ZM-077 F-ES: Finale 1:1, Strafstoßschießen 4:3 getrennt, Sieger FC Nord', async () => {
    const cup = await fES();
    const final = cup.tournament.matches[GAME.FINAL];
    const score = build(cup, 'screen').byId.get(final.id)?.score;
    const expected = EXPECTED_STATE['F-ES finale'];
    expect([score?.a, score?.b]).toEqual(expected.score);
    expect([score?.penalty?.a, score?.penalty?.b]).toEqual(expected.penalty);
    expect(score).toMatchObject({ decidedBy: expected.decidedBy, winner: expected.winner });
    expect(getMatchWinner(final)?.winner).toBe(NORD);
  });

  it('@ZM-147 F-NUR: nur Ergebnis eingetragen → Endstand ohne Verlauf', async () => {
    const cup = await fNUR();
    const m = build(cup, 'screen').byId.get(idOf(cup, GAME[3]));
    const expected = EXPECTED_STATE['F-NUR spiel3'];
    expect(m?.status).toBe(expected.status);
    expect([m?.score?.a, m?.score?.b]).toEqual(expected.score);
    expect(m?.score).toMatchObject({ decidedBy: expected.decidedBy, winner: expected.winner });
    const log = cup.events.get(idOf(cup, GAME[3])) ?? [];
    expect(log.map((e) => e.type)).toEqual(['RESULT_ENTRY']);
  });

  it('@ZM-077 Kindermodus: kein Endstand auf dem Monitor, die Leitung sieht ihn', async () => {
    const cup = await fES();
    const id = idOf(cup, GAME.FINAL);
    const kids = { ...cup.tournament, hideScoresForPublic: true };
    expect(buildTournamentView(kids, { audience: 'screen', medium: 'app', locale: 'de' }).byId.get(id)?.score).toBeUndefined();
    expect(buildTournamentView(kids, { audience: 'organizer', medium: 'app', locale: 'de' }).byId.get(id)?.score?.winner).toBe('a');
  });
});

describe('Korrektur-Zeit und Platzierung', () => {
  it('correctedAt: Leitung aus der Korrektur-Historie (Turnierzeit), Zuschauer nur aus der Server-Funktion', () => {
    const id = idOf(zeit, GAME[3]);
    const corrected = zeit.tournament.matches.map((m) =>
      m.id === id ? { ...m, correctionHistory: [{ timestamp: '2026-11-28T13:45:00.000Z', previousScoreA: 1, previousScoreB: 1, newScoreA: 2, newScoreB: 1 }] } : m,
    );
    const input = { ...zeit.tournament, matches: corrected, correctedAtPublic: (mid: string) => (mid === id ? { date: '2026-11-28', time: '14:46' } : undefined) };
    expect(buildTournamentView(input, { audience: 'organizer', medium: 'app', locale: 'de' }).byId.get(id)?.correctedAt).toEqual({ date: '2026-11-28', time: '14:45' });
    expect(buildTournamentView(input, { audience: 'viewer', medium: 'app', locale: 'de' }).byId.get(id)?.correctedAt).toEqual({ date: '2026-11-28', time: '14:46' });
    expect(buildTournamentView({ ...input, hideScoresForPublic: true }, { audience: 'viewer', medium: 'app', locale: 'de' }).byId.get(id)?.correctedAt).toBeUndefined();
  });

  it('Platzierung: final nur abgeschlossen und vollständig; Gruppenplätze nur bei Tabellen', async () => {
    const cup = await fHF();
    const ranking = cup.tournament.teams.map((team, index) => ({ place: index + 1, team: { id: team.id, name: team.name } }));
    const groupStandings = new Map([[TeamIdSchema.parse(cup.tournament.teams[0].id), { group: 'A', rank: 1 }]]);
    const input = { ...cup.tournament, finalRanking: ranking, closed: true, groupStandings };
    const organizer = buildTournamentView(input, { audience: 'organizer', medium: 'app', locale: 'de' });
    expect(organizer.placement).toMatchObject({ state: 'final', groupPhaseOpen: true });
    expect(organizer.placement.groupRanks?.size).toBe(1);
    const noTables = buildTournamentView({ ...input, hideRankingsForPublic: true }, { audience: 'viewer', medium: 'app', locale: 'de' });
    expect(noTables.placement.groupRanks).toBeUndefined();
    const partial = buildTournamentView({ ...input, finalRanking: ranking.slice(1) }, { audience: 'organizer', medium: 'app', locale: 'de' });
    expect(partial.placement).toMatchObject({ state: 'open' });
    expect(partial.placement.ranking).toBeUndefined();
  });
});
