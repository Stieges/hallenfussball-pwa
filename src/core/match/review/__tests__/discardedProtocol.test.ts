/**
 * B-50 Nachblick N1: @FU-095 „nach dem Speichern zählt nur die Gelbe Karte, die beiden Tore stehen als verworfen im Verlauf“
 * – Verlauf = der eine Verlauf je Spiel (Record Ergebnisse korrigieren B6.3). Die verworfenen Einträge werden zu Zeilen des
 * Spielprotokolls; die übernommene Karte kommt als normale Server-Kopie ins Spiel-Log und steht hier nicht.
 */
import { describe, expect, it } from 'vitest';
import { discardedProtocolEntries } from '../discardedProtocol';
import { NORD, SUED, ctx, review } from './reviewFixtures';
import type { MatchReview } from '../matchReviewTypes';

const AT = Date.UTC(2026, 10, 28, 11, 10);
const decided = (r: MatchReview, type: 'REVIEW_ACCEPT' | 'REVIEW_DISCARD'): MatchReview =>
  ({ ...r, decision: { type, eventId: `d-${r.eventId}`, at: AT, by: 'Olli' } });

describe('@FU-095 die beiden Tore stehen als verworfen im Verlauf des Spiels', () => {
  it('zwei verworfene Tore → zwei Protokollzeilen „verworfen von Olli“, die übernommene Gelbe Karte nicht', () => {
    const nord = decided(review({ eventId: 'tor-nord', entry: { type: 'GOAL', teamId: NORD, clockMs: 60_000 } }), 'REVIEW_DISCARD');
    const sued = decided(review({ eventId: 'tor-sued', entry: { type: 'GOAL', teamId: SUED, clockMs: 70_000 } }), 'REVIEW_DISCARD');
    const gelb = decided(review({ eventId: 'gelb-5', entry: { type: 'YELLOW_CARD', teamId: SUED, clockMs: 80_000, payload: { playerNumber: 5 } } }), 'REVIEW_ACCEPT');
    const zeilen = discardedProtocolEntries([nord, sued, gelb], ctx, { home: 0, away: 0 });
    expect(zeilen.map((z) => [z.event.id, z.event.type, z.event.payload.teamId, z.event.timestampSeconds, z.by, z.at])).toEqual([
      ['tor-nord', 'GOAL', NORD, 60, 'Olli', AT],
      ['tor-sued', 'GOAL', SUED, 70, 'Olli', AT],
    ]);
  });

  it('Gegenbeispiel: offene Einträge und Einträge eines anderen Spiels stehen nicht im Verlauf dieses Spiels', () => {
    const offen = review({ eventId: 'offen' });
    const anderes = decided(review({ eventId: 'anders', matchId: 'match-10' }), 'REVIEW_DISCARD');
    expect(discardedProtocolEntries([offen, anderes], ctx, { home: 0, away: 0 })).toEqual([]);
  });

  it('ein verworfenes Eigentor zählt im Protokoll für den Gegner (wie jedes Eigentor), zählt aber nicht zum Stand', () => {
    const eigentor = decided(review({ eventId: 'et', entry: { type: 'OWN_GOAL', teamId: NORD } }), 'REVIEW_DISCARD');
    const [zeile] = discardedProtocolEntries([eigentor], ctx, { home: 2, away: 1 });
    expect(zeile.event.payload).toMatchObject({ teamId: SUED, ownGoal: true, ownGoalTeamId: NORD });
    expect(zeile.event.scoreAfter).toEqual({ home: 2, away: 1 });
  });
});
