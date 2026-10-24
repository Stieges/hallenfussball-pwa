/**
 * B-27 „ursprünglich“ in der gemeinsamen Ansicht (Zuschauer-Seite und Monitor lesen `MatchView.originalKickoff`).
 * Aus dem Gherkin `2026-10-02_zeitplan-rueckt-nach.md`: @ZP-004, @ZP-005, @ZP-049, @ZP-045 (Zone 1), @ZP-090, @ZP-091, @ZM-105.
 * Beispielturnier „Hallencup Nord“ (Fixture), Spiel 9 steht um 14:40; die Uhrzeiten werden je Fall gesetzt.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { buildTournamentView } from '../tournamentView';
import { shiftSchedule, type ShiftTimingRules } from '../../services/scheduleShift';
import type { TournamentView } from '../types';
import type { Match } from '../../../types/tournament';
import { fPAUSE, GAME, type Hallencup } from '../__fixtures__/hallencupNord';

const DAY = '2026-11-28';
const at = (hhmm: string): Date => new Date(`${DAY}T${hhmm}:00`);

let cup: Hallencup;
beforeAll(async () => {
  cup = await fPAUSE();
});

const idOf = (index: number): string => cup.tournament.matches[index].id;
const withTimes = (id: string, shown: string, original?: string): Match[] => cup.tournament.matches.map((m) => (
  m.id === id ? { ...m, scheduledTime: at(shown), ...(original === undefined ? {} : { originalStart: at(original) }) } : { ...m, originalStart: undefined }
));
const viewOf = (matches: Match[], edition?: 'blank' | 'plan'): TournamentView => buildTournamentView(
  { ...cup.tournament, matches },
  { audience: 'viewer', medium: 'app', locale: 'de', ...(edition === undefined ? {} : { edition }) },
);

describe('@ZP-004 ab 1 Minute Abweichung steht die ursprüngliche Uhrzeit dabei', () => {
  it.each([
    ['1 Minute nach hinten', '15:31', '15:30'],
    ['10 Minuten nach hinten', '15:40', '15:30'],
    ['5 Minuten nach vorn', '15:25', '15:30'],
  ])('%s: groß %s, klein „ursprünglich %s“', (_name, shown, original) => {
    const id = idOf(GAME[9]);
    const match = viewOf(withTimes(id, shown, original)).byId.get(id);
    expect(match?.kickoff?.time).toBe(shown);
    expect(match?.originalKickoff?.time).toBe(original);
  });

  it('@ZP-005 Gegenbeispiel: stimmt die Uhrzeit wieder überein, verschwindet der Zusatz', () => {
    const id = idOf(GAME[9]);
    const match = viewOf(withTimes(id, '15:30', '15:30')).byId.get(id);
    expect(match?.kickoff?.time).toBe('15:30');
    expect(match?.originalKickoff).toBeUndefined();
  });

  it('@ZP-004 Gegenbeispiel: ein Spiel, das nie verschoben wurde, trägt keine ursprüngliche Uhrzeit', () => {
    const id = idOf(GAME[9]);
    const v = viewOf(withTimes(id, '15:30'));
    expect(v.byId.get(id)?.originalKickoff).toBeUndefined();
    expect(v.matches.filter((m) => m.originalKickoff !== undefined)).toEqual([]);
  });

  it('die Vorlage (leerer Spielplan zum Ausfüllen) zeigt keine ursprüngliche Uhrzeit', () => {
    const id = idOf(GAME[9]);
    expect(viewOf(withTimes(id, '15:40', '15:30'), 'blank').byId.get(id)?.originalKickoff).toBeUndefined();
  });
});

describe('@ZP-049 @ZP-090 @ZP-091 wann nach dem Verschieben „ursprünglich“ in der Ansicht ankommt', () => {
  const RULES: ShiftTimingRules = { groupPhaseGameDuration: 10, groupPhaseBreakDuration: 5 };
  const ohneAnpfiff = (): Match[] => cup.tournament.matches.map((m) => ({ ...m, originalStart: undefined, matchStatus: 'scheduled' as const }));

  it('@ZP-049 vor dem ersten Anpfiff verschoben (Planung): bei keinem Spiel steht „ursprünglich“', () => {
    const matches = ohneAnpfiff();
    const from = matches.find((m) => m.id === idOf(GAME[9]))?.scheduledTime;
    expect(from).toBeDefined();
    // 12:30, kein Spiel angepfiffen: Verschiebung ab 13:00 um 15 Minuten nach hinten
    const result = shiftSchedule(matches, { from: { kind: 'time', at: new Date(`${DAY}T13:00:00`) }, minutes: 15 }, RULES, {
      now: at('12:30'),
      statusOf: () => 'scheduled',
    });
    expect(result.some((m, i) => m.scheduledTime?.getTime() !== matches[i].scheduledTime?.getTime())).toBe(true);
    expect(viewOf(result).matches.filter((m) => m.originalKickoff !== undefined)).toEqual([]);
  });

  it('@ZP-004 nach dem ersten Anpfiff verschoben: das Spiel zeigt die Uhrzeit beim ersten Anpfiff', () => {
    const matches = ohneAnpfiff();
    const id = idOf(GAME[9]);
    const before = matches.find((m) => m.id === id)?.scheduledTime;
    const firstKickoff = matches[0].scheduledTime;
    expect(before).toBeDefined();
    expect(firstKickoff).toBeDefined();
    const result = shiftSchedule(matches, { from: { kind: 'match', matchId: id }, minutes: 10 }, RULES, {
      now: new Date((before!).getTime() - 3_600_000),
      statusOf: (m) => (m.id === matches[0].id ? 'running' : 'scheduled'),
    });
    const shown = viewOf(result).byId.get(id);
    const view0 = viewOf(matches).byId.get(id);
    expect(shown?.originalKickoff).toEqual(view0?.kickoff);
    expect(shown?.kickoff?.time).not.toBe(view0?.kickoff?.time);
  });

  it('@ZP-090 kurzfristig vorgezogen (neuer Anpfiff in unter 30 Minuten): „ursprünglich 16:30“ bei Spiel 1', () => {
    const id = idOf(GAME[9]);
    const matches = ohneAnpfiff().map((m) => (m.id === id ? { ...m, scheduledTime: at('16:30') } : m));
    const result = shiftSchedule(matches, { from: { kind: 'match', matchId: id }, minutes: -15 }, RULES, { now: at('16:10'), statusOf: () => 'scheduled' });
    const shown = viewOf(result).byId.get(id);
    expect(shown?.kickoff?.time).toBe('16:15');
    expect(shown?.originalKickoff?.time).toBe('16:30');
  });

  it('@ZP-091 Gegenbeispiel: früh genug vorgezogen bleibt es Planung, ohne „ursprünglich“', () => {
    const id = idOf(GAME[9]);
    const matches = ohneAnpfiff().map((m) => (m.id === id ? { ...m, scheduledTime: at('16:30') } : m));
    const result = shiftSchedule(matches, { from: { kind: 'match', matchId: id }, minutes: -15 }, RULES, { now: at('15:30'), statusOf: () => 'scheduled' });
    const shown = viewOf(result).byId.get(id);
    expect(shown?.kickoff?.time).toBe('16:15');
    expect(shown?.originalKickoff).toBeUndefined();
  });
});

describe('@ZM-105 Uhrzeiten der K.-o.-Spiele sind „voraussichtlich“, auch verschoben mit ihrer ursprünglichen (@ZP-048)', () => {
  it('Finale steht verschoben um 17:05 als „voraussichtlich“ mit „ursprünglich 16:55“', () => {
    const id = idOf(GAME.FINAL);
    const final = viewOf(withTimes(id, '17:05', '16:55')).byId.get(id);
    expect(final).toMatchObject({ kickoffTentative: true, kickoff: { time: '17:05' }, originalKickoff: { time: '16:55' } });
  });

  it('Gegenbeispiel: ein verschobenes Gruppenspiel ist nicht „voraussichtlich“', () => {
    const id = idOf(GAME[9]);
    expect(viewOf(withTimes(id, '15:40', '15:30')).byId.get(id)?.kickoffTentative).toBe(false);
  });
});
