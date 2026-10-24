/**
 * A-35 Klärungsliste – Client-Teil: Die Antwort `review` mit dem Grund des Servers (CONTROL_LOST, RIGHTS_REVOKED,
 * AFTER_END; 20261117_005_klaerungsliste.sql) ist kein Fehler. Der Eintrag verlässt den Ausgang, wird nicht als
 * angenommen gebucht und liegt in `review` („wird geprüft“ bzw. „an die Turnierleitung übergeben“, Anzeige B-50).
 * Ein Anpfiff zur Klärung reißt die folgenden Einträge nicht mit (keine Folgeablehnung wie bei `rejected`).
 * Szenarien: @FU-038, @FU-036, @FU-017, @HE-056, @HE-080, @FU-116, @FU-130.
 */
import { describe, it, expect } from 'vitest';
import { buildResolution } from '../outboxResolution';
import { applyResolution, type MatchCopy } from '../matchCopy';
import { ctx, ev, start } from './fixtures';

const NOW = 4711;

function copyWith(pending: MatchCopy['pending']): MatchCopy {
  return {
    formatVersion: 2,
    accountId: 'acc',
    matchId: 'm',
    ctx,
    confirmed: [],
    watermarkSeq: 0,
    acked: [],
    pending,
    rejected: [],
    review: [],
    updatedAt: 0,
  };
}

describe('A-35: Antwort „review“ beim Senden', () => {
  it.each([
    ['@FU-038', 'CONTROL_LOST'],
    ['@FU-017', 'RIGHTS_REVOKED'],
    ['@HE-056', 'RIGHTS_REVOKED'],
    ['@HE-080', 'RIGHTS_REVOKED'],
    ['@FU-116', 'AFTER_END'],
    ['@FU-130', 'AFTER_END'],
  ])('%s Grund %s: Eintrag verlässt den Ausgang, liegt in „wird geprüft“, kein Fehler, nicht angenommen', (_id, code) => {
    const tor = ev({ id: 'tor-tom', type: 'GOAL', at: 1, teamId: 'teamA' });
    const { resolution } = buildResolution([tor], [{ id: tor.id, status: 'review', code }], NOW);
    const copy = copyWith([tor]);

    applyResolution(copy, resolution);

    expect(copy.pending).toEqual([]);
    expect(copy.review.map((event) => event.id)).toEqual(['tor-tom']);
    expect(copy.acked).toEqual([]);
    expect(copy.rejected).toEqual([]);
  });

  it('@FU-036 Toms Anpfiff und Tor zur Klärung: keine Folgeablehnung, beide „wird geprüft“', () => {
    const anpfiff = { ...start(), id: 'anpfiff-tom' };
    const tor = ev({ id: 'tor-tom', type: 'GOAL', at: 2, teamId: 'teamA' });
    const { resolution } = buildResolution(
      [anpfiff, tor],
      [
        { id: anpfiff.id, status: 'review', code: 'CONTROL_LOST' },
        { id: tor.id, status: 'review', code: 'CONTROL_LOST' },
      ],
      NOW,
    );

    expect(resolution.cascade).toBeUndefined();
    expect(resolution.reviewIds).toEqual(['anpfiff-tom', 'tor-tom']);
  });

  it('@FU-026 Gegenbeispiel: ein Gerät, das nie gesteuert hat, bekommt weiter NOT_CONTROLLER (Fehler, nicht zur Klärung)', () => {
    const tor = ev({ id: 'tor-olli', type: 'GOAL', at: 1, teamId: 'teamA' });
    const { resolution } = buildResolution(
      [tor],
      [{ id: tor.id, status: 'rejected', code: 'NOT_CONTROLLER', detail: { reason: 'OTHER_DEVICE' } }],
      NOW,
    );

    expect(resolution.reviewIds).toEqual([]);
    expect(resolution.rejected.map((entry) => entry.code)).toEqual(['NOT_CONTROLLER']);
  });
});
