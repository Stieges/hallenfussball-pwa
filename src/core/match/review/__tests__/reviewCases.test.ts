/**
 * B-50 Klärungsliste – Fälle und Kopplung, aus dem Gherkin (Record Fundament F1b, Helfer am Turniertag).
 * @FU-038, @FU-095, @FU-096, @FU-017, @HE-056, @FU-037, @FU-130 (Oberflächen-Teil; Server-Teil = A-35).
 */
import { describe, expect, it } from 'vitest';
import { buildReviewCases, buildReviewNotices, buildUnits, openReviewCount } from '../reviewCases';
import { parseMatchReviews } from '../matchReviewTypes';
import { NORD, SUED, review } from './reviewFixtures';

describe('@FU-038 Unklarer Offline-Eintrag landet in der Klärungsliste', () => {
  it('ein Tor von Tom nach der Übernahme ist ein Fall „1 Eintrag von Tom nach Übernahme“ und zählt im Zähler', () => {
    const tor = review({ reason: 'CONTROL_LOST', detail: { timing: 'after' } });
    const [fall] = buildReviewCases([tor], 120);
    expect(fall).toMatchObject({ count: 1, author: 'Tom', reasonKey: 'afterTakeover', matchNumber: 9, field: 2 });
    expect(fall.units).toHaveLength(1);
    expect(fall.units[0].acceptable).toBe(true);
    expect(openReviewCount([tor])).toBe(1);
  });

  it('Gegenbeispiel: ein schon entschiedener Eintrag und ein Hinweis (@FU-037) sind kein offener Fall', () => {
    const entschieden = review({ decision: { type: 'REVIEW_DISCARD', eventId: 'd1', at: 5, by: 'Olli' } });
    const hinweis = review({ kind: 'notice' });
    expect(buildReviewCases([entschieden, hinweis], 120)).toEqual([]);
    expect(openReviewCount([entschieden, hinweis])).toBe(0);
  });

  it('Gegenbeispiel: Einträge zweier Absender oder zweier Spiele sind getrennte Fälle', () => {
    const tom = review({ author: 'Tom' });
    const clara = review({ author: 'Clara' });
    const anderesSpiel = review({ author: 'Tom', matchId: 'match-10', matchNumber: 10 });
    expect(buildReviewCases([tom, clara, anderesSpiel], 120)).toHaveLength(3);
  });
});

describe('@FU-095 Aus einem Fall übernimmt die Turnierleitung einzelne Einträge', () => {
  it('„3 Einträge von Tom nach Übernahme“: Tor FC Nord, Tor SV Süd, Gelbe Karte SV Süd Nr. 5 → ein Fall mit drei Häkchen', () => {
    const fall = buildReviewCases([
      review({ entry: { type: 'GOAL', teamId: NORD } }),
      review({ entry: { type: 'GOAL', teamId: SUED } }),
      review({ entry: { type: 'YELLOW_CARD', teamId: SUED, payload: { playerNumber: 5 } } }),
    ], 120);
    expect(fall).toHaveLength(1);
    expect(fall[0].count).toBe(3);
    expect(fall[0].units).toHaveLength(3);
  });
});

describe('@FU-096 Zusammengehörige Einträge eines Falls lassen sich nur gemeinsam übernehmen', () => {
  it('Gelbe Karte und die darauf folgende Gelb-Rote Karte für SV Süd, Nr. 5 → ein Eintrag mit einem Häkchen', () => {
    const gelb = review({ entry: { type: 'YELLOW_CARD', teamId: SUED, clockMs: 60_000, payload: { playerNumber: 5 } } });
    const gelbRot = review({ entry: { type: 'YELLOW_RED_CARD', teamId: SUED, clockMs: 90_000, payload: { playerNumber: 5 } } });
    const units = buildUnits([gelbRot, gelb], 120);
    expect(units).toHaveLength(1);
    expect(units[0].reviews.map((r) => r.eventId)).toEqual([gelb.eventId, gelbRot.eventId]);
  });

  it('Gegenbeispiel: Gelb für Nr. 5 und Gelb-Rot für Nr. 7 bleiben zwei Häkchen', () => {
    const units = buildUnits([
      review({ entry: { type: 'YELLOW_CARD', teamId: SUED, payload: { playerNumber: 5 } } }),
      review({ entry: { type: 'YELLOW_RED_CARD', teamId: SUED, payload: { playerNumber: 7 } } }),
    ], 120);
    expect(units).toHaveLength(2);
  });

  it('ebenso ein Tor mit seiner Rücknahme', () => {
    const tor = review({ entry: { type: 'GOAL', teamId: NORD } });
    const ruecknahme = review({ entry: { type: 'RETRACT', teamId: null, targetId: tor.eventId } });
    const units = buildUnits([tor, ruecknahme], 120);
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({ retractPair: true, acceptable: true });
  });

  it('ebenso ein Gegentor mit der Zeitstrafe, die es beendet hat', () => {
    const strafe = review({ entry: { type: 'TIME_PENALTY', teamId: SUED, clockMs: 60_000, payload: {} } });
    const gegentor = review({ entry: { type: 'GOAL', teamId: NORD, clockMs: 90_000 } });
    expect(buildUnits([strafe, gegentor], 120)).toHaveLength(1);
  });

  it('Gegenbeispiel: ein Tor nach Ablauf der Strafzeit oder ein Tor des bestraften Teams beendet die Zeitstrafe nicht', () => {
    const strafe = review({ entry: { type: 'TIME_PENALTY', teamId: SUED, clockMs: 60_000, payload: {} } });
    const spaet = review({ entry: { type: 'GOAL', teamId: NORD, clockMs: 200_000 } });
    const eigenes = review({ entry: { type: 'GOAL', teamId: SUED, clockMs: 70_000 } });
    expect(buildUnits([strafe, spaet], 120)).toHaveLength(2);
    expect(buildUnits([strafe, eigenes], 120)).toHaveLength(2);
  });
});

describe('Grund des Falls (@FU-017, @HE-056, @FU-130, @FU-116 Z. 2)', () => {
  it('Recht entzogen → „von Tom, Recht entzogen“; nach dem Ende → „nach dem Ende angekommen“', () => {
    const [entzogen] = buildReviewCases([review({ reason: 'RIGHTS_REVOKED', detail: { change: 'revoked' } })], 120);
    const [ende] = buildReviewCases([review({ reason: 'AFTER_END', detail: {} })], 120);
    expect(entzogen.reasonKey).toBe('rightsRevoked');
    expect(ende.reasonKey).toBe('afterEnd');
  });

  it('Gegenbeispiel: Steuer verloren vor der Übernahme heißt nicht „nach Übernahme“', () => {
    const [vorher] = buildReviewCases([review({ detail: { timing: 'before', why: 'DUPLICATE' } })], 120);
    expect(vorher.reasonKey).toBe('beforeTakeover');
  });
});

describe('@FU-037 Eindeutiger Offline-Eintrag wird automatisch einsortiert – Hinweis', () => {
  it('ein eingefügtes Tor von Tom auf Feld 2 ist ein Hinweis mit 1 Tor', () => {
    const notices = buildReviewNotices([review({ kind: 'notice', entry: { type: 'GOAL' } })]);
    expect(notices).toEqual([expect.objectContaining({ count: 1, author: 'Tom', field: 2, onlyGoals: true })]);
  });

  it('Gegenbeispiel: ein offener Klärungseintrag ist kein Hinweis', () => {
    expect(buildReviewNotices([review()])).toEqual([]);
  });
});

describe('Antwort von list_match_reviews lesen', () => {
  it('unlesbare Einträge fallen weg, kein Array ergibt eine leere Liste', () => {
    expect(parseMatchReviews(null)).toEqual([]);
    expect(parseMatchReviews([review(), { eventId: 'kaputt' }])).toHaveLength(1);
  });
});
