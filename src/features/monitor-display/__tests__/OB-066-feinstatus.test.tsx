/**
 * Aufgabe 1.2 (Spielanzeige), R-SA8 und Auflage A2: Monitor und Zuschauer-Seite lesen den Feinstatus aus
 * `matches.live_state` (@OB-066, @ZM-115, @ZM-044) – und ein liegengebliebenes `liveState` überstimmt nie
 * „Ende“ oder „ausgefallen“. Die Spiele kommen aus der Fixture „Hallencup Nord“ (Engine → Zwischenspeicher → Mapper).
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { buildMonitorView } from '../monitorView';
import { usePublicView } from '../../public-view/usePublicView';
import type { GeneratedSchedule } from '../../../core/generators';
import type { TournamentView } from '../../../core/view';
import type { Tournament } from '../../../types/tournament';
import { fAUS, fES, fPAUSE, GAME, withCloudColumns, type Hallencup } from '../../../core/view/__fixtures__/hallencupNord';

/** `live_state` einer Halbzeitpause nach Abschnitt 1 von 2 (Form wie Engine-Fixture 57a). */
const HALBZEIT = { engine: true, status: 'section_break', phase: 'regular', section: 1, sections: 2, sectionSeconds: 600, elapsedMs: 600000, anchorAt: null, sectionStartMs: 0, breakStartedAt: 601000, breakSeconds: 60 };
/** `live_state` des Strafstoßschießens (Form wie Engine-Fixture 57f). */
const STRAFSTOSS = { engine: true, status: 'shootout', phase: 'shootout', section: 1, sections: 1, sectionSeconds: 600, elapsedMs: 600000, anchorAt: null, sectionStartMs: 0, breakStartedAt: null, breakSeconds: 60 };
/** liegengebliebenes `live_state` eines laufenden Spiels */
const ALT_LAUFEND = { engine: true, status: 'running', phase: 'regular', section: 2, sections: 2, sectionSeconds: 600, elapsedMs: 700000, anchorAt: 1000, sectionStartMs: 600000, breakStartedAt: null, breakSeconds: 60 };

const WEGE: ReadonlyArray<readonly [string, (t: Tournament) => TournamentView]> = [
  ['Monitor (buildMonitorView)', (t) => buildMonitorView(t)],
  ['Zuschauer-Seite (usePublicView)', (t) => {
    const { result } = renderHook(() => usePublicView(t, {} as unknown as GeneratedSchedule));
    if (result.current === null) { throw new Error('keine Ansicht'); }
    return result.current;
  }],
];

const idOf = (cup: Hallencup, index: number): string => cup.tournament.matches[index].id;

describe.each(WEGE)('%s', (_name, build) => {
  it('@OB-066 @ZM-115 Spiel 7 in der Halbzeit (Cache „paused“, live_state section_break): Abzeichen „Halbzeit“, weiter live', async () => {
    const cup = withCloudColumns(await fPAUSE(), GAME[7], { match_status: 'paused', live_state: HALBZEIT });
    const m = build(cup.tournament).byId.get(idOf(cup, GAME[7]));
    expect(m?.badge).toEqual({ kind: 'badge', state: 'halftime' });
    expect(m?.isLive).toBe(true);
  });

  it('@OB-066 Halbfinale 1 im Strafstoßschießen (Cache „paused“): Abzeichen „Strafstoßschießen“, nicht „Pause“', async () => {
    const cup = withCloudColumns(await fPAUSE(), GAME[7], { match_status: 'paused', live_state: STRAFSTOSS });
    const badge = build(cup.tournament).byId.get(idOf(cup, GAME[7]))?.badge;
    expect(badge).toEqual({ kind: 'badge', state: 'shootout' });
    expect(badge).not.toEqual({ kind: 'badge', state: 'pause' });
  });

  it('@OB-066 Gegenbeispiel ohne live_state: derselbe Cache „paused“ zeigt „Pause“ (Status statt Feinstatus)', async () => {
    const cup = withCloudColumns(await fPAUSE(), GAME[7], { match_status: 'paused', live_state: null });
    expect(build(cup.tournament).byId.get(idOf(cup, GAME[7]))?.badge).toEqual({ kind: 'badge', state: 'pause' });
  });

  it('@OB-066 Gegenbeispiel: Spiel beendet (Cache finished) mit altem live_state „running“ trägt „Ende“, nicht „Live“', async () => {
    const cup = await fES();
    const finale = idOf(cup, GAME.FINAL);
    const stale = withCloudColumns(cup, GAME.FINAL, { match_status: 'finished', score_a: 1, score_b: 1, decided_by: 'penalty', penalty_score_a: 4, penalty_score_b: 3, live_state: ALT_LAUFEND });
    expect(stale.tournament.matches[GAME.FINAL].liveState).toBeDefined();
    const m = build(stale.tournament).byId.get(finale);
    expect(m?.badge).toEqual({ kind: 'badge', state: 'ended' });
    expect(m?.isLive).toBe(false);
  });

  it('@OB-066 Gegenbeispiel: Spiel 9 ausgefallen (Cache skipped) mit altem live_state „running“ trägt „ausgefallen“, nicht „Live“', async () => {
    const cup = await fAUS();
    const stale = withCloudColumns(cup, GAME[9], { match_status: 'skipped', live_state: ALT_LAUFEND });
    expect(stale.tournament.matches[GAME[9]].liveState).toBeDefined();
    const m = build(stale.tournament).byId.get(idOf(cup, GAME[9]));
    expect(m?.badge).toEqual({ kind: 'badge', state: 'cancelled' });
    expect(m?.isLive).toBe(false);
  });
});
