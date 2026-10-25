/**
 * R3-3 Wege des Turnier-Lebenszyklus nach dem Abschluss: „Gleichstand entscheiden“ und „Gruppe abschließen/wieder öffnen“
 * (beide hängen an `canDecide` des StandingTieProvider = useCan(manageLifecycle)), das automatische erneute Abschließen
 * nach einer Korrektur (`useAutoRecompletion`, kein Aufruf) und die Klärungsliste (#355, übernehmen/verwerfen).
 * @LZ-036 Z. 5 „Gruppe A wieder öffnen -> bietet die App das nicht an“, @TM-150. Echte Kette useCan -> Rolle (Eigentümer) ->
 * Verzeichnis der abgeschlossenen Turniere. Gegenbeispiele: dasselbe Turnier offen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Tournament } from '../../types/tournament';
import { completion } from '../../core/standings/__tests__/groupCompletionKit';
import { id, league } from '../../core/standings/__tests__/fixtures';

const mocks = vi.hoisted((): { repo: unknown } => ({ repo: {} }));
vi.mock('../../features/auth/hooks/useMyTournamentRole', () => ({ useMyTournamentRole: () => ({ role: 'owner', isLoading: false }) }));
vi.mock('../../core/contexts/RepositoryContext', () => ({ useRepositories: () => ({ tournamentRepository: mocks.repo }) }));
vi.mock('../useOnlineStatus', () => ({ useIsOnline: () => true, useOnlineStatus: () => ({ isOnline: true }) }));
const read = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true, reviews: [] }));
vi.mock('../../features/match-engine/useMatchEngineContext', () => ({ useMatchEngineContextOptional: () => ({ accountId: 'olli' }) }));
vi.mock('../../core/repositories/matchReviewsRpc', () => ({ readMatchReviews: (...args: unknown[]) => read(...args) as unknown }));
vi.mock('../../lib/supabase', () => ({ supabase: {} }));

import { useAutoRecompletion } from '../useAutoRecompletion';
import { StandingTieProvider } from '../../features/tournament-management/standings/StandingTieProvider';
import { useStandingTie } from '../../features/tournament-management/standings/standingTieContext';
import { useMatchReviews } from '../../features/klaerungsliste/useMatchReviews';
import { setTournamentClosed, resetClosedTournaments } from '../../core/services/closedTournaments';

function ostAllein(): Tournament {
  const { tournament } = league('WONB', 'W–O 0:1; W–N 2:0; W–B 1:0; O–N 2:0; O–B 1:0; N–B 1:0', { group: undefined });
  return { ...tournament, placementsToPlayOut: [1], groupCompletions: [completion('', [id('W'), id('O'), id('N'), id('B')], { stale: true })] };
}
const ok = { status: 'ok', alreadyCompleted: false, changed: [] };

beforeEach(() => { vi.clearAllMocks(); resetClosedTournaments(); read.mockResolvedValue({ ok: true, reviews: [] }); });
afterEach(() => resetClosedTournaments());

describe('@LZ-036 Gleichstand entscheiden und Gruppe abschließen/wieder öffnen (canDecide)', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter><StandingTieProvider tournamentId="cup" onChanged={vi.fn()}>{children}</StandingTieProvider></MemoryRouter>
  );

  it('abgeschlossen: canDecide ist false – Entscheiden, Gruppe abschließen und wieder öffnen werden nicht angeboten', () => {
    setTournamentClosed('cup', true);
    const { result } = renderHook(() => useStandingTie(), { wrapper });
    expect(result.current?.canDecide).toBe(false);
  });

  it('Gegenbeispiel: offen – die Turnierleitung darf entscheiden', () => {
    const { result } = renderHook(() => useStandingTie(), { wrapper });
    expect(result.current?.canDecide).toBe(true);
  });
});

describe('@TM-150 @LZ-036 automatisches erneutes Abschließen der Gruppe (useAutoRecompletion)', () => {
  it('abgeschlossen: kein Aufruf von complete_group', async () => {
    const completeGroup = vi.fn(() => Promise.resolve(ok));
    mocks.repo = { completeGroup };
    setTournamentClosed('cup', true);
    const t = { ...ostAllein(), id: 'cup' };
    renderHook(() => { useAutoRecompletion('cup', t, vi.fn()); });
    await new Promise((r) => { setTimeout(r, 30); });
    expect(completeGroup).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: offen – die Turnierleitung schließt nach der Korrektur erneut ab', async () => {
    const completeGroup = vi.fn(() => Promise.resolve(ok));
    mocks.repo = { completeGroup };
    const t = { ...ostAllein(), id: 'cup' };
    renderHook(() => { useAutoRecompletion('cup', t, vi.fn()); });
    await waitFor(() => { expect(completeGroup).toHaveBeenCalledTimes(1); });
  });
});

describe('#355 Klärungsliste nach dem Abschluss (@LZ-036: übernehmen/verwerfen wird nicht angeboten)', () => {
  it('abgeschlossen: die Liste ist aus, es wird nichts abgefragt', async () => {
    setTournamentClosed('cup', true);
    const { result } = renderHook(() => useMatchReviews('cup'));
    await new Promise((r) => { setTimeout(r, 30); });
    expect(result.current.enabled).toBe(false);
    expect(read).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: offen – die Turnierleitung fragt die Liste ab', async () => {
    const { result } = renderHook(() => useMatchReviews('cup'));
    await waitFor(() => expect(read).toHaveBeenCalledWith({}, 'cup'));
    expect(result.current.enabled).toBe(true);
  });
});
