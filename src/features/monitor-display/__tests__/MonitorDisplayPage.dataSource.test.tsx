/** MonitorDisplayPage — lädt das Turnier über die Repositories (L2). Vorher: alte lokale API-Schicht, nur ein Gerät. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// vi.mock factories are hoisted above all top-level statements, including plain `const`
// declarations further down the file — referencing those directly throws a TDZ error
// ("Cannot access '...' before initialization"). vi.hoisted() hoists the values themselves
// so the factories below can safely close over them. See https://vitest.dev/api/vi.html#vi-hoisted
const { supabaseGet, localGet } = vi.hoisted(() => ({
  supabaseGet: vi.fn(),
  localGet: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(() => ({ upsert: vi.fn().mockResolvedValue({}) })), rpc: vi.fn().mockResolvedValue({ error: null }) },
}));
// Regular `function` (not an arrow function) so `new SupabaseRepository()` in the production
// code — matching the LiveViewScreen.tsx pattern — can actually invoke it as a constructor.
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { get: supabaseGet }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { get: localGet }; }),
}));

const { useLiveMatchesSpy } = vi.hoisted(() => ({
  useLiveMatchesSpy: vi.fn(() => ({
    liveMatches: new Map(), runningMatches: [], pausedMatches: [], runningMatchIds: new Set<string>(),
    getMatchById: vi.fn(), lastGoalEvent: null, clearLastGoalEvent: vi.fn(),
    lastCardEvent: null, clearLastCardEvent: vi.fn(), calculateElapsedSeconds: () => 0,
  })),
}));
vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: useLiveMatchesSpy }));

import { MonitorDisplayPage } from '../MonitorDisplayPage';

const cloudTournament = {
  id: 'tour-1', title: 'Cloud-Turnier', teams: [], matches: [],
  monitors: [{
    id: 'mon-1', name: 'Haupthalle', defaultSlideDuration: 15, transition: 'none', transitionDuration: 0,
    theme: 'dark', performanceMode: 'low',
    // CustomTextSlide rendert `config.headline`/`config.body` (siehe src/types/monitor.ts) — nicht `customText`.
    slides: [{ id: 's1', type: 'custom-text', config: { headline: 'Willkommen in der Halle' }, duration: 15, order: 0 }],
  }],
};

describe('MonitorDisplayPage — Datenherkunft (L2)', () => {
  beforeEach(() => { vi.clearAllMocks(); supabaseGet.mockResolvedValue(cloudTournament); localGet.mockResolvedValue(null); });

  it('L2: lädt das Turnier aus Supabase, wenn lokal nichts liegt', async () => {
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await waitFor(() => expect(supabaseGet).toHaveBeenCalledWith('tour-1'));
    await waitFor(() => expect(screen.getByText('Willkommen in der Halle')).toBeInTheDocument());
  });

  it('L2: schaltet useLiveMatches bei Cloud-Herkunft auf Anon-Realtime', async () => {
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await waitFor(() => expect(useLiveMatchesSpy).toHaveBeenCalledWith('tour-1', { allowPublicRealtime: true }));
  });

  it('Regression: fällt auf localStorage zurück, wenn die Cloud nichts liefert', async () => {
    supabaseGet.mockResolvedValue(null); localGet.mockResolvedValue(cloudTournament);
    render(<MonitorDisplayPage tournamentId="tour-1" monitorId="mon-1" onBack={vi.fn()} />);
    await waitFor(() => expect(localGet).toHaveBeenCalledWith('tour-1'));
    await waitFor(() => expect(useLiveMatchesSpy).toHaveBeenLastCalledWith('tour-1', { allowPublicRealtime: false }));
  });
});
