/**
 * Echte Verdrahtung von `useJoinFlow` (A-17b, Review #335 N-1): ohne eingespritzte Attrappen, nur `lib/supabase` ist ersetzt.
 * Belegt S-5 am Hook: beim Scannen entsteht keine Gerätesitzung (`signInAnonymously` nie), sie entsteht erst beim Absenden
 * des Namens, und die Anfrage trägt die sprachneutrale Gerätebezeichnung.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => {
  const session = { user: { id: 'anon-tom', is_anonymous: true } };
  return {
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    signInAnonymously: vi.fn(async () => ({ data: { session }, error: null })),
    rpc: vi.fn(),
  };
});
vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: { getSession: mocks.getSession, signInAnonymously: mocks.signInAnonymously }, rpc: mocks.rpc },
}));
vi.mock('../../auth/hooks/useAuth', () => ({ useAuth: () => ({ user: null, isGuest: false, isAnonymous: false, logout: vi.fn() }) }));
vi.mock('../../../core/contexts/RepositoryContext', () => ({ useRepositories: () => ({ tournamentRepository: {} }) }));

import { useJoinFlow } from '../useJoinFlow';

const CUP = { id: 't-cup', title: 'Live-Cup', date: '2026-11-28' };

describe('useJoinFlow: echte Verdrahtung', () => {
  it('S-5 Scan legt keine Gerätesitzung an; erst „Anfrage senden“ (@HE-074, @HE-001)', async () => {
    mocks.rpc.mockImplementation(async (fn: string) =>
      fn === 'join_code_info'
        ? { data: { state: 'open', relation: 'none', tournament: CUP, shareCode: null }, error: null }
        : { data: { result: 'PENDING', state: 'open', relation: 'pending', tournament: CUP, checkNumber: 47 }, error: null },
    );
    const { result } = renderHook(() => useJoinFlow('CODE123456'));
    await waitFor(() => expect(result.current.state.step).toBe('form'));
    expect(mocks.signInAnonymously).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith('join_code_info', { p_code: 'CODE123456' });
    expect(mocks.rpc).not.toHaveBeenCalledWith('request_helper_access', expect.anything());

    act(() => result.current.setName('Tom'));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.state.step).toBe('show'));
    expect(mocks.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('request_helper_access', expect.objectContaining({ p_code: 'CODE123456', p_display_name: 'Tom' }));
    expect(result.current.meta).toEqual({ tournament: CUP, name: 'Tom' });
  });

  it('Gegenbeispiel: ungültiger Code → nie eine Gerätesitzung', async () => {
    mocks.signInAnonymously.mockClear();
    mocks.rpc.mockImplementation(async () => ({ data: { state: 'invalid' }, error: null }));
    const { result } = renderHook(() => useJoinFlow('NOPE123456'));
    await waitFor(() => expect(result.current.state.step).toBe('show'));
    expect(mocks.signInAnonymously).not.toHaveBeenCalled();
  });
});
