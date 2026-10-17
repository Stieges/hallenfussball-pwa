/**
 * useScheduleTabActions — Schnelleingabe (A-08f3e2, Plan A-08f3 v4 § 3): `handleScoreChange` ruft nur noch
 * `useScheduleResultEntry` auf. Kein Spielstand per `onMatchesUpdate`/`onTournamentUpdate`, kein `window.confirm`,
 * kein Rückgängig für Ergebnisse. Die B-40-Erwartungen (@FU-080, @TM-143: „direkt eingetragenes Ergebnis wird
 * abgepfiffen“) laufen jetzt über den Engine-Weg; die Kennungen bleiben. Der frühere `it.fails`-Beleg der
 * Übergangssperre (C-SCHNELLEINGABE-GESPERRT, Spur B 9ac6254f) ist hier grün.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { createElement, type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));

import type { Tournament } from '../../../../types/tournament';
import { calculateStandings } from '../../../../utils/calculations';
import { MatchEngineContext } from '../../../match-engine/matchEngineContextInstance';
import { buildValidMatches } from '../../../../hooks/engineMatchModel';
import { RULES } from '../../../../core/match/client/__tests__/fixtures';
import { FC_NORD, NOW, SPIEL_9, SV_SUED, makeScheduleEngine, scheduleTournament, settle, type ScheduleEngine } from '../../../../test/scheduleEngineHarness';
import { withEngineResult } from '../../../../hooks/koSlotResolution';
import { useScheduleTabActions } from '../useScheduleTabActions';

function renderActions(h: ScheduleEngine, tournament: Tournament) {
  const onTournamentUpdate = vi.fn();
  const showWarning = vi.fn();
  const confirmSpy = vi.spyOn(window, 'confirm');
  const wrapper = ({ children }: { children: ReactNode }) => createElement(MatchEngineContext.Provider, { value: h.value }, children);
  const { result } = renderHook(() => useScheduleTabActions({
    tournament,
    onTournamentUpdate,
    isEditing: false,
    saveToHistory: vi.fn(),
    showSuccess: vi.fn(),
    showWarning,
    setPendingReferee: vi.fn(),
    setPendingField: vi.fn(),
    lockFinishedResults: false,
  }), { wrapper });
  const scoreChange = async (matchId: string, a: number, b: number) => {
    await act(async () => { result.current.handleScoreChange(matchId, a, b); await settle(); });
  };
  return { scoreChange, onTournamentUpdate, showWarning, confirmSpy };
}

/** Wie `useTournamentManager`: das Turnier mit der Engine-Überlagerung von Spiel 9. */
function overlaid(h: ScheduleEngine, tournament: Tournament): Tournament {
  const entry = buildValidMatches(tournament).find((candidate) => candidate.externalId === SPIEL_9);
  return entry ? withEngineResult(tournament, entry, h.engine.view(SPIEL_9)) : tournament;
}
const punkte = (t: Tournament, teamId: string) =>
  calculateStandings(t.teams.filter((team) => team.group === 'A'), t.matches, t, 'A').find((s) => s.team.id === teamId)?.points;

describe('useScheduleTabActions — Schnelleingabe über Server-Einträge (@FU-080, @TM-143)', () => {
  let h: ScheduleEngine;

  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    h = await makeScheduleEngine();
  });
  afterEach(() => {
    h.engine.stop();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('@FU-080 Direkteintrag in ein geplantes Spiel mit echten Teams: 3:1 → beendet mit 3:1, Tabelle rechnet', async () => {
    const tournament = scheduleTournament();
    const { scoreChange, showWarning, onTournamentUpdate } = renderActions(h, tournament);
    await scoreChange(SPIEL_9, 3, 1);

    expect(showWarning).not.toHaveBeenCalled();
    const after = overlaid(h, tournament).matches.find((m) => m.id === SPIEL_9);
    expect(after).toMatchObject({ scoreA: 3, scoreB: 1, matchStatus: 'finished' });
    expect(punkte(overlaid(h, tournament), FC_NORD)).toBe(0);
    expect(punkte(overlaid(h, tournament), SV_SUED)).toBe(3);
    // Kein Spielstand am Engine-Weg vorbei (Wächter scoreWritePaths): kein Voll-Speichern.
    expect(onTournamentUpdate).not.toHaveBeenCalled();
  });

  it('@TM-143 Gegenbeispiel: läuft Spiel 9 (angepfiffen), wird nichts eingetragen und es zählt nicht in der Tabelle', async () => {
    h.fetchConfirmed.mockResolvedValueOnce({
      events: [{ id: 'start', type: 'MATCH_START', actor: 'helper', at: NOW - 60_000, section: 1, clockMs: 0, teamId: null, payload: { rules: RULES }, seq: 1 }],
      newWatermark: 1,
    });
    const tournament = scheduleTournament();
    const { scoreChange, showWarning, confirmSpy } = renderActions(h, tournament);
    await scoreChange(SPIEL_9, 3, 1);

    expect(showWarning).toHaveBeenCalledTimes(1);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(h.api).not.toHaveBeenCalled();
    expect(overlaid(h, tournament).matches.find((m) => m.id === SPIEL_9)?.matchStatus).not.toBe('finished');
    expect(punkte(overlaid(h, tournament), FC_NORD)).toBe(0);
  });
});
