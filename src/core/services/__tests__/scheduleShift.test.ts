/**
 * B-26 Zeiten verschieben – Kernregeln aus dem Gherkin des Records `2026-10-02_zeitplan-rueckt-nach.md`
 * (Funktionalitäten A, B, C, E). Beispielturnier „Hallencup Ost“ und „Nikolaus-Turnier“ wie im Record.
 */
import { describe, expect, it } from 'vitest';
import type { Match } from '../../../types/tournament';
import type { ViewMatchStatus } from '../../view/types';
import { teamSlot } from '../../models/matchSlot';
import { testUuid } from '../../../test/testIds';
import {
  hasRestorableTimes,
  originalStartToShow,
  planRestore,
  planShift,
  shiftSchedule,
  type ShiftTimingRules,
} from '../scheduleShift';

const DAY = '2026-11-14';
const at = (hhmm: string): Date => new Date(`${DAY}T${hhmm}:00`);
const hhmm = (d: Date | undefined): string | undefined =>
  d === undefined ? undefined : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

type Stand = 'beendet' | 'läuft' | 'geplant' | 'unterbrochen' | 'ausgefallen';
const STATUS: Record<Stand, ViewMatchStatus> = { beendet: 'finished', läuft: 'running', geplant: 'scheduled', unterbrochen: 'paused', ausgefallen: 'cancelled' };

interface Row { id: string; nr: number; zeit: string; feld: number; stand: Stand; final?: boolean }

function build(rows: Row[]): { matches: Match[]; statusOf: (m: Match) => ViewMatchStatus } {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const matches = rows.map((r): Match => ({
    id: r.id,
    round: 1,
    field: r.feld,
    matchNumber: r.nr,
    slotA: teamSlot(testUuid(r.nr * 2)),
    slotB: teamSlot(testUuid(r.nr * 2 + 1)),
    scheduledTime: at(r.zeit),
    isFinal: r.final === true,
    phase: r.final === true ? 'final' : 'groupStage',
    matchStatus: 'scheduled',
  }));
  return { matches, statusOf: (m) => STATUS[byId.get(m.id)?.stand ?? 'geplant'] };
}

/** Hallencup Ost: 2 Felder, 10 Minuten am Stück, 5 Minuten Pause; es ist 15:05, Spiel 11/12 laufen. */
function hallencup(overrides: Partial<Record<string, Stand>> = {}) {
  const rows: Row[] = ([
    { id: 's9', nr: 9, zeit: '14:45', feld: 1, stand: 'beendet' },
    { id: 's10', nr: 10, zeit: '14:45', feld: 2, stand: 'beendet' },
    { id: 's11', nr: 11, zeit: '15:00', feld: 1, stand: 'läuft' },
    { id: 's12', nr: 12, zeit: '15:00', feld: 2, stand: 'läuft' },
    { id: 's13', nr: 13, zeit: '15:15', feld: 1, stand: 'geplant' },
    { id: 's14', nr: 14, zeit: '15:15', feld: 2, stand: 'geplant' },
    { id: 's15', nr: 15, zeit: '15:30', feld: 1, stand: 'geplant' },
    { id: 's16', nr: 16, zeit: '15:30', feld: 2, stand: 'geplant' },
    { id: 's17', nr: 17, zeit: '15:45', feld: 1, stand: 'geplant' },
    { id: 's18', nr: 18, zeit: '15:45', feld: 2, stand: 'geplant' },
    { id: 'hf1', nr: 19, zeit: '16:15', feld: 1, stand: 'geplant', final: true },
    { id: 'hf2', nr: 20, zeit: '16:15', feld: 2, stand: 'geplant', final: true },
    { id: 'p3', nr: 21, zeit: '16:40', feld: 1, stand: 'geplant', final: true },
    { id: 'fin', nr: 22, zeit: '16:55', feld: 1, stand: 'geplant', final: true },
  ] satisfies Row[]).map((r): Row => ({ ...r, stand: overrides[r.id] ?? r.stand }));
  return build(rows);
}

const RULES: ShiftTimingRules = { groupPhaseGameDuration: 10, groupPhaseBreakDuration: 5, finalRoundGameDuration: 10, finalRoundBreakDuration: 5 };

function timeOf(matches: Match[], id: string): string | undefined {
  return hhmm(matches.find((m) => m.id === id)?.scheduledTime);
}

describe('B – Verschieben mit Vorschau (Hallencup Ost, 15:05)', () => {
  it('@ZP-012 alle Felder ab 15:15 um 10 Minuten nach hinten', () => {
    const { matches, statusOf } = hallencup();
    const result = shiftSchedule(matches, { from: { kind: 'time', at: at('15:15') }, minutes: 10 }, RULES, { now: at('15:05'), statusOf });
    expect(['s13', 's14'].map((id) => timeOf(result, id))).toEqual(['15:25', '15:25']);
    expect(['s15', 's16'].map((id) => timeOf(result, id))).toEqual(['15:40', '15:40']);
    expect(['s17', 's18'].map((id) => timeOf(result, id))).toEqual(['15:55', '15:55']);
    expect(['hf1', 'hf2'].map((id) => timeOf(result, id))).toEqual(['16:25', '16:25']);
    expect(timeOf(result, 'p3')).toBe('16:50');
    expect(timeOf(result, 'fin')).toBe('17:05');
  });

  it('@ZP-013 ab Spiel 15 wirkt auf alle Felder ab dessen Uhrzeit', () => {
    const { matches, statusOf } = hallencup();
    const result = shiftSchedule(matches, { from: { kind: 'match', matchId: 's15' }, minutes: 10 }, RULES, { now: at('15:05'), statusOf });
    expect([timeOf(result, 's15'), timeOf(result, 's16')]).toEqual(['15:40', '15:40']);
    expect([timeOf(result, 's13'), timeOf(result, 's14')]).toEqual(['15:15', '15:15']);
  });

  it('@ZP-015 alle Felder ab 15:45 um 5 Minuten vorziehen', () => {
    const { matches, statusOf } = hallencup();
    const result = shiftSchedule(matches, { from: { kind: 'time', at: at('15:45') }, minutes: -5 }, RULES, { now: at('15:05'), statusOf });
    expect([timeOf(result, 's17'), timeOf(result, 's18')]).toEqual(['15:40', '15:40']);
    expect([timeOf(result, 'hf1'), timeOf(result, 'hf2')]).toEqual(['16:10', '16:10']);
    expect(timeOf(result, 'p3')).toBe('16:35');
    expect(timeOf(result, 'fin')).toBe('16:50');
  });

  it('@ZP-016 laufende und beendete Spiele werden nie verschoben (Gegenbeispiel)', () => {
    const { matches, statusOf } = hallencup();
    const plan = planShift(matches, { from: { kind: 'time', at: at('14:45') }, minutes: 10 }, RULES, { now: at('15:05'), statusOf });
    expect([timeOf(plan.matches, 's9'), timeOf(plan.matches, 's10')]).toEqual(['14:45', '14:45']);
    expect([timeOf(plan.matches, 's11'), timeOf(plan.matches, 's12')]).toEqual(['15:00', '15:00']);
    expect([timeOf(plan.matches, 's13'), timeOf(plan.matches, 's14')]).toEqual(['15:25', '15:25']);
    expect(plan.kept.map((k) => [k.matchNumber, k.reason])).toEqual([[9, 'finished'], [10, 'finished'], [11, 'running'], [12, 'running']]);
  });

  it('@ZP-017 die Vorschau nennt „10 Spiele verschieben sich“ und ändert noch nichts', () => {
    const { matches, statusOf } = hallencup();
    const snapshot = matches.map((m) => hhmm(m.scheduledTime));
    const plan = planShift(matches, { from: { kind: 'time', at: at('15:15') }, minutes: 10 }, RULES, { now: at('15:05'), statusOf });
    expect(plan.changes).toHaveLength(10);
    // ohne Bestätigung ändert sich nichts (@ZP-018): die Eingabe bleibt unberührt
    expect(matches.map((m) => hhmm(m.scheduledTime))).toEqual(snapshot);
  });

  // Befund: das „voraussichtliche Ende“ des Records rechnet eine Reserve für Verlängerung und Strafstoßschießen ein (17:25 vorher,
  // 17:35 danach); ihre Höhe ist im Record Zeitrahmen und Fairness geparkt. Die App zeigt das Ende des letzten Spiels (17:15).
  it.fails('@ZP-017 neues Ende 17:35 (mit Reserve für Verlängerung und Strafstoßschießen)', () => {
    const { matches, statusOf } = hallencup();
    const plan = planShift(matches, { from: { kind: 'time', at: at('15:15') }, minutes: 10 }, RULES, { now: at('15:05'), statusOf });
    expect(hhmm(plan.newEnd)).toBe('17:35');
  });

  it('@ZP-062 ein unterbrochenes Spiel 11 („Ergebnis folgt“) behält seine Uhrzeit und zählt nicht mit', () => {
    const { matches, statusOf } = hallencup({ s11: 'unterbrochen' });
    const plan = planShift(matches, { from: { kind: 'time', at: at('15:00') }, minutes: 10 }, RULES, { now: at('15:05'), statusOf });
    expect(timeOf(plan.matches, 's11')).toBe('15:00');
    expect(plan.changes.map((c) => c.matchId)).not.toContain('s11');
    expect([timeOf(plan.matches, 's13'), timeOf(plan.matches, 's14')]).toEqual(['15:25', '15:25']);
  });

  it('@ZP-062 ein ausgefallenes Spiel 11 behält seine Uhrzeit und zählt nicht mit', () => {
    const { matches, statusOf } = hallencup({ s11: 'ausgefallen' });
    const plan = planShift(matches, { from: { kind: 'time', at: at('15:00') }, minutes: 10 }, RULES, { now: at('15:05'), statusOf });
    expect(timeOf(plan.matches, 's11')).toBe('15:00');
    expect(plan.changes.map((c) => c.matchId)).not.toContain('s11');
    expect([timeOf(plan.matches, 's13'), timeOf(plan.matches, 's14')]).toEqual(['15:25', '15:25']);
  });

  it('@ZP-057 in die Vergangenheit zieht die App kein Spiel vor', () => {
    const { matches, statusOf } = hallencup({ s11: 'beendet', s12: 'beendet', s13: 'läuft', s14: 'läuft' });
    const plan = planShift(matches, { from: { kind: 'time', at: at('15:30') }, minutes: -15 }, RULES, { now: at('15:20'), statusOf });
    expect(plan.error?.kind).toBe('past');
    expect(plan.error?.matches.map((m) => [m.matchNumber, hhmm(m.to)])).toEqual([[15, '15:15'], [16, '15:15']]);
    expect(plan.matches.map((m) => hhmm(m.scheduledTime))).toEqual(matches.map((m) => hhmm(m.scheduledTime)));
    expect(plan.error?.maxMinutes).toBe(10);
  });

  it('@ZP-006/@ZP-007/@ZP-009 ohne Verschieben ändert sich keine Uhrzeit (0 Minuten = keine Änderung)', () => {
    const { matches, statusOf } = hallencup({ s13: 'beendet' });
    const plan = planShift(matches, { from: { kind: 'time', at: at('15:15') }, minutes: 0 }, RULES, { now: at('15:22'), statusOf });
    expect(plan.changes).toEqual([]);
    expect(timeOf(plan.matches, 's15')).toBe('15:30');
    expect(originalStartToShow(plan.matches.find((m) => m.id === 's15')!)).toBeUndefined();
  });
});

describe('A – Zeiten ehrlich anzeigen: „ursprünglich“', () => {
  it('@ZP-010 eine verschobene K.-o.-Uhrzeit trägt „ursprünglich“', () => {
    const { matches, statusOf } = hallencup();
    const result = shiftSchedule(matches, { from: { kind: 'time', at: at('15:15') }, minutes: 10 }, RULES, { now: at('15:05'), statusOf });
    const hf1 = result.find((m) => m.id === 'hf1')!;
    const fin = result.find((m) => m.id === 'fin')!;
    expect([hhmm(hf1.scheduledTime), hhmm(originalStartToShow(hf1))]).toEqual(['16:25', '16:15']);
    expect([hhmm(fin.scheduledTime), hhmm(originalStartToShow(fin))]).toEqual(['17:05', '16:55']);
  });

  it('@ZP-004 schon ab 1 Minute Abweichung steht die ursprüngliche Uhrzeit dabei', () => {
    const { matches, statusOf } = hallencup();
    const result = shiftSchedule(matches, { from: { kind: 'time', at: at('15:30') }, minutes: 1 }, RULES, { now: at('15:05'), statusOf });
    const s15 = result.find((m) => m.id === 's15')!;
    expect([hhmm(s15.scheduledTime), hhmm(originalStartToShow(s15))]).toEqual(['15:31', '15:30']);
  });

  it('@ZP-005 stimmt die Uhrzeit wieder, verschwindet der Zusatz (Gegenbeispiel)', () => {
    const { matches, statusOf } = hallencup();
    const later = shiftSchedule(matches, { from: { kind: 'time', at: at('15:30') }, minutes: 10 }, RULES, { now: at('15:05'), statusOf });
    const back = shiftSchedule(later, { from: { kind: 'time', at: at('15:40') }, minutes: -10 }, RULES, { now: at('15:06'), statusOf });
    const s15 = back.find((m) => m.id === 's15')!;
    expect(hhmm(s15.scheduledTime)).toBe('15:30');
    expect(originalStartToShow(s15)).toBeUndefined();
  });

  it('@ZP-049 vor dem ersten Anpfiff ist Verschieben Planung: kein „ursprünglich“', () => {
    const { matches, statusOf } = hallencup(Object.fromEntries(['s9', 's10', 's11', 's12'].map((id) => [id, 'geplant' as const])));
    const result = shiftSchedule(matches, { from: { kind: 'time', at: at('14:45') }, minutes: 15 }, RULES, { now: at('12:30'), statusOf });
    expect(result.every((m) => originalStartToShow(m) === undefined)).toBe(true);
    expect(timeOf(result, 's9')).toBe('15:00');
  });
});

/** Nikolaus-Turnier: ein Feld, Spiel 1 um 16:30, alle 10 Minuten, 15 Spiele, noch kein Anpfiff. */
function nikolaus() {
  const rows: Row[] = Array.from({ length: 15 }, (_, i) => {
    const minutes = 16 * 60 + 30 + i * 10;
    return { id: `n${i + 1}`, nr: i + 1, zeit: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`, feld: 1, stand: 'geplant' as const };
  });
  return build(rows);
}
const NIKOLAUS_RULES: ShiftTimingRules = { groupPhaseGameDuration: 10, groupPhaseBreakDuration: 0 };

describe('Vorziehen vor dem ersten Anpfiff (Nikolaus-Turnier)', () => {
  it('@ZP-089 um 16:10 alles ab Spiel 1 um 15 Minuten vor: Zusammenfassung, Warnung ohne Sperre', () => {
    const { matches, statusOf } = nikolaus();
    const plan = planShift(matches, { from: { kind: 'match', matchId: 'n1' }, minutes: -15 }, NIKOLAUS_RULES, { now: at('16:10'), statusOf });
    expect(plan.error).toBeUndefined();
    expect([hhmm(plan.changes[0].from), hhmm(plan.changes[0].to)]).toEqual(['16:30', '16:15']);
    expect(plan.changes).toHaveLength(15);
    expect(hhmm(plan.newEnd)).toBe('18:45');
    const soon = plan.warnings.find((w) => w.kind === 'soon');
    expect(soon).toMatchObject({ kind: 'soon', matchNumbers: [1], inMinutes: 5 });
  });

  it('@ZP-090 bei kurzfristigem Vorziehen steht bei Spiel 1 „ursprünglich 16:30“', () => {
    const { matches, statusOf } = nikolaus();
    const result = shiftSchedule(matches, { from: { kind: 'match', matchId: 'n1' }, minutes: -15 }, NIKOLAUS_RULES, { now: at('16:10'), statusOf });
    expect([timeOf(result, 'n1'), hhmm(originalStartToShow(result[0]))]).toEqual(['16:15', '16:30']);
    expect(timeOf(result, 'n2')).toBe('16:25');
  });

  it('@ZP-091 früh genug vorgezogen bleibt es Planung ohne „ursprünglich“ (Gegenbeispiel)', () => {
    const { matches, statusOf } = nikolaus();
    const plan = planShift(matches, { from: { kind: 'match', matchId: 'n1' }, minutes: -15 }, NIKOLAUS_RULES, { now: at('15:30'), statusOf });
    expect(timeOf(plan.matches, 'n1')).toBe('16:15');
    expect(originalStartToShow(plan.matches[0])).toBeUndefined();
    expect(plan.warnings.filter((w) => w.kind === 'soon')).toEqual([]);
  });
});

describe('C – Puffer auf dem Feld', () => {
  it('@ZP-096 Vorziehen ab Spiel 2 um 1 Minute: „Feld 1: zwischen Spiel 1 und 2 nur 0 statt 1 Minute Pause“', () => {
    const { matches, statusOf } = build([
      { id: 'p1', nr: 1, zeit: '16:00', feld: 1, stand: 'läuft' },
      { id: 'p2', nr: 2, zeit: '16:10', feld: 1, stand: 'geplant' },
      { id: 'p3', nr: 3, zeit: '16:20', feld: 1, stand: 'geplant' },
    ]);
    const rules: ShiftTimingRules = { groupPhaseGameDuration: 9, groupPhaseBreakDuration: 1 };
    const plan = planShift(matches, { from: { kind: 'match', matchId: 'p2' }, minutes: -1 }, rules, { now: at('16:03'), statusOf });
    expect(plan.error).toBeUndefined(); // Olli kann trotzdem bestätigen
    expect(plan.warnings.filter((w) => w.kind === 'buffer')).toEqual([
      { kind: 'buffer', field: 1, before: 1, after: 2, gapMinutes: 0, requiredMinutes: 1 },
    ]);
  });

  it('@ZP-097 nach hinten verschieben behält den Takt und warnt nicht zum Puffer (Gegenbeispiel)', () => {
    const { matches, statusOf } = build([
      { id: 't1', nr: 1, zeit: '16:10', feld: 1, stand: 'geplant' },
      { id: 't2', nr: 2, zeit: '16:20', feld: 1, stand: 'geplant' },
      { id: 't3', nr: 3, zeit: '16:30', feld: 1, stand: 'geplant' },
    ]);
    const rules: ShiftTimingRules = { groupPhaseGameDuration: 9, groupPhaseBreakDuration: 1 };
    const plan = planShift(matches, { from: { kind: 'time', at: at('16:10') }, minutes: 5 }, rules, { now: at('15:00'), statusOf });
    expect(plan.matches.map((m) => hhmm(m.scheduledTime))).toEqual(['16:15', '16:25', '16:35']);
    expect(plan.warnings.filter((w) => w.kind === 'buffer')).toEqual([]);
  });
});

describe('E – Ursprüngliche Uhrzeiten wiederherstellen', () => {
  it('@ZP-036 nach dem Verschieben stellt Olli die ursprünglichen Uhrzeiten wieder her', () => {
    const { matches, statusOf } = hallencup();
    const shifted = shiftSchedule(matches, { from: { kind: 'time', at: at('15:15') }, minutes: 10 }, RULES, { now: at('15:05'), statusOf });
    expect(hasRestorableTimes(shifted, { statusOf })).toBe(true);
    const plan = planRestore(shifted, RULES, { now: at('15:06'), statusOf });
    expect(plan.changes).toHaveLength(10);
    expect([timeOf(plan.matches, 's13'), timeOf(plan.matches, 's14')]).toEqual(['15:15', '15:15']);
    expect(plan.matches.map((m) => hhmm(m.scheduledTime))).toEqual(matches.map((m) => hhmm(m.scheduledTime)));
    expect(plan.matches.every((m) => originalStartToShow(m) === undefined)).toBe(true);
    expect(hasRestorableTimes(plan.matches, { statusOf })).toBe(false);
  });

  it('@ZP-037 beim Wiederherstellen behalten schon angepfiffene Spiele ihre Uhrzeit mit „ursprünglich“', () => {
    const base = hallencup();
    const shifted = shiftSchedule(base.matches, { from: { kind: 'time', at: at('15:15') }, minutes: 10 }, RULES, { now: at('15:05'), statusOf: base.statusOf });
    const later = hallencup({ s11: 'beendet', s12: 'beendet', s13: 'beendet', s14: 'beendet' });
    const plan = planRestore(shifted, RULES, { now: at('15:37'), statusOf: later.statusOf });
    for (const id of ['s13', 's14']) {
      const m = plan.matches.find((x) => x.id === id)!;
      expect([hhmm(m.scheduledTime), hhmm(originalStartToShow(m))]).toEqual(['15:25', '15:15']);
    }
  });
});
