/**
 * B-16b2 – Befund C-MON-HEARTBEAT-JE-POLL: Der Heartbeat soll alle 30 s feuern, nicht bei jedem Poll.
 * Die Daten kommen je Poll als neue Objekte (wie der echte Repository-Weg), daher der Klon.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

const { supabaseGet, localGet, rpc } = vi.hoisted(() => ({
  supabaseGet: vi.fn(),
  localGet: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(), rpc },
}));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { get: supabaseGet, getForDisplay: async (id: string) => { const t: unknown = await supabaseGet(id); return t ? { kind: 'full', version: 1, serverNowMs: 0, tournament: t } : { kind: 'not-found' }; } }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { get: localGet }; }),
}));
vi.mock('../../../hooks/useLiveMatches', () => ({
  useLiveMatches: () => ({
    lastGoalEvent: null, clearLastGoalEvent: vi.fn(), lastCardEvent: null, clearLastCardEvent: vi.fn(),
  }),
}));

import { MonitorDisplayPage } from '../MonitorDisplayPage';

const tournament = {
  id: 'tour-1', title: 'Cloud-Turnier', teams: [], matches: [],
  monitors: [{
    id: 'mon-1', name: 'Haupthalle', defaultSlideDuration: 15, transition: 'none', transitionDuration: 0,
    theme: 'dark', performanceMode: 'high',
    slides: [{ id: 's1', type: 'custom-text', config: { headline: 'Willkommen' }, duration: 15, order: 0 }],
  }],
};

const heartbeatCalls = () =>
  rpc.mock.calls.filter(([name]) => name === 'record_monitor_heartbeat').length;

describe('MonitorDisplayPage – Heartbeat (C-MON-HEARTBEAT-JE-POLL)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // Neue Objekte bei jedem Poll, wie der echte Repository-Weg.
    supabaseGet.mockImplementation(async () => structuredClone(tournament));
    localGet.mockResolvedValue(null);
    rpc.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('feuert über 60 s (Polls alle 5 s) nur alle 30 s – nicht je Poll', async () => {
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const start = heartbeatCalls();

    for (let i = 0; i < 60; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    }

    // 30 s und 60 s – genau zwei Heartbeats. Heute je Poll: 12.
    expect(heartbeatCalls() - start).toBe(2);
  });

  it('genau ein Heartbeat bei 30 000 ms, keiner bei 29 999 ms', async () => {
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const start = heartbeatCalls();

    for (let i = 0; i < 29; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    }
    await act(async () => { await vi.advanceTimersByTimeAsync(999); });
    expect(heartbeatCalls() - start).toBe(0);

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(heartbeatCalls() - start).toBe(1);
  });
});
