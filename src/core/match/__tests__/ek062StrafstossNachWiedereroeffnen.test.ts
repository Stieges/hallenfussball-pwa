/**
 * SW – Strafstoß aus dem Direkteintrag nach dem Wiedereröffnen (@EK-062, Befund C-STRAFSTOSS-NACH-WIEDERERÖFFNEN).
 *
 * Testwerte aus dem Gherkin @EK-062 (docs/anforderungen/2026-10-02_ergebnisse-korrigieren.md):
 * „Halbfinale 1 wurde im Spielplan mit 2:2 und Strafstoßschießen 4:3 für FC Nord eingetragen. Olli eröffnet es wieder,
 * nach einem weiteren Tor endet es 2:3 für DJK Berg. Dann ist DJK Berg Sieger mit 2:3, das Strafstoßergebnis 4:3 zählt
 * nirgends mehr … die Klärungsliste zeigt ‚Halbfinale 1 wiedereröffnet: Strafstoßergebnis 4:3 passt nicht mehr zum
 * Endstand 2:3‘ … Aber endet Halbfinale 1 nach dem Wiedereröffnen erneut 2:2, fragt die App das Strafstoßschießen neu
 * ab, vorbelegt mit 4:3.“
 * Gegenbeispiele aus dem Brief SW, Abschnitt 10 (Gruppe, läuft noch, ohne Wiedereröffnen, @FU-097, B-U11).
 * Der SQL-Zwilling läuft über die Fixtures 68a–68d (match-engine-parity.sh) und append-match-events-check.sh (9i).
 */
import { describe, expect, it } from 'vitest';
import { reduceMatch } from '../reduceMatch';
import { cacheColumns } from '../client/cacheColumns';
import { enteredShootoutStatus } from '../shootoutStatus';
import type { EngineEvent, MatchContext } from '../types';

const FC_NORD = 'fc-nord';
const DJK_BERG = 'djk-berg';
const ctx: MatchContext = { matchId: 'halbfinale-1', teamAId: FC_NORD, teamBId: DJK_BERG };

let nextId = 0;
function ev(type: EngineEvent['type'], at: number, extra: Partial<EngineEvent> = {}): EngineEvent {
  nextId += 1;
  const id = `0000e062-0000-4000-8000-${String(nextId).padStart(12, '0')}`;
  return { id, type, actor: 'leitung', at, section: null, clockMs: null, payload: {}, ...extra };
}

const zweiZwei = { [FC_NORD]: 2, [DJK_BERG]: 2 };
const vierDrei = { [FC_NORD]: 4, [DJK_BERG]: 3 };

const eintrag = (): EngineEvent => ev('RESULT_ENTRY', 1000, { payload: { scores: zweiZwei, shootout: vierDrei } });
const wiederEroeffnen = (): EngineEvent => ev('REOPEN', 2000);
const torDjkBerg = (): EngineEvent => ev('GOAL', 3000, { section: 1, clockMs: 0, teamId: DJK_BERG });
const abpfiff = (): EngineEvent => ev('MATCH_END', 5000, { section: 1, clockMs: 0 });

describe('@EK-062 Strafstoß aus dem Direkteintrag zählt nach dem Wiedereröffnen nur bei Gleichstand', () => {
  it('@EK-062 wiedereröffnet und 2:3 beendet: DJK Berg ist Sieger, 4:3 zählt nirgends', () => {
    const { state, results } = reduceMatch([eintrag(), wiederEroeffnen(), torDjkBerg(), abpfiff()], ctx);
    expect(results.map((r) => r.status)).toEqual(['accepted', 'accepted', 'accepted', 'accepted']);
    expect(cacheColumns(state, ctx)).toMatchObject({
      match_status: 'finished',
      score_a: 2,
      score_b: 3,
      penalty_score_a: null,
      penalty_score_b: null,
      decided_by: 'regular',
    });
  });

  it('@EK-062 Klärungsfall: Strafstoßergebnis 4:3 passt nicht mehr zum Endstand 2:3', () => {
    const { state } = reduceMatch([eintrag(), wiederEroeffnen(), torDjkBerg(), abpfiff()], ctx);
    expect(enteredShootoutStatus(state, ctx)).toEqual({
      kind: 'stale',
      shootout: { [FC_NORD]: 4, [DJK_BERG]: 3 },
      finalScores: { [FC_NORD]: 2, [DJK_BERG]: 3 },
    });
  });

  it('@EK-062 erneut 2:2 nach dem Wiedereröffnen: 4:3 zählt wieder und ist der Vorschlag für die Abfrage', () => {
    const { state } = reduceMatch([eintrag(), wiederEroeffnen(), abpfiff()], ctx);
    expect(enteredShootoutStatus(state, ctx)).toEqual({ kind: 'counts', shootout: { [FC_NORD]: 4, [DJK_BERG]: 3 }, reopened: true });
    expect(cacheColumns(state, ctx)).toMatchObject({
      match_status: 'finished',
      score_a: 2,
      score_b: 2,
      penalty_score_a: 4,
      penalty_score_b: 3,
      decided_by: 'penalty',
    });
  });

  it('@EK-062 erneut 2:2, weil das Tor von DJK Berg zurückgenommen wurde: der effektive Stand entscheidet, 4:3 zählt', () => {
    const tor = torDjkBerg();
    const zurueck = ev('RETRACT', 4000, { targetId: tor.id });
    const { state, results } = reduceMatch([eintrag(), wiederEroeffnen(), tor, zurueck, abpfiff()], ctx);
    expect(results.every((r) => r.status === 'accepted')).toBe(true);
    expect(enteredShootoutStatus(state, ctx)).toEqual({ kind: 'counts', shootout: { [FC_NORD]: 4, [DJK_BERG]: 3 }, reopened: true });
    expect(cacheColumns(state, ctx)).toMatchObject({ score_a: 2, score_b: 2, penalty_score_a: 4, penalty_score_b: 3, decided_by: 'penalty' });
  });

  it('@EK-062 Gegenbeispiel: Direkteintrag 2:2 mit 4:3 ohne Wiedereröffnen zählt, keine erneute Abfrage', () => {
    const { state } = reduceMatch([eintrag()], ctx);
    expect(enteredShootoutStatus(state, ctx)).toEqual({ kind: 'counts', shootout: { [FC_NORD]: 4, [DJK_BERG]: 3 }, reopened: false });
    expect(cacheColumns(state, ctx)).toMatchObject({ score_a: 2, score_b: 2, penalty_score_a: 4, penalty_score_b: 3, decided_by: 'penalty' });
  });

  it('@EK-062 Gegenbeispiel: wiedereröffnet und läuft noch mit 2:3 – kein Strafstoß, kein Entscheid, kein Klärungsfall', () => {
    const { state } = reduceMatch([eintrag(), wiederEroeffnen(), torDjkBerg()], ctx);
    expect(cacheColumns(state, ctx)).toMatchObject({
      match_status: 'running',
      score_a: 2,
      score_b: 3,
      penalty_score_a: null,
      penalty_score_b: null,
      decided_by: null,
    });
    expect(enteredShootoutStatus(state, ctx)).toBeNull();
  });

  it('@EK-062 Gegenbeispiel: Gruppenspiel 2:2 ohne Strafstoß, wiedereröffnet, 2:3 – regulär, kein Klärungsfall', () => {
    const ohne = ev('RESULT_ENTRY', 1000, { payload: { scores: zweiZwei } });
    const { state } = reduceMatch([ohne, wiederEroeffnen(), torDjkBerg(), abpfiff()], ctx);
    expect(cacheColumns(state, ctx)).toMatchObject({
      match_status: 'finished',
      score_a: 2,
      score_b: 3,
      penalty_score_a: null,
      penalty_score_b: null,
      decided_by: 'regular',
    });
    expect(enteredShootoutStatus(state, ctx)).toBeNull();
  });

  it('@EK-062 Zusammenspiel @FU-097: nachgetragenes Halbfinale 2, wiedereröffnet, 2:3 → kein Strafstoß', () => {
    const events = [ev('SKIP', 500), ev('UNSKIP', 900), eintrag(), wiederEroeffnen(), torDjkBerg(), abpfiff()];
    const { state, results } = reduceMatch(events, { ...ctx, matchId: 'halbfinale-2' });
    expect(results.every((r) => r.status === 'accepted')).toBe(true);
    expect(cacheColumns(state, ctx)).toMatchObject({
      match_status: 'finished',
      score_a: 2,
      score_b: 3,
      penalty_score_a: null,
      penalty_score_b: null,
      decided_by: 'regular',
    });
    expect(enteredShootoutStatus(state, ctx)).toMatchObject({ kind: 'stale' });
  });

  it('@EK-062 Gegenbeispiel: ein geleitetes Strafstoßschießen lässt sich weiter nicht wiedereröffnen (B-U11)', () => {
    const rules = {
      sections: 1, sectionSeconds: 600, breakSeconds: 60, knockout: true, tiebreak: 'shootout',
      overtimeSeconds: 300, shootersPerTeam: 1, suddenDeathAfter: 5, penaltySeconds: 120,
    };
    const geleitet = [
      ev('MATCH_START', 1000, { actor: 'helper', section: 1, payload: { rules } }),
      ev('MATCH_END', 601000, { actor: 'helper', section: 1, clockMs: 600000 }),
      ev('SHOOTOUT_KICK', 700000, { actor: 'helper', section: 1, teamId: FC_NORD, payload: { scored: true } }),
      ev('SHOOTOUT_KICK', 701000, { actor: 'helper', section: 1, teamId: DJK_BERG, payload: { scored: false } }),
      ev('SHOOTOUT_END', 702000, { actor: 'helper', section: 1 }),
    ];
    const vorher = cacheColumns(reduceMatch(geleitet, ctx).state, ctx);
    const { state, results } = reduceMatch([...geleitet, ev('REOPEN', 710000, { section: 1 })], ctx);
    expect(results[results.length - 1]).toMatchObject({ status: 'rejected', code: 'INVALID_TRANSITION', detail: { reason: 'SHOOTOUT_FINISHED' } });
    expect(cacheColumns(state, ctx)).toEqual(vorher);
    expect(vorher).toMatchObject({ match_status: 'finished', penalty_score_a: 1, penalty_score_b: 0, decided_by: 'penalty' });
    expect(enteredShootoutStatus(state, ctx)).toBeNull();
  });

  it.todo('@EK-062 Klärungsliste zeigt „Halbfinale 1 wiedereröffnet: Strafstoßergebnis 4:3 passt nicht mehr zum Endstand 2:3“ mit „Verwerfen“ (A-35)');
  it.todo('@EK-062 nach erneutem 2:2 fragt die App das Strafstoßschießen neu ab, vorbelegt mit 4:3 (B-24/B-07)');
});
