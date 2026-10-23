/**
 * A-25a – Direkteintrag eines K.-o.-Ergebnisses mit Strafstoßschießen (TS-Seite).
 *
 * Testwerte aus dem Gherkin @FU-094 (docs/anforderungen/plattform/2026-09-24_fundament-gemeinsamer-stand.md):
 * „Wenn Olli im Spielplan 2:2 für das Halbfinale 1 einträgt, dann fragt die App zusätzlich nach dem Ergebnis des
 * Strafstoßschießens … nach der Eingabe ‚4:3 für das Heimteam‘ ist das Halbfinale beendet mit 2:2 und Sieger Heimteam.
 * Aber ohne Angabe des Strafstoßergebnisses speichert die App das Unentschieden nicht.“
 * Gegenbeispiele (ungleicher Stand, 3:3, nur ein Team, Gruppenspiel) aus dem Brief A-25a, Schritte 1 und 3.
 * Der SQL-Zwilling läuft über die Fixtures 66a–66e (match-engine-parity.sh, append-match-events-check.sh).
 */
import { describe, expect, it } from 'vitest';
import { isPayloadValid } from '../payloadValidation';
import { reduceMatch } from '../reduceMatch';
import { cacheColumns } from '../client/cacheColumns';
import { shootoutRuleViolation } from '../resultEntryShootout';
import type { EngineEvent, MatchContext } from '../types';

const HEIM = 'fc-nord';
const GAST = 'sv-sued';
const ctx: MatchContext = { matchId: 'halbfinale-1', teamAId: HEIM, teamBId: GAST };

function direkteintrag(payload: Record<string, unknown>, id = '0000a25a-0000-4000-8000-000000000001'): EngineEvent {
  return { id, type: 'RESULT_ENTRY', actor: 'leitung', at: 1000, section: null, clockMs: null, payload };
}

const zweiZwei = { [HEIM]: 2, [GAST]: 2 };
const vierDrei = { [HEIM]: 4, [GAST]: 3 };

describe('@FU-094 Form des Direkteintrags mit Strafstoßergebnis', () => {
  it('@FU-094 Direkteintrag 2:2 mit Strafstoß 4:3 hat eine gültige Form', () => {
    expect(isPayloadValid(direkteintrag({ scores: zweiZwei, shootout: vierDrei }), ctx)).toBe(true);
  });

  it('@FU-094 Strafstoß bei ungleichem Stand (3:2, 4:3) ist ungültig', () => {
    expect(isPayloadValid(direkteintrag({ scores: { [HEIM]: 3, [GAST]: 2 }, shootout: vierDrei }), ctx)).toBe(false);
  });

  it('@FU-094 Strafstoß 3:3 ist ungültig', () => {
    expect(isPayloadValid(direkteintrag({ scores: zweiZwei, shootout: { [HEIM]: 3, [GAST]: 3 } }), ctx)).toBe(false);
  });

  it('@FU-094 Strafstoß nur für ein Team ist ungültig', () => {
    expect(isPayloadValid(direkteintrag({ scores: zweiZwei, shootout: { [HEIM]: 4 } }), ctx)).toBe(false);
  });

  it.each([
    { fall: 'fremdes Team statt Gast', shootout: { [HEIM]: 4, 'tsv-west': 3 } },
    { fall: 'drei Teams', shootout: { [HEIM]: 4, [GAST]: 3, 'tsv-west': 1 } },
    { fall: 'negativer Wert', shootout: { [HEIM]: 4, [GAST]: -1 } },
    { fall: 'Bruchzahl', shootout: { [HEIM]: 4.5, [GAST]: 3 } },
    { fall: 'kein Objekt', shootout: [4, 3] },
  ])('@FU-094 Strafstoßergebnis mit $fall ist ungültig', ({ shootout }) => {
    expect(isPayloadValid(direkteintrag({ scores: zweiZwei, shootout }), ctx)).toBe(false);
  });

  it('@FU-094 Gegenbeispiel: ohne Strafstoßergebnis bleibt die Form wie bisher gültig (die K.-o.-Regel prüft der Server)', () => {
    expect(isPayloadValid(direkteintrag({ scores: zweiZwei }), ctx)).toBe(true);
  });
});

describe('@FU-094 Engine und Zwischenspeicher', () => {
  it('@FU-094 nach 4:3 für das Heimteam ist das Halbfinale beendet mit 2:2 und Sieger Heimteam (Strafstoß)', () => {
    const { state, results } = reduceMatch([direkteintrag({ scores: zweiZwei, shootout: vierDrei })], ctx);
    expect(results[0].status).toBe('accepted');
    expect(cacheColumns(state, ctx)).toMatchObject({
      match_status: 'finished',
      score_a: 2,
      score_b: 2,
      penalty_score_a: 4,
      penalty_score_b: 3,
      decided_by: 'penalty',
    });
  });

  it('@FU-094 Strafstoß 3:4 (Gast gewinnt) landet seitenrichtig im Zwischenspeicher', () => {
    const { state } = reduceMatch([direkteintrag({ scores: zweiZwei, shootout: { [HEIM]: 3, [GAST]: 4 } })], ctx);
    expect(cacheColumns(state, ctx)).toMatchObject({ penalty_score_a: 3, penalty_score_b: 4, decided_by: 'penalty' });
  });

  it('@FU-094 Gegenbeispiel: 2:2 ohne Strafstoßergebnis bleibt regulär ohne Strafstoß-Stand', () => {
    const { state } = reduceMatch([direkteintrag({ scores: zweiZwei })], ctx);
    expect(cacheColumns(state, ctx)).toMatchObject({
      match_status: 'finished',
      penalty_score_a: null,
      penalty_score_b: null,
      decided_by: 'regular',
    });
  });

  it('@FU-094 die Überschreibung trägt das Strafstoßergebnis nur, wenn es eingetragen wurde (kein leerer Schlüssel)', () => {
    const mit = reduceMatch([direkteintrag({ scores: zweiZwei, shootout: vierDrei })], ctx).state.overrides[0];
    const ohne = reduceMatch([direkteintrag({ scores: zweiZwei })], ctx).state.overrides[0];
    expect(mit.shootout).toEqual(vierDrei);
    expect(Object.hasOwn(ohne, 'shootout')).toBe(false);
  });
});

describe('@FU-094 Strafstoß nach Wiedereröffnen (Review A-25a W1, Befund C-STRAFSTOSS-NACH-WIEDERERÖFFNEN)', () => {
  const eintrag = direkteintrag({ scores: zweiZwei, shootout: vierDrei });
  const wieder: EngineEvent = { id: '0000a25a-0000-4000-8000-000000000002', type: 'REOPEN', actor: 'leitung', at: 2000, section: null, clockMs: null, payload: {} };

  it('@FU-094 nach dem Wiedereröffnen läuft das Spiel ohne Strafstoß-Stand und ohne Entscheid', () => {
    const { state } = reduceMatch([eintrag, wieder], ctx);
    expect(cacheColumns(state, ctx)).toMatchObject({ match_status: 'running', penalty_score_a: null, penalty_score_b: null, decided_by: null });
  });

  // Befund C-STRAFSTOSS-NACH-WIEDERERÖFFNEN, behoben mit SW (@EK-062): Endet das wiedereröffnete Spiel 2:3, zählt
  // der alte Strafstoß 4:3 nicht mehr (nur bei Gleichstand) – Zwischenspeicher `decided_by regular`, Sieger Gast.
  it('@FU-094 wiedereröffnet und 2:3 beendet: der alte Strafstoß 4:3 entscheidet nicht mehr', () => {
    const tor: EngineEvent = { id: '0000a25a-0000-4000-8000-000000000003', type: 'GOAL', actor: 'leitung', at: 3000, section: 1, clockMs: 0, teamId: GAST, payload: {} };
    const ende: EngineEvent = { id: '0000a25a-0000-4000-8000-000000000004', type: 'MATCH_END', actor: 'leitung', at: 4000, section: 1, clockMs: 0, payload: {} };
    const { state } = reduceMatch([eintrag, wieder, tor, ende], ctx);
    expect(cacheColumns(state, ctx)).toMatchObject({ match_status: 'finished', score_a: 2, score_b: 3, penalty_score_a: null, penalty_score_b: null, decided_by: 'regular' });
  });
});

describe('@FU-094 Regel „K.-o.-Unentschieden braucht ein Strafstoßergebnis“ (Zwilling der Server-Prüfung)', () => {
  it('@FU-094 K.-o. 2:2 ohne Strafstoß → SHOOTOUT_REQUIRED (ohne Angabe speichert die App das Unentschieden nicht)', () => {
    expect(shootoutRuleViolation(true, { scores: zweiZwei })).toBe('SHOOTOUT_REQUIRED');
  });

  it('@FU-094 K.-o. 2:2 mit Strafstoß 4:3 → erlaubt', () => {
    expect(shootoutRuleViolation(true, { scores: zweiZwei, shootout: vierDrei })).toBeNull();
  });

  it('@FU-094 Gegenbeispiel: K.-o. 3:2 ohne Strafstoß → erlaubt', () => {
    expect(shootoutRuleViolation(true, { scores: { [HEIM]: 3, [GAST]: 2 } })).toBeNull();
  });

  it('@FU-094 Gegenbeispiel: Gruppenspiel 2:2 ohne Strafstoß → erlaubt', () => {
    expect(shootoutRuleViolation(false, { scores: zweiZwei })).toBeNull();
  });

  it('@FU-094 Gegenbeispiel: Gruppenspiel 2:2 mit Strafstoß → SHOOTOUT_NOT_ALLOWED', () => {
    expect(shootoutRuleViolation(false, { scores: zweiZwei, shootout: vierDrei })).toBe('SHOOTOUT_NOT_ALLOWED');
  });
});
