/**
 * ZA-3 D1 / E1 – Entscheidungsart je K.-o.-Phase mit Rückfall (Befund C-KO-RUNDENREGEL-SERVER).
 *
 * Testwerte aus dem Gherkin: @W2A-007 / @W2A-039 (docs/anforderungen/2026-09-27_wizard-regelinhalte.md),
 * @SL-053 / @SL-145 (2026-10-02_spiel-leiten.md). Geprüft werden der TS-Zwilling der Server-Regeln
 * (`serverRules`, Gleichlauf mit match_engine.server_rules über __fixtures__/rules/*) und die
 * Client-Ermittlung `tiebreakSource` (Kennzeichen `fallback` für den Hinweis im Cockpit, 3.6).
 */
import { describe, expect, it } from 'vitest';
import { serverRules, type ServerRulesInput } from '../client/serverRules';
import { continueLog } from '../reduceMatch';
import { initialState } from '../applyEvent';
import { knockoutRoundOf, resolveTiebreakMode, tiebreakSource } from '../tiebreakDecision';
import type { EngineEvent, MatchContext } from '../types';
import type { FinalsConfig } from '../../../types/tournament';

const W2A_007: FinalsConfig = {
  preset: 'top-4',
  tiebreakerByRound: { semifinal: 'shootout', final: 'overtime-then-shootout' },
};

function regelnFuer(phase: string, finalsConfig: unknown, finalType: string | null = null) {
  const input: ServerRulesInput = {
    durationMinutes: null,
    phase,
    finalType,
    groupPhaseDuration: 10,
    finalRoundDuration: 12,
    config: {},
    finalsConfig,
  };
  return serverRules(input);
}

describe('@W2A-007 Entscheidung bei Unentschieden je K.-o.-Runde', () => {
  it('@W2A-007 Halbfinale „Strafstoßschießen“, Finale „Verlängerung, dann Strafstoßschießen“: je Spiel verschieden (Server)', () => {
    expect(regelnFuer('semifinal', W2A_007).tiebreak).toBe('shootout');
    expect(regelnFuer('final', W2A_007).tiebreak).toBe('overtime-then-shootout');
  });

  it('@W2A-007 Client und Server ermitteln dieselbe Art (tiebreakSource ohne Rückfall)', () => {
    expect(tiebreakSource(W2A_007, 'semifinal')).toEqual({ mode: 'shootout', fallback: false });
    expect(tiebreakSource(W2A_007, 'final')).toEqual({ mode: 'overtime-then-shootout', fallback: false });
  });
});

describe('@W2A-039 Platzierungsspiele haben eine eigene Entscheidungsregel', () => {
  const mitPlatzierung: FinalsConfig = {
    preset: 'top-4',
    tiebreakerByRound: { final: 'overtime-then-shootout', placement: 'shootout' },
  };

  it('@W2A-039 „Platzierungsspiele: Strafstoßschießen“: Spiel um Platz 3 direkt Schießen, Finale weiter Verlängerung', () => {
    expect(regelnFuer('final', mitPlatzierung, 'thirdPlace').tiebreak).toBe('shootout');
    expect(regelnFuer('final', mitPlatzierung, 'final').tiebreak).toBe('overtime-then-shootout');
    expect(tiebreakSource(mitPlatzierung, 'final', 'thirdPlace')).toEqual({ mode: 'shootout', fallback: false });
  });

  it('@W2A-039 ohne eigene Zeile folgt Platz 3 dem Finale (vorbelegt wie die K.-o.-Spiele)', () => {
    const ohnePlatzierung: FinalsConfig = { preset: 'top-4', tiebreaker: 'shootout', tiebreakerByRound: { final: 'overtime-then-shootout' } };
    expect(regelnFuer('final', ohnePlatzierung, 'thirdPlace').tiebreak).toBe('overtime-then-shootout');
    expect(tiebreakSource(ohnePlatzierung, 'final', 'thirdPlace')).toEqual({ mode: 'overtime-then-shootout', fallback: false });
  });
});

describe('@SL-145 / @SL-053 Rückfall ohne eingestellte Entscheidungsart', () => {
  it('@SL-145 im Turnier ist für das Halbfinale keine Entscheidungsart eingestellt: es gilt Verlängerung, dann Strafstoßschießen (Server)', () => {
    expect(regelnFuer('semifinal', { preset: 'top-4' }).tiebreak).toBe('overtime-then-shootout');
    expect(regelnFuer('semifinal', null).tiebreak).toBe('overtime-then-shootout');
  });

  it('@SL-145 der Client kennzeichnet den Rückfall (fallback: true) für den Hinweis im Cockpit', () => {
    expect(tiebreakSource({ preset: 'top-4' }, 'semifinal')).toEqual({ mode: 'overtime-then-shootout', fallback: true });
    expect(tiebreakSource(undefined, 'semifinal')).toEqual({ mode: 'overtime-then-shootout', fallback: true });
    expect(resolveTiebreakMode({ preset: 'top-4' }, knockoutRoundOf('semifinal'))).toBe('overtime-then-shootout');
  });

  it('@SL-145 Halbfinale 1:1 bei Ablauf mit den Server-Regeln: in Toms Cockpit beginnt die Verlängerung, kein Schießen', () => {
    const ctx: MatchContext = { matchId: 'hf-1', teamAId: 'nord', teamBId: 'sued' };
    const rules = regelnFuer('semifinal', { preset: 'top-4' });
    const ev = (id: string, type: EngineEvent['type'], at: number, extra: Partial<EngineEvent> = {}): EngineEvent => ({
      id, type, actor: 'helper', at, section: 1, clockMs: null, teamId: null, payload: {}, ...extra,
    });
    const { state } = continueLog(initialState(ctx), [
      ev('e1', 'MATCH_START', 1000, { payload: { rules } }),
      ev('e2', 'GOAL', 61_000, { teamId: 'nord', clockMs: 60_000 }),
      ev('e3', 'GOAL', 121_000, { teamId: 'sued', clockMs: 120_000 }),
      ev('e4', 'MATCH_END', 721_000, { clockMs: 720_000 }),
    ], ctx);
    expect(state.status).toBe('section_break');
    expect(state.phase).toBe('overtime');
  });

  it('@SL-053 Gegenbeispiel: „Strafstoßschießen“ fürs Halbfinale eingestellt → Schießen, kein Rückfall', () => {
    const halbfinale: FinalsConfig = { preset: 'top-4', tiebreakerByRound: { semifinal: 'shootout' } };
    expect(regelnFuer('semifinal', halbfinale).tiebreak).toBe('shootout');
    expect(tiebreakSource(halbfinale, 'semifinal')).toEqual({ mode: 'shootout', fallback: false });
  });

  it('Gruppenspiel: knockout false, die Entscheidungsart bleibt ohne Wirkung, tiebreakSource liefert nichts', () => {
    expect(regelnFuer('groupStage', W2A_007).knockout).toBe(false);
    expect(tiebreakSource(W2A_007, null)).toBeUndefined();
  });
});
