/**
 * B-14 (E-A2): Übersetzung der Antwort von public_tournament/display_tournament (core/repositories/publicPayload.ts).
 * Testwerte aus dem Gherkin („Hallencup Nord“): Spiel 7 FC Nord – SV Süd läuft, Tor FC Nord Nr. 9 in der 3. Minute,
 * Zeitstrafe SV Süd Nr. 5 in der 4. Minute (@ZM-002); Spiel 9 von 14:30 auf 14:40 verschoben.
 */
import { describe, expect, it } from 'vitest';
import { applyPublicMatches, parsePublicPayload, toPublicRuntimeEvents, type PublicReply } from '../publicPayload';
import type { Tournament } from '../../../types/tournament';

const T = '11111111-1111-4111-8111-111111111111';
const NORD = '22222222-2222-4222-8222-222222222222';
const SUED = '33333333-3333-4333-8333-333333333333';
const S7 = '44444444-4444-4444-8444-444444444444';
const S9 = '55555555-5555-4555-8555-555555555555';

const tor9 = { id: 'e-tor', type: 'GOAL', team_id: NORD, section: 1, clock_ms: 130_000, number: 9 };
const strafe5 = { id: 'e-strafe', type: 'TIME_PENALTY', team_id: SUED, section: 1, clock_ms: 200_000, number: 5, duration_seconds: 120 };

function spiel7(extra: Record<string, unknown> = {}) {
  return {
    id: S7, match_number: 7, round: 3, field: 1, phase: 'groupStage', group_letter: 'A', team_a_id: NORD, team_b_id: SUED,
    scheduled_start: '14:15:00', match_status: 'running', score_a: 1, score_b: 0, events: [tor9, strafe5], ...extra,
  };
}

function voll(matches: unknown[], config: Record<string, unknown> = {}) {
  return {
    state: 'full', version: 1_792_699_029_588_738, server_now: 1_792_699_034_588,
    tournament: { id: T, title: 'Hallencup Nord', date: '2026-11-21', number_of_fields: 2, config },
    teams: [{ id: NORD, name: 'FC Nord', group_letter: 'A' }, { id: SUED, name: 'SV Süd', group_letter: 'A' }],
    matches,
  };
}

function full(reply: PublicReply) {
  if (reply.kind !== 'full') { throw new Error(`erwartet full, erhalten ${reply.kind}`); }
  return reply;
}

describe('parsePublicPayload (B-14)', () => {
  it('@ZM-068 not_found → „nicht gefunden“ (nicht geteilt und unbekannt sind gleich)', () => {
    expect(parsePublicPayload({ state: 'not_found' })).toEqual({ kind: 'not-found' });
  });

  it('unchanged trägt Version und Serverzeit in Millisekunden (Review #342 A5 Punkt 1)', () => {
    expect(parsePublicPayload({ state: 'unchanged', version: 42, server_now: 1_792_699_034_588 }))
      .toEqual({ kind: 'unchanged', version: 42, serverNowMs: 1_792_699_034_588 });
  });

  it('@ZM-002 volle Antwort: Spiel 7 mit Stand 1:0, Tor FC Nord Nr. 9 (3.) und Zeitstrafe SV Süd Nr. 5 (4.)', () => {
    const reply = full(parsePublicPayload(voll([spiel7()])));
    const match = reply.tournament.matches[0];
    expect(reply.tournament.title).toBe('Hallencup Nord');
    expect([match.scoreA, match.scoreB]).toEqual([1, 0]);
    expect(match.events?.map((e) => [e.type, e.payload.teamId, e.payload.playerNumber, Math.floor(e.timestampSeconds / 60) + 1]))
      .toEqual([['GOAL', NORD, 9, 3], ['TIME_PENALTY', SUED, 5, 4]]);
    expect(match.events?.[1].payload.durationSeconds).toBe(120);
  });

  // Die Positivliste der config-Schlüssel gilt am Server (scripts/public-payload-check.sh, Kategorie P); hier die Zeilen.
  it('@ZM-098 Ereignisse ohne Urheber: unbekannte Felder (actor, user_id, payload) fallen beim Prüfen weg (.strip)', () => {
    const mitUrheber = { ...tor9, actor: 'helper', user_id: 'u-tom', device_id: 'd-1', payload: { reason: 'intern' } };
    const reply = full(parsePublicPayload(voll([spiel7({ events: [mitUrheber], referee_name: 'Paul Schmidt' })])));
    const text = JSON.stringify(reply.tournament);
    expect(text).not.toContain('helper');
    expect(text).not.toContain('u-tom');
    expect(text).not.toContain('intern');
    expect(text).not.toContain('Paul Schmidt');
  });

  it('Spielspalten der Positivliste: original_start bleibt nicht verloren, forfeit_absent wird gelesen (Review #342 A5 Punkt 6)', () => {
    const reply = full(parsePublicPayload(voll([
      { id: S9, match_number: 9, round: 4, field: 1, team_a_id: NORD, team_b_id: SUED, scheduled_start: '14:40:00',
        original_start: '14:30:00', forfeit_absent: 'B', decided_by: 'forfeit', score_a: 2, score_b: 0, match_status: 'finished' },
    ])));
    const match = reply.tournament.matches[0];
    expect(match.forfeitAbsent).toBe('B');
    expect(match.scheduledTime?.getHours()).toBe(14);
    expect(match.scheduledTime?.getMinutes()).toBe(40);
  });

  it('Delta: nur geänderte Spiele, Anstoßzeit über tournament_date (Review #342 A5 Punkt 3)', () => {
    const reply = parsePublicPayload({
      state: 'delta', version: 9, base_version: 7, server_now: 1, tournament_date: '2026-11-21',
      matches: [spiel7({ score_a: 2, events: [tor9, { ...tor9, id: 'e-tor2', clock_ms: 300_000, number: 10 }] })],
      removed_match_ids: [],
    });
    if (reply.kind !== 'delta') { throw new Error(reply.kind); }
    expect(reply.baseVersion).toBe(7);
    expect(reply.matches[0].scheduledTime?.toISOString().slice(0, 10)).toBe(new Date('2026-11-21T14:15:00').toISOString().slice(0, 10));
    expect(reply.matches[0].events?.map((e) => e.scoreAfter)).toEqual([{ home: 1, away: 0 }, { home: 2, away: 0 }]);
  });

  it('@ZM-099 ohne Ereignisse und ohne Torschützen in der Antwort: keine Ereignisse, keine Torschützen', () => {
    const reply = full(parsePublicPayload(voll([spiel7({ events: undefined })])));
    expect(reply.tournament.matches[0].events).toBeUndefined();
    expect(reply.scorers).toBeUndefined();
  });

  it('Torschützen-Zwischenstand nur, wenn die Antwort ihn trägt', () => {
    const reply = full(parsePublicPayload({ ...voll([spiel7()]), scorers: [{ team_id: NORD, number: 9, goals: 1 }] }));
    expect(reply.scorers).toEqual([{ team_id: NORD, number: 9, goals: 1 }]);
  });

  it.each([
    ['Version als Text', { state: 'unchanged', version: '42', server_now: 1 }],
    ['Serverzeit fehlt', { state: 'unchanged', version: 42 }],
    ['unbekannter Zustand', { state: 'gone' }],
    ['Delta ohne tournament_date', { state: 'delta', version: 2, base_version: 1, server_now: 1, matches: [], removed_match_ids: [] }],
    ['Fehlerobjekt statt Antwort', { code: 'PGRST202', message: 'nicht gefunden' }],
  ])('@ZM-109 Antwort außerhalb des Vertrags (%s) wirft und ist nie „nicht gefunden“', (_name, raw) => {
    expect(() => parsePublicPayload(raw)).toThrow();
  });
});

describe('toPublicRuntimeEvents (B-14)', () => {
  it('Eigentor zählt für den Gegner, Gelb-Rot ist eine rote Karte mit cardType YELLOW_RED, Strafstöße erscheinen nicht', () => {
    const events = toPublicRuntimeEvents(S7, [
      { id: 'og', type: 'OWN_GOAL', team_id: SUED, clock_ms: 60_000 },
      { id: 'gr', type: 'YELLOW_RED_CARD', team_id: NORD, clock_ms: 70_000, number: 4 },
      { id: 'k1', type: 'SHOOTOUT_KICK', team_id: NORD, scored: true },
    ], { sideA: NORD, sideB: SUED, goalsA: 1, goalsB: 0 });
    expect(events.map((e) => [e.id, e.type, e.payload.teamId, e.payload.ownGoal ?? false, e.payload.cardType ?? null]))
      .toEqual([['og', 'GOAL', NORD, true, null], ['gr', 'RED_CARD', NORD, false, 'YELLOW_RED']]);
  });
});

describe('applyPublicMatches (B-14)', () => {
  it('ersetzt geänderte Spiele nach Kennung, behält die anderen, streicht entfernte', () => {
    const before = full(parsePublicPayload(voll([spiel7({ score_a: 1 }), { ...spiel7(), id: S9, match_number: 9, score_a: null }])));
    const after = full(parsePublicPayload(voll([spiel7({ score_a: 2 })])));
    const merged: Tournament = applyPublicMatches(before.tournament, after.tournament.matches, []);
    expect(merged.matches.map((m) => [m.matchNumber, m.scoreA])).toEqual([[7, 2], [9, undefined]]);
    expect(applyPublicMatches(before.tournament, [], [S9]).matches.map((m) => m.id)).toEqual([S7]);
  });
});
