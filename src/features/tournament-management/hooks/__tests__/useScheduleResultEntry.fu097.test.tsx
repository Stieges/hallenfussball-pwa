/**
 * A-08f3e4 Teil K (R-KO-1) – @FU-097 „Ein abgesetztes K.o.-Spiel wird mit Unentschieden nachgetragen und fragt das
 * Strafstoßschießen mit ab“ (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`, bei @FU-093/@FU-094).
 * Gegeben Olli hat Halbfinale 2 abgesetzt · Und die Turnierregel für K.o.-Spiele lautet „Strafstoßschießen“ · Wenn Olli im
 * Spielplan 2:2 für Halbfinale 2 einträgt und die Rückfrage mit „Ja“ bestätigt · Dann fragt die App „Ergebnis des
 * Strafstoßschießens“ ab · Und nach 4:3 ist Halbfinale 2 beendet mit 2:2 (4:3 i. E.), der Sieger steht für das Finale fest
 * · Aber bei 3:1 statt 2:2 keine Strafstoß-Abfrage, und ein abgesetztes Gruppenspiel mit 2:2 fragt ebenfalls nicht.
 * Echter Weg wie `useScheduleResultEntry.test.tsx` (Engine, Ausgang, Sender gemockt), echte DE-Texte.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { MatchEngineContext } from '../../../match-engine/matchEngineContextInstance';
import { MatchCommands } from '../../../../core/match/client';
import { cacheColumns } from '../../../../core/match/client/cacheColumns';
import { buildValidMatches } from '../../../../hooks/engineMatchModel';
import { slotUpdatesAfterResult, withEngineResult } from '../../../../hooks/koSlotResolution';
import { createMockMatch } from '../../../../test/factories';
import { resultOf, slots, testUuid, vs } from '../../../../test/matchSlotFixtures';
import { teamSlot } from '../../../../core/models/matchSlot';
import { FC_NORD, GAST, HEIM, SPIEL_7, SV_SUED, makeScheduleEngine, scheduleTournament, settle, type ScheduleEngine } from '../../../../test/scheduleEngineHarness';
import type { Tournament } from '../../../../types/tournament';
import { useScheduleResultEntry } from '../useScheduleResultEntry';

await initRealDeI18n();

const HALBFINALE_2 = testUuid(312);
const FINALE = testUuid(314);

/** Live-Cup mit Halbfinale 2 (Heimteam – Auswärtsteam) und Finale „Sieger Halbfinale 2 gegen FC Nord“. */
function liveCup(): Tournament {
  return scheduleTournament({}, [
    createMockMatch({ id: HALBFINALE_2, matchNumber: 12, group: undefined, phase: 'semifinal', isFinal: true, ...vs(HEIM, GAST), matchStatus: 'skipped' }),
    createMockMatch({ id: FINALE, matchNumber: 14, group: undefined, phase: 'final', isFinal: true, finalType: 'final', ...slots(resultOf(HALBFINALE_2, 'winner'), teamSlot(FC_NORD)), matchStatus: 'scheduled' }),
  ]);
}

function render(h: ScheduleEngine) {
  const showWarning = vi.fn();
  const tournament = liveCup();
  const wrapper = ({ children }: { children: ReactNode }) => <MatchEngineContext.Provider value={h.value}>{children}</MatchEngineContext.Provider>;
  const hook = renderHook(() => useScheduleResultEntry({ tournament, showWarning, lockFinishedResults: false }), { wrapper });
  const enter = (matchId: string, a: number, b: number) => {
    let done: Promise<boolean> = Promise.resolve(true);
    act(() => { done = hook.result.current.enterScore(matchId, a, b); });
    return done;
  };
  const answer = async (value: string | null) => { await act(async () => { hook.result.current.answerPrompt(value); await settle(); }); };
  return { hook, enter, answer, showWarning, tournament };
}

/** Olli hat das Spiel abgesetzt (Server-Weg, angenommen). */
async function abgesetzt(h: ScheduleEngine, matchId: string): Promise<void> {
  const entry = buildValidMatches(liveCup()).find((e) => e.externalId === matchId);
  if (!entry) { throw new Error(`${matchId} fehlt`); }
  await h.engine.ensureMatch(entry.matchId, entry.ctx, 'T');
  await new MatchCommands({ engine: h.engine, store: h.store, sender: h.sender, accountId: h.value.accountId }).skip(entry.matchId, entry.ctx, 'leitung');
  await settle();
  h.api.mockClear();
}

const sentTypes = (h: ScheduleEngine): string[][] => h.api.mock.calls.map(([, events]) => events.map((event) => event.type));
const status = (h: ScheduleEngine, matchId: string) => h.engine.view(matchId)?.result.state.status;

describe('A-08f3e4 Teil K: abgesetztes K.-o.-Spiel mit Unentschieden (@FU-097)', () => {
  let h: ScheduleEngine;

  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    h = await makeScheduleEngine();
    await abgesetzt(h, HALBFINALE_2);
  });
  afterEach(() => {
    h.engine.stop();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function zweiZuZweiMitJa() {
    const view = render(h);
    const done = view.enter(HALBFINALE_2, 2, 2);
    await act(async () => { await settle(); });
    expect(view.hook.result.current.prompt).toEqual({ kind: 'unskip', matchNumber: 12 });
    await view.answer('yes');
    return { ...view, done };
  }

  it('@FU-097 nach „Ja“ auf die Rückfrage fragt die App das Ergebnis des Strafstoßschießens ab', async () => {
    const { hook, answer, done, showWarning } = await zweiZuZweiMitJa();

    expect(hook.result.current.prompt).toEqual({ kind: 'shootout', matchNumber: 12, score: '2:2', homeName: 'Heimteam', awayName: 'Auswärtsteam' });
    expect(showWarning).not.toHaveBeenCalled();
    expect(h.api).not.toHaveBeenCalled();
    await answer(null);
    await done;
  });

  it('@FU-097 nach 4:3 ist Halbfinale 2 beendet mit 2:2 (4:3 i. E.), ein Stapel UNSKIP + RESULT_ENTRY, der Sieger steht für das Finale fest', async () => {
    const { answer, done, tournament } = await zweiZuZweiMitJa();
    await answer('4:3');
    await done;
    await settle();

    expect(sentTypes(h)).toEqual([['UNSKIP', 'RESULT_ENTRY']]);
    expect(h.api.mock.calls[0][1][1].payload).toEqual({ scores: { [HEIM]: 2, [GAST]: 2 }, shootout: { [HEIM]: 4, [GAST]: 3 } });
    expect(status(h, HALBFINALE_2)).toBe('finished');
    const state = h.engine.view(HALBFINALE_2)?.result.state;
    expect(state && cacheColumns(state, { matchId: HALBFINALE_2, teamAId: HEIM, teamBId: GAST })).toMatchObject({
      score_a: 2, score_b: 2, penalty_score_a: 4, penalty_score_b: 3, decided_by: 'penalty',
    });
    const entry = buildValidMatches(tournament).find((e) => e.externalId === HALBFINALE_2);
    const updates = entry ? slotUpdatesAfterResult(withEngineResult(tournament, entry, h.engine.view(entry.matchId) ?? null)) : [];
    expect(updates.find((u) => u.id === FINALE)?.slotA).toMatchObject({ kind: 'team', teamId: HEIM });
  });

  it('@FU-097 Abbruch der Strafstoß-Abfrage → nichts gespeichert, Halbfinale 2 bleibt abgesetzt', async () => {
    const { answer, done } = await zweiZuZweiMitJa();
    await answer(null);
    await done;
    await settle();

    expect(h.api).not.toHaveBeenCalled();
    expect((await h.store.load(h.value.accountId, HALBFINALE_2))?.pending ?? []).toEqual([]);
    expect(status(h, HALBFINALE_2)).toBe('skipped');
  });

  it('@FU-097 Gegenbeispiel: 3:1 statt 2:2 → nach „Ja“ keine Strafstoß-Abfrage, Stapel ohne Strafstoß', async () => {
    const view = render(h);
    const done = view.enter(HALBFINALE_2, 3, 1);
    await act(async () => { await settle(); });
    await view.answer('yes');
    await done;
    await settle();

    expect(view.hook.result.current.prompt).toBeNull();
    expect(sentTypes(h)).toEqual([['UNSKIP', 'RESULT_ENTRY']]);
    expect(h.api.mock.calls[0][1][1].payload).toEqual({ scores: { [HEIM]: 3, [GAST]: 1 } });
  });

  it('@FU-097 Gegenbeispiel: abgesetztes Gruppenspiel 7 mit 2:2 → nach „Ja“ keine Strafstoß-Abfrage', async () => {
    await abgesetzt(h, SPIEL_7);
    const view = render(h);
    const done = view.enter(SPIEL_7, 2, 2);
    await act(async () => { await settle(); });
    expect(view.hook.result.current.prompt).toEqual({ kind: 'unskip', matchNumber: 7 });
    await view.answer('yes');
    await done;
    await settle();

    expect(view.hook.result.current.prompt).toBeNull();
    expect(sentTypes(h)).toEqual([['UNSKIP', 'RESULT_ENTRY']]);
    expect(h.api.mock.calls[0][1][1].payload).toEqual({ scores: { [FC_NORD]: 2, [SV_SUED]: 2 } });
  });
});
