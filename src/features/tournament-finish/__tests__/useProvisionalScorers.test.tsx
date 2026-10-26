/**
 * R3-5 Fixrunde 1 (Review #397 m-2): vorläufige Torschützen MIT Spielsteuerung. Ereignisse der Steuerung haben Vorrang; scheitert
 * das Laden, zählen die am Spiel gespeicherten Ereignisse und der Hinweis „evtl. unvollständig“ ist gesetzt (kein stiller Rückfall).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { NK } from '../../../core/standings/__tests__/groupCompletionKit';
import { nikolausFertig } from '../../../core/services/__tests__/finishKit';
import { MatchEngineContext, type MatchEngineContextValue } from '../../match-engine/matchEngineContextInstance';

const load = vi.hoisted(() => vi.fn());
vi.mock('../../match-engine/loadEngineEventsForExport', () => ({ loadEngineEventsForExport: load }));
import { useProvisionalScorers } from '../hooks/useProvisionalScorers';

const goal = (id: string, playerNumber: number) => ({ id, type: 'GOAL', timestampSeconds: 10, payload: { teamId: NK.kammer, playerNumber } });
let turnier: Tournament;
const context = {} as MatchEngineContextValue;
const wrapper = ({ children }: { children: ReactNode }) => <MatchEngineContext.Provider value={context}>{children}</MatchEngineContext.Provider>;

beforeEach(async () => {
  load.mockReset();
  const fertig = await nikolausFertig();
  // am Spiel gespeichert: Tor von Nummer 7; die Steuerung kennt dagegen Nummer 9
  turnier = { ...fertig, matches: fertig.matches.map((m, i) => (i === 0 ? { ...m, events: [goal('lokal', 7)] as never } : m)) };
});

describe('@ET-042 vorläufige Torschützen mit Spielsteuerung', () => {
  it('die Ereignisse der Steuerung haben Vorrang vor den am Spiel gespeicherten, kein Hinweis', async () => {
    load.mockResolvedValue(new Map([[turnier.matches[0].id, [goal('engine', 9)]]]));
    const { result } = renderHook(() => useProvisionalScorers(turnier, true), { wrapper });
    await waitFor(() => expect(result.current.scorers.some((s) => s.kind === 'player' && s.number === 9)).toBe(true));
    expect(result.current.scorers.some((s) => s.kind === 'player' && s.number === 7)).toBe(false);
    expect(result.current.incomplete).toBe(false);
  });

  it('Gegenbeispiel: das Laden scheitert → Rückfall auf die am Spiel gespeicherten Ereignisse UND Hinweis „evtl. unvollständig“', async () => {
    load.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useProvisionalScorers(turnier, true), { wrapper });
    await waitFor(() => expect(result.current.incomplete).toBe(true));
    expect(result.current.scorers.some((s) => s.kind === 'player' && s.number === 7)).toBe(true);
  });

  it('abgeschlossen (nicht aktiv): keine Liste, kein Laden', () => {
    const { result } = renderHook(() => useProvisionalScorers(turnier, false), { wrapper });
    expect(result.current).toEqual({ scorers: [], incomplete: false });
    expect(load).not.toHaveBeenCalled();
  });
});
