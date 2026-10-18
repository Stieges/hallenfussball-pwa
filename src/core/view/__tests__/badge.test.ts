/**
 * Aufgabe 1.1 (Spielanzeige): Zuordnung Zustand → Abzeichen (@OB-065, @OB-066, @ZM-044, @ZM-115) und Feinstatus
 * aus `matches.live_state` (R-SA8). Die Erwartungen stammen aus dem Gherkin, die live_state-Formen aus den
 * Engine-Fixtures 57a/57c/57e/57f.
 */
import { describe, expect, it } from 'vitest';
import { badgeDetailFromLiveState, matchBadgeModel, type MatchBadgeEngineDetail, type MatchBadgeInput } from '../badge';
import type { EngineStatus } from '../types';
import fx57a from '../../match/__fixtures__/57a-halbzeit-pause.json';
import fx57c from '../../match/__fixtures__/57c-pause-vor-verlaengerung.json';
import fx57e from '../../match/__fixtures__/57e-verlaengerung-laeuft.json';
import fx57f from '../../match/__fixtures__/57f-strafstossschiessen-live-state.json';

function E(status: EngineStatus, phase: MatchBadgeEngineDetail['phase'], section: number, sections: number): MatchBadgeEngineDetail {
  return { status, phase, section, sections };
}

describe('matchBadgeModel', () => {
  it.each([
    ['Spiel 7 läuft', { status: 'running' }, { kind: 'badge', state: 'live' }],
    ['Spiel 7 läuft in der 2. Halbzeit, Tom hat die Uhr angehalten', { status: 'paused', engine: E('paused', 'regular', 2, 2) }, { kind: 'badge', state: 'pause' }],
    ['Spiel 7 in der Halbzeit', { status: 'paused', engine: E('section_break', 'regular', 1, 2) }, { kind: 'badge', state: 'halftime' }],
    ['Spiel um Platz 3 in der Pause vor der Verlängerung', { status: 'paused', engine: E('section_break', 'regular', 2, 2) }, { kind: 'badge', state: 'pause' }],
    ['Spiel um Platz 3 in der Verlängerung', { status: 'running', engine: E('running', 'overtime', 3, 2) }, { kind: 'badge', state: 'overtime' }],
    ['Halbfinale 1 im Strafstoßschießen', { status: 'paused', engine: E('shootout', 'shootout', 3, 2) }, { kind: 'badge', state: 'shootout' }],
    ['Spiel 1 beendet 2:0', { status: 'finished' }, { kind: 'badge', state: 'ended' }],
    ['Spiel 9 ausgefallen', { status: 'cancelled' }, { kind: 'badge', state: 'cancelled' }],
    ['Spiel 9 gewertet (Abzeichen „Ende“)', { status: 'awarded' }, { kind: 'badge', state: 'ended' }],
    ['Spiel 11 geplant um 15:05', { status: 'scheduled', kickoff: { date: '2026-11-28', time: '15:05' } }, { kind: 'kickoff', time: '15:05' }],
  ])('@OB-066 %s', (_name, input, erwartet) => {
    expect(matchBadgeModel(input as MatchBadgeInput)).toEqual(erwartet);
  });

  it('@OB-066 Spiel 7 läuft: auch mit Feinstatus „running“ in der regulären Spielzeit heißt es „Live“', () => {
    expect(matchBadgeModel({ status: 'running', engine: E('running', 'regular', 1, 2) })).toEqual({ kind: 'badge', state: 'live' });
  });

  it('@ZM-115 vier Abschnitte: Pause nach dem 1. von 4 heißt „Pause“, nicht „Halbzeit“', () => {
    expect(matchBadgeModel({ status: 'paused', engine: E('section_break', 'regular', 1, 4) })).toEqual({ kind: 'badge', state: 'pause' });
  });

  it('@ZM-115 zwei Abschnitte, Gegenbeispiel: Pause nach dem 2. von 2 ist keine Halbzeit', () => {
    expect(matchBadgeModel({ status: 'paused', engine: E('section_break', 'regular', 2, 2) })).not.toEqual({ kind: 'badge', state: 'halftime' });
  });

  it('@ZM-115 ein Abschnitt: abgepfiffen heißt „Ende“, nicht „Halbzeit“', () => {
    expect(matchBadgeModel({ status: 'finished', engine: E('finished', 'regular', 1, 1) })).toEqual({ kind: 'badge', state: 'ended' });
  });

  it('@ZM-044 Pause vor dem Strafstoßschießen heißt „Pause“, nicht „Strafstoßschießen“', () => {
    expect(matchBadgeModel({ status: 'paused', engine: E('section_break', 'shootout', 1, 1) })).toEqual({ kind: 'badge', state: 'pause' });
  });

  it('@ZM-044 Entscheidung offen (Auswahl der Verlängerung) heißt „Pause“', () => {
    expect(matchBadgeModel({ status: 'paused', engine: E('decision_pending', 'regular', 1, 1) })).toEqual({ kind: 'badge', state: 'pause' });
  });

  it('@OB-066 Feinstatus „skipped“ heißt „ausgefallen“', () => {
    expect(matchBadgeModel({ status: 'cancelled', engine: E('skipped', 'regular', 1, 1) })).toEqual({ kind: 'badge', state: 'cancelled' });
  });

  it('@OB-065 Gegenbeispiel: ein geplantes Spiel trägt kein Abzeichen, sondern die Anstoßzeit', () => {
    const model = matchBadgeModel({ status: 'scheduled', kickoff: { date: '2026-11-28', time: '15:05' } });
    expect(model.kind).toBe('kickoff');
    expect(model.kind).not.toBe('badge');
  });

  it('@OB-065 Gegenbeispiel: geplant ohne Anstoßzeit trägt gar nichts', () => {
    expect(matchBadgeModel({ status: 'scheduled' })).toEqual({ kind: 'none' });
  });
});

const NOW_57A = 601_000 + 30_000; // 30 s nach dem Abpfiff der 1. Halbzeit
type LiveStateFixture = { expect: { liveState: unknown } };

describe('badgeDetailFromLiveState (Feinstatus für Monitor und Zuschauer, R-SA8)', () => {
  it('@OB-066 live_state 57a (Halbzeitpause): section_break, Abschnitt 1 von 2, Pausen-Restzeit aus breakStartedAt/breakSeconds', () => {
    const detail = badgeDetailFromLiveState((fx57a as LiveStateFixture).expect.liveState, NOW_57A);
    expect(detail).toMatchObject({ status: 'section_break', phase: 'regular', section: 1, sections: 2, sectionSeconds: 600, breakRemainingSec: 30 });
    expect(matchBadgeModel({ status: 'paused', ...(detail === undefined ? {} : { engine: detail }) })).toEqual({ kind: 'badge', state: 'halftime' });
  });

  it('@ZM-115 Gegenbeispiel: die Pausen-Restzeit wird nie negativ', () => {
    expect(badgeDetailFromLiveState((fx57a as LiveStateFixture).expect.liveState, 601_000 + 500_000)?.breakRemainingSec).toBe(0);
  });

  it('@OB-066 live_state 57c (Pause vor der Verlängerung): Abzeichen „Pause“, Pausen-Restzeit 0:40 nach 20 s (@ZM-044)', () => {
    const detail = badgeDetailFromLiveState((fx57c as LiveStateFixture).expect.liveState, 601_000 + 20_000);
    expect(detail).toMatchObject({ status: 'section_break', phase: 'overtime', section: 2, sections: 1, breakRemainingSec: 40 });
    expect(matchBadgeModel({ status: 'paused', ...(detail === undefined ? {} : { engine: detail }) })).toEqual({ kind: 'badge', state: 'pause' });
  });

  it('@OB-066 live_state Verlängerung (57e): Abzeichen „Verlängerung“, 1:20 in der Verlängerung gespielt (@ZM-039)', () => {
    const detail = badgeDetailFromLiveState((fx57e as LiveStateFixture).expect.liveState, 661_000 + 80_000);
    expect(detail).toMatchObject({ status: 'running', phase: 'overtime', section: 2, sections: 1, sectionElapsedSec: 80 });
    expect(matchBadgeModel({ status: 'running', ...(detail === undefined ? {} : { engine: detail }) })).toEqual({ kind: 'badge', state: 'overtime' });
  });

  it('@OB-066 live_state Strafstoßschießen (57f): „Strafstoßschießen“, nicht „Pause“', () => {
    const detail = badgeDetailFromLiveState((fx57f as LiveStateFixture).expect.liveState, 700_000);
    expect(detail).toMatchObject({ status: 'shootout', phase: 'shootout' });
    const model = matchBadgeModel({ status: 'paused', ...(detail === undefined ? {} : { engine: detail }) });
    expect(model).toEqual({ kind: 'badge', state: 'shootout' });
    expect(model).not.toEqual({ kind: 'badge', state: 'pause' });
  });

  it('@OB-066 angehaltene Uhr: die gespielte Zeit im Abschnitt bleibt stehen, auch wenn die Zeit weiterläuft', () => {
    const stopped = { engine: true, status: 'paused', phase: 'regular', section: 1, sections: 2, sectionSeconds: 600, elapsedMs: 460_000, anchorAt: null, sectionStartMs: 0, breakStartedAt: null, breakSeconds: 60 };
    expect(badgeDetailFromLiveState(stopped, 1_000_000)?.sectionElapsedSec).toBe(460);
    expect(badgeDetailFromLiveState(stopped, 9_000_000)?.sectionElapsedSec).toBe(460);
  });

  it('@OB-066 Gegenbeispiel: ungültiges live_state → undefined, das Abzeichen kommt aus dem Status', () => {
    expect(badgeDetailFromLiveState({ status: 42 }, 1000)).toBeUndefined();
    expect(badgeDetailFromLiveState(null, 1000)).toBeUndefined();
    expect(badgeDetailFromLiveState('kaputt', 1000)).toBeUndefined();
    expect(matchBadgeModel({ status: 'running' })).toEqual({ kind: 'badge', state: 'live' });
  });
});
