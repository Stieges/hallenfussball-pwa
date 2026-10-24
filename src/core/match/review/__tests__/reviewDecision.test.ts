/**
 * B-50 Klärungsliste – Entscheidungen und Vorschau aus dem Gherkin.
 * @FU-095 (Einzelauswahl, Vorschau, „Alle übernehmen/verwerfen“, nichts gewählt), @FU-096 (Paar), @FU-130 (nach dem
 * Ende: zählt erst nach „Übernehmen“), A-35-Übergabe `KNOCKOUT_FINISHED`.
 */
import { describe, expect, it } from 'vitest';
import { buildUnits } from '../reviewCases';
import { decisionsFor, previewDecision } from '../reviewDecision';
import { NORD, SUED, ctx, finishedState, review, runningState } from './reviewFixtures';

function fallFuenf() {
  const torNord = review({ entry: { type: 'GOAL', teamId: NORD, clockMs: 60_000 } });
  const torSued = review({ entry: { type: 'GOAL', teamId: SUED, clockMs: 70_000 } });
  const gelb = review({ entry: { type: 'YELLOW_CARD', teamId: SUED, clockMs: 80_000, payload: { playerNumber: 5 } } });
  const units = buildUnits([torNord, torSued, gelb], 120);
  return { torNord, torSued, gelb, units };
}

describe('@FU-095 Aus einem Fall übernimmt die Turnierleitung einzelne Einträge', () => {
  it('beide Tore abgewählt: Vorschau ohne die beiden Tore und mit der Gelben Karte; gespeichert wird Gelb übernommen, Tore verworfen', () => {
    const { torNord, torSued, gelb, units } = fallFuenf();
    const selected = new Set([gelb.eventId]);
    const vorschau = previewDecision(runningState(), ctx, units, selected, 5000);
    expect(vorschau).toMatchObject({ kind: 'score', home: 0, away: 0 });
    expect(vorschau.kind === 'score' && vorschau.accepted.map((r) => r.eventId)).toEqual([gelb.eventId]);
    expect(decisionsFor(units, selected)).toEqual([
      { targetId: gelb.eventId, type: 'REVIEW_ACCEPT' },
      { targetId: torNord.eventId, type: 'REVIEW_DISCARD' },
      { targetId: torSued.eventId, type: 'REVIEW_DISCARD' },
    ]);
  });

  it('Gegenbeispiel „Alle übernehmen“: alle gewählt → Vorschau 1:1, drei Übernahmen', () => {
    const { units } = fallFuenf();
    const alle = new Set(units.map((unit) => unit.key));
    expect(previewDecision(runningState(), ctx, units, alle, 5000)).toMatchObject({ kind: 'score', home: 1, away: 1 });
    expect(decisionsFor(units, alle).every((d) => d.type === 'REVIEW_ACCEPT')).toBe(true);
  });

  it('alle abgewählt: „Übernehmen“ wirkt wie „Alle verwerfen“, die Vorschau sagt „nichts wird übernommen“', () => {
    const { units } = fallFuenf();
    expect(previewDecision(runningState(), ctx, units, new Set(), 5000)).toEqual({ kind: 'nothing' });
    const decisions = decisionsFor(units, new Set());
    expect(decisions).toHaveLength(3);
    expect(decisions.every((d) => d.type === 'REVIEW_DISCARD')).toBe(true);
  });
});

describe('@FU-096 Paare', () => {
  it('Gelb + Gelb-Rot gewählt → beide übernommen, Gelb zuerst', () => {
    const gelb = review({ entry: { type: 'YELLOW_CARD', teamId: SUED, clockMs: 60_000, payload: { playerNumber: 5 } } });
    const gelbRot = review({ entry: { type: 'YELLOW_RED_CARD', teamId: SUED, clockMs: 90_000, payload: { playerNumber: 5 } } });
    const units = buildUnits([gelbRot, gelb], 120);
    expect(decisionsFor(units, new Set([units[0].key]))).toEqual([
      { targetId: gelb.eventId, type: 'REVIEW_ACCEPT' },
      { targetId: gelbRot.eventId, type: 'REVIEW_ACCEPT' },
    ]);
  });

  it('Tor + Rücknahme gewählt → beide verworfen, die Vorschau übernimmt nichts (Plan B-50 Q3)', () => {
    const tor = review({ entry: { type: 'GOAL', teamId: NORD } });
    const ruecknahme = review({ entry: { type: 'RETRACT', teamId: null, targetId: tor.eventId } });
    const units = buildUnits([tor, ruecknahme], 120);
    const selected = new Set([units[0].key]);
    expect(previewDecision(runningState(), ctx, units, selected, 5000)).toEqual({ kind: 'nothing' });
    expect(decisionsFor(units, selected).map((d) => d.type)).toEqual(['REVIEW_DISCARD', 'REVIEW_DISCARD']);
  });

  it('Gegenbeispiel: ein nicht übernehmbarer Eintrag (Pause) wird auch gewählt nur verworfen', () => {
    const pause = review({ entry: { type: 'PAUSE', teamId: null } });
    const units = buildUnits([pause], 120);
    expect(units[0].acceptable).toBe(false);
    expect(decisionsFor(units, new Set([units[0].key]))).toEqual([{ targetId: pause.eventId, type: 'REVIEW_DISCARD' }]);
  });
});

describe('@FU-130 Ein eindeutiger Eintrag, der erst nach dem Abpfiff ankommt, wartet auf die Turnierleitung', () => {
  it('wählt Olli „Übernehmen“, ist Toms Tor im Spielstand des beendeten Gruppenspiels (Vorschau 1:0)', () => {
    const tor = review({ reason: 'AFTER_END', detail: {}, entry: { type: 'GOAL', teamId: NORD } });
    const units = buildUnits([tor], 120);
    expect(previewDecision(finishedState(), ctx, units, new Set([tor.eventId]), 700_000)).toMatchObject({ kind: 'score', home: 1, away: 0 });
  });

  it('Gegenbeispiel: im beendeten K.-o.-Spiel sagt die Vorschau KNOCKOUT_FINISHED (Server lehnt „Übernehmen“ ab)', () => {
    const tor = review({ reason: 'AFTER_END', detail: {}, entry: { type: 'GOAL', teamId: SUED } });
    const units = buildUnits([tor], 120);
    expect(previewDecision(finishedState(true), ctx, units, new Set([tor.eventId]), 700_000))
      .toEqual({ kind: 'rejected', code: 'INVALID_TRANSITION', reason: 'KNOCKOUT_FINISHED' });
  });
});
