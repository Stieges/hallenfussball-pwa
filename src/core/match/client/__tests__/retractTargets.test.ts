/**
 * C3b-1 (Plan §2 C3b-1 Nr. 3, G1/G1a/G1b/G2/G2a/G3/G5): Zielwahl und Sperrgruende, framework-frei.
 */
import { describe, it, expect } from 'vitest';
import { applyEvent, reduceMatch, type Actor, type EngineEvent, type MatchRules, type MatchState } from '../../';
import { canAmendField, minusTarget, undoTarget, type TargetInput } from '../retractTargets';
import { RULES, ctx, ev, goal, start } from './fixtures';

const AT = 9_000_000;

const KO_RULES: MatchRules = {
  ...RULES,
  sections: 1,
  knockout: true,
  tiebreak: 'overtime-then-shootout',
  overtimeSeconds: 300,
};

const startWith = (rules: MatchRules): EngineEvent =>
  ev({ id: 's', type: 'MATCH_START', at: 1000, payload: { rules } });

function input(log: EngineEvent[], actor: Actor): TargetInput & { state: MatchState } {
  const { state } = reduceMatch(log, ctx);
  return { state, log, ctx, actor, at: AT };
}

const card = (id: string, type: 'YELLOW_CARD' | 'RED_CARD', teamId: string, at: number, actor: Actor = 'helper') =>
  ev({ id, type, at, teamId, clockMs: at, actor, payload: { playerNumber: 5 } });

const end = (at: number) => ev({ id: `end${at}`, type: 'MATCH_END', at, section: 1, clockMs: 600_000 });

describe('undoTarget: Wahl des Ziels (G1, G1a, G2a)', () => {
  it('G1: ein FREMDER Eintrag (anderer Akteur) ist fuer den Helfer zurücknehmbar, kein Autor-Filter', () => {
    const log = [start(), { ...goal('g1', 'teamA', 2000, 30_000), actor: 'leitung' as const }];
    const result = undoTarget(input(log, 'helper'));
    expect(result.target?.id).toBe('g1');
    expect(result.blockReason).toBeNull();
  });

  it('G2a: Reihenfolge der Ansicht [A(seq1), B(seq2), pending C] -> Ziel C, dann B, dann A', () => {
    const a = goal('A', 'teamA', 2000, 10_000);
    const b = card('B', 'YELLOW_CARD', 'teamB', 3000);
    const c = goal('C', 'teamB', 4000, 30_000);
    const base = [start(), a, b, c];
    expect(undoTarget(input(base, 'helper')).target?.id).toBe('C');
    const afterC = [...base, ev({ id: 'r1', type: 'RETRACT', at: 5000, targetId: 'C' })];
    expect(undoTarget(input(afterC, 'helper')).target?.id).toBe('B');
    const afterB = [...afterC, ev({ id: 'r2', type: 'RETRACT', at: 6000, targetId: 'B' })];
    expect(undoTarget(input(afterB, 'helper')).target?.id).toBe('A');
    const afterA = [...afterB, ev({ id: 'r3', type: 'RETRACT', at: 7000, targetId: 'A' })];
    expect(undoTarget(input(afterA, 'helper'))).toEqual({ target: null, blockReason: null });
  });

  it('G1a: AMEND wird uebersprungen -- Rueckgaengig trifft das Tor, nicht die Bearbeitung', () => {
    const log = [
      start(),
      goal('g1', 'teamA', 2000, 30_000),
      ev({ id: 'a1', type: 'AMEND', at: 2500, targetId: 'g1', payload: { playerNumber: 7 } }),
    ];
    const result = undoTarget(input(log, 'helper'));
    expect(result.target?.id).toBe('g1');
    expect(result.target?.playerNumber).toBe(7);
  });

  it('G1a: Leitung, Tor + CORRECTION + Tor -> Rueckgaengig zielt auf das letzte Tor', () => {
    const log = [
      start(),
      goal('g1', 'teamA', 2000, 30_000),
      end(3000),
      ev({
        id: 'c1', type: 'CORRECTION', actor: 'leitung', at: 4000, section: null,
        payload: { scores: { teamA: 0, teamB: 0 }, reason: 'Fehler', basedOn: 'g1' },
      }),
      ev({ id: 'ro', type: 'REOPEN', actor: 'leitung', at: 5000, section: null }),
      goal('g2', 'teamB', 6000, 700_000),
    ];
    expect(undoTarget(input(log, 'leitung')).target?.id).toBe('g2');
  });

  it('G1: CORRECTION nimmt der Helfer nicht zurueck (Engine, retract.ts K2)', () => {
    const log = [
      start(),
      goal('g1', 'teamA', 2000, 30_000),
      end(3000),
      ev({
        id: 'c1', type: 'CORRECTION', actor: 'leitung', at: 4000, section: null,
        payload: { scores: { teamA: 0, teamB: 0 }, reason: 'Fehler', basedOn: 'g1' },
      }),
      ev({ id: 'ro', type: 'REOPEN', actor: 'leitung', at: 5000, section: null }),
    ];
    const { state } = reduceMatch(log, ctx);
    const helperRetract = ev({ id: 'x', type: 'RETRACT', at: AT, targetId: 'c1', actor: 'helper' });
    const result = applyEvent(state, helperRetract, ctx);
    expect(result.status).toBe('rejected');
    expect(result.status === 'rejected' ? result.code : null).toBe('FORBIDDEN_ACTOR');
    // ... und die Zielwahl bietet die CORRECTION nie an (nur das alte, nun ueberholte Tor).
    expect(undoTarget(input(log, 'helper')).target?.id).not.toBe('c1');
  });

  it('kein Kandidat: Knopf nur deaktiviert, kein Hinweis', () => {
    expect(undoTarget(input([start()], 'helper'))).toEqual({ target: null, blockReason: null });
  });

  it('beschreibt die Karte mit Team und Nummer', () => {
    const result = undoTarget(input([start(), card('k1', 'RED_CARD', 'teamB', 3000)], 'helper'));
    expect(result.target).toEqual({ id: 'k1', kind: 'redCard', teamId: 'teamB', playerNumber: 5 });
  });
});

describe('Sperren nach dem Abpfiff (G1b, G3) -- nur in der Oberflaeche, VOR dem Probelauf', () => {
  const finishedLog = [start(), goal('g1', 'teamA', 2000, 30_000), card('k1', 'YELLOW_CARD', 'teamB', 3000), end(4000)];

  it('Helfer, finished: Rueckgaengig und Minus gesperrt, Grund finishedHelper', () => {
    const helper = input(finishedLog, 'helper');
    expect(helper.state.status).toBe('finished');
    expect(undoTarget(helper)).toEqual({ target: null, blockReason: 'finishedHelper' });
    expect(minusTarget(helper, 'teamA')).toEqual({ target: null, blockReason: 'finishedHelper' });
  });

  it('Leitung, finished, Karte: Rueckgaengig gesperrt (finishedLeitung), obwohl die Engine RETRACT der Karte erlaubt', () => {
    const leitung = input(finishedLog, 'leitung');
    const probe = ev({ id: 'p', type: 'RETRACT', at: AT, targetId: 'k1', actor: 'leitung' });
    expect(applyEvent(leitung.state, probe, ctx).status).toBe('accepted');
    expect(undoTarget(leitung)).toEqual({ target: null, blockReason: 'finishedLeitung' });
    expect(minusTarget(leitung, 'teamA')).toEqual({ target: null, blockReason: 'finishedLeitung' });
  });

  it('finished ohne jeden Eintrag: kein Hinweis (nichts zum Zuruecknehmen)', () => {
    expect(undoTarget(input([start(), end(4000)], 'helper'))).toEqual({ target: null, blockReason: null });
  });

  it('decision_pending: Grund decisionPending', () => {
    const noTiebreak: MatchRules = { ...KO_RULES, tiebreak: null };
    const log = [startWith(noTiebreak), goal('g1', 'teamA', 2000, 30_000), goal('g2', 'teamB', 3000, 40_000), end(4000)];
    const result = input(log, 'helper');
    expect(result.state.status).toBe('decision_pending');
    expect(undoTarget(result)).toEqual({ target: null, blockReason: 'decisionPending' });
    expect(minusTarget(result, 'teamA')).toEqual({ target: null, blockReason: 'decisionPending' });
  });
});

describe('minusTarget (G2, G3, G6)', () => {
  it('nimmt das letzte Tor des Teams, ohne Autor-Filter', () => {
    const log = [
      start(),
      goal('g1', 'teamA', 2000, 10_000),
      { ...goal('g2', 'teamA', 3000, 20_000), actor: 'leitung' as const },
      goal('g3', 'teamB', 4000, 30_000),
    ];
    expect(minusTarget(input(log, 'helper'), 'teamA').target?.id).toBe('g2');
    expect(minusTarget(input(log, 'helper'), 'teamB').target?.id).toBe('g3');
  });

  it('OWN_GOAL von teamA zaehlt fuer teamB und ist dessen Minus-Ziel', () => {
    const log = [start(), ev({ id: 'og', type: 'OWN_GOAL', at: 2000, teamId: 'teamA', clockMs: 20_000 })];
    expect(minusTarget(input(log, 'helper'), 'teamB').target).toMatchObject({ id: 'og', kind: 'ownGoal' });
    expect(minusTarget(input(log, 'helper'), 'teamA')).toEqual({ target: null, blockReason: null });
  });

  it('STALE_BASE: Tor vor der letzten Korrektur -> deaktiviert mit Grund staleBase; spaeteres Tor bleibt zurücknehmbar', () => {
    const base = [
      start(),
      goal('g1', 'teamA', 2000, 30_000),
      end(3000),
      ev({
        id: 'c1', type: 'CORRECTION', actor: 'leitung', at: 4000, section: null,
        payload: { scores: { teamA: 0, teamB: 0 }, reason: 'Fehler', basedOn: 'g1' },
      }),
      ev({ id: 'ro', type: 'REOPEN', actor: 'leitung', at: 5000, section: null }),
    ];
    expect(minusTarget(input(base, 'leitung'), 'teamA')).toEqual({ target: null, blockReason: 'staleBase' });
    const withNewer = [...base, goal('g2', 'teamA', 6000, 650_000)];
    expect(minusTarget(input(withNewer, 'leitung'), 'teamA').target?.id).toBe('g2');
  });

  it('Verlaengerung: Tor der regulaeren Zeit nicht zurücknehmbar (Grund regularGoal); Verlaengerungstor schon', () => {
    const regular = [
      startWith(KO_RULES),
      goal('g1', 'teamA', 2000, 30_000),
      goal('g2', 'teamB', 3000, 40_000),
      end(601_000),
    ];
    const pause = input(regular, 'helper');
    expect(pause.state.status).toBe('section_break');
    expect(pause.state.phase).toBe('overtime');
    expect(minusTarget(pause, 'teamA')).toEqual({ target: null, blockReason: 'regularGoal' });

    const running = [
      ...regular,
      ev({ id: 'ss', type: 'SECTION_START', at: 661_000, section: 2, clockMs: 600_000 }),
    ];
    expect(minusTarget(input(running, 'helper'), 'teamA')).toEqual({ target: null, blockReason: 'regularGoal' });
    const withOvertimeGoal = [...running, goal('g3', 'teamA', 700_000, 640_000)];
    expect(minusTarget(input(withOvertimeGoal, 'helper'), 'teamA').target?.id).toBe('g3');
    expect(minusTarget(input(withOvertimeGoal, 'helper'), 'teamB')).toEqual({ target: null, blockReason: 'regularGoal' });
  });

  it('Strafstoßschießen: Minus deaktiviert (Grund shootout)', () => {
    const shootoutRules: MatchRules = { ...KO_RULES, tiebreak: 'shootout' };
    const log = [
      startWith(shootoutRules),
      goal('g1', 'teamA', 2000, 30_000),
      goal('g2', 'teamB', 3000, 40_000),
      end(601_000),
    ];
    const result = input(log, 'helper');
    expect(result.state.status).toBe('shootout');
    expect(minusTarget(result, 'teamA')).toEqual({ target: null, blockReason: 'shootout' });
  });

  it('kein Tor des Teams: kein Ziel, kein Grund', () => {
    expect(minusTarget(input([start()], 'helper'), 'teamA')).toEqual({ target: null, blockReason: null });
  });
});

describe('canAmendField (G5)', () => {
  const goalWithoutNumber = goal('g1', 'teamA', 2000, 30_000);
  const goalWithNumber = goal('g2', 'teamA', 2500, 35_000, { playerNumber: 9 });

  it('Helfer, finished, Tor "Ohne Nr." -> Nummer nachtragen erlaubt (Engine nimmt es an)', () => {
    const helper = input([start(), goalWithoutNumber, end(4000)], 'helper');
    expect(canAmendField(helper, 'g1', 'playerNumber')).toEqual({ allowed: true, reason: null });
    const amend = ev({ id: 'a', type: 'AMEND', at: AT, targetId: 'g1', actor: 'helper', payload: { playerNumber: 7 } });
    expect(applyEvent(helper.state, amend, ctx).status).toBe('accepted');
  });

  it('Helfer, finished, gesetzte Nummer -> gesperrt (finishedHelperLocked)', () => {
    const helper = input([start(), goalWithNumber, end(4000)], 'helper');
    expect(canAmendField(helper, 'g2', 'playerNumber')).toEqual({ allowed: false, reason: 'finishedHelperLocked' });
  });

  it('Leitung, finished, gesetzte Nummer aendern -> erlaubt (Engine nimmt es an)', () => {
    const leitung = input([start(), goalWithNumber, end(4000)], 'leitung');
    expect(canAmendField(leitung, 'g2', 'playerNumber')).toEqual({ allowed: true, reason: null });
    const amend = ev({ id: 'a', type: 'AMEND', at: AT, targetId: 'g2', actor: 'leitung', payload: { playerNumber: 3 } });
    expect(applyEvent(leitung.state, amend, ctx).status).toBe('accepted');
  });

  it('laufendes Spiel: Helfer darf gesetzte Nummer aendern (kein Autor-Filter)', () => {
    const helper = input([start(), goalWithNumber], 'helper');
    expect(canAmendField(helper, 'g2', 'playerNumber').allowed).toBe(true);
  });

  it('zurueckgenommenes und unbekanntes Ziel: nicht bearbeitbar', () => {
    const log = [start(), goalWithNumber, ev({ id: 'r', type: 'RETRACT', at: 3000, targetId: 'g2' })];
    expect(canAmendField(input(log, 'helper'), 'g2', 'playerNumber')).toEqual({ allowed: false, reason: 'retracted' });
    expect(canAmendField(input(log, 'helper'), 'nix', 'playerNumber')).toEqual({ allowed: false, reason: 'unknownTarget' });
  });
});
