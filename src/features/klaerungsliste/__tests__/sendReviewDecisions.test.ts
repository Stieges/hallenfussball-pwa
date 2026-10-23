/**
 * B-50 Entscheidungen senden – aus dem Gherkin:
 * - @FU-038 „Übernehmen“/„Verwerfen“ sind Einträge der Turnierleitung (`REVIEW_ACCEPT`/`REVIEW_DISCARD`, `targetId`).
 * - @FU-095 eine Auswahl des Falls geht in EINEM Stapel (Gelb übernommen, Tore verworfen).
 * - A-35 Übergabe: schon entschieden → `UNKNOWN_TARGET ALREADY_DECIDED`; K.-o. beendet → `KNOCKOUT_FINISHED`.
 * - Gegenbeispiel: ohne Netz wird nichts gesendet und nichts vorgemerkt.
 */
import { describe, expect, it, vi } from 'vitest';
import type { MatchEngineView } from '../../../core/match/client/MatchEngine';
import { ctx, finishedState, runningState } from '../../../core/match/review/__tests__/reviewFixtures';
import { sendReviewDecisions, type SendDecisionsInput } from '../sendReviewDecisions';
import type { MatchState } from '../../../core/match';

function input(state: MatchState, sendNow: SendDecisionsInput['sender']['sendNow'], online = true): SendDecisionsInput {
  const view = { result: { state }, log: [], confirmedCount: 0 } as unknown as MatchEngineView;
  return {
    engine: { ensureMatch: vi.fn().mockResolvedValue(undefined), catchUp: vi.fn().mockResolvedValue(undefined), view: () => view, serverNow: () => 700_000 },
    sender: { sendNow },
    online: () => online,
    tournamentId: 'live-cup',
    matchId: 'match-9',
    ctx,
    decisions: [
      { targetId: 'gelb', type: 'REVIEW_ACCEPT' },
      { targetId: 'tor-nord', type: 'REVIEW_DISCARD' },
      { targetId: 'tor-sued', type: 'REVIEW_DISCARD' },
    ],
  };
}

describe('@FU-095 / @FU-038 Entscheidungen eines Falls senden', () => {
  it('ein Stapel: Übernehmen und Verwerfen als Einträge der Turnierleitung mit Ziel, ohne Payload', async () => {
    const sendNow = vi.fn().mockResolvedValue({ results: [
      { id: 'a', status: 'accepted' }, { id: 'b', status: 'accepted' }, { id: 'c', status: 'accepted' },
    ] });
    const outcome = await sendReviewDecisions(input(runningState(), sendNow));
    expect(outcome).toEqual({ status: 'saved', accepted: 1, matchFinished: false });
    expect(sendNow).toHaveBeenCalledTimes(1);
    const [matchId, events] = sendNow.mock.calls[0] as [string, { type: string; actor: string; targetId: string; payload: object }[]];
    expect(matchId).toBe('match-9');
    expect(events.map((e) => [e.type, e.targetId, e.actor, e.payload])).toEqual([
      ['REVIEW_ACCEPT', 'gelb', 'leitung', {}],
      ['REVIEW_DISCARD', 'tor-nord', 'leitung', {}],
      ['REVIEW_DISCARD', 'tor-sued', 'leitung', {}],
    ]);
  });

  it('@FU-130: Übernehmen im beendeten Gruppenspiel meldet „Spiel war beendet“ (Hinweis Gruppe neu abschließen)', async () => {
    const sendNow = vi.fn().mockResolvedValue({ results: [{ status: 'accepted' }, { status: 'accepted' }, { status: 'accepted' }] });
    expect(await sendReviewDecisions(input(finishedState(), sendNow))).toEqual({ status: 'saved', accepted: 1, matchFinished: true });
  });

  it('Gegenbeispiel: ohne Netz wird nichts gesendet', async () => {
    const sendNow = vi.fn();
    expect(await sendReviewDecisions(input(runningState(), sendNow, false))).toEqual({ status: 'offline' });
    expect(sendNow).not.toHaveBeenCalled();
  });

  it('schon entschieden (Maria war schneller): Grund ALREADY_DECIDED kommt zurück', async () => {
    const sendNow = vi.fn().mockResolvedValue({ results: [
      { status: 'rejected', code: 'UNKNOWN_TARGET', detail: { reason: 'ALREADY_DECIDED' } }, { status: 'rejected' }, { status: 'rejected' },
    ] });
    expect(await sendReviewDecisions(input(runningState(), sendNow))).toEqual({ status: 'rejected', code: 'UNKNOWN_TARGET', reason: 'ALREADY_DECIDED' });
  });

  it('Netzfehler beim Senden: „nicht gesendet“, kein Absturz', async () => {
    const sendNow = vi.fn().mockRejectedValue(new Error('fetch failed'));
    expect(await sendReviewDecisions(input(runningState(), sendNow))).toEqual({ status: 'notSent' });
  });
});
