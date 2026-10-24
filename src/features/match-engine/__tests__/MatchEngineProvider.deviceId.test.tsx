/**
 * B-49 (Befund C-HELFER-FELD-OHNE-SPERRE, N0): Der Ausgang sendet jeden Eintrag mit der stabilen Geräte-ID dieses Geräts.
 * A-34 greift erst mit Geräte-ID (ohne sie entsteht kein Anspruch, zwei Geräte bedienen dasselbe Spiel). Echte
 * MatchEngine/OutboxSender/LocalMatchStore (fake-indexeddb), nur `useAuth`/`useRepositories` gemockt.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import type { EngineEvent } from '../../../core/match';
import { acceptAll } from '../../../core/match/client/__tests__/outboxHarness';
import type { AppendableEvent, AppendOptions } from '../../../core/repositories/appendMatchEventsRpc';
import { getDeviceId } from '../../../core/device/deviceId';

const mockAuth = { user: { id: 'tom', globalRole: 'organizer' }, session: { token: 'token-1' } };
vi.mock('../../auth/hooks/useAuth', () => ({ useAuth: () => mockAuth }));

const append = vi.hoisted(() => vi.fn());
vi.mock('../../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => ({
    supabaseLiveMatchRepo: { appendMatchEvents: append, serverTime: () => Promise.resolve(Date.now()) },
    tournamentRepository: {},
  }),
}));
vi.mock('../../../lib/supabase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/supabase')>()),
  isSupabaseConfigured: true,
}));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));

import { MatchEngineProvider } from '../MatchEngineProvider';
import { useMatchEngineContext } from '../useMatchEngineContext';
import type { MatchEngineContextValue } from '../matchEngineContextInstance';

const CTX = { matchId: 'spiel-15', teamAId: 'a', teamBId: 'b' };
const ANPFIFF: EngineEvent = {
  id: '44444444-4444-4444-8444-444444444444', type: 'MATCH_START', actor: 'helper', at: 1_790_000_000_000, section: 1, clockMs: 0, teamId: null, payload: {},
};

function Probe({ onReady }: { onReady: (ctx: MatchEngineContextValue) => void }) {
  onReady(useMatchEngineContext());
  return null;
}

describe('B-49 Geräte-ID im Ausgang', () => {
  beforeEach(() => {
    append.mockReset();
    append.mockImplementation((_matchId: string, events: readonly AppendableEvent[]) => Promise.resolve(acceptAll(events)));
  });

  it('@FU-030 @FU-026 Toms Anpfiff geht mit Toms Geräte-ID an append_match_events (der Server kann ihm das Feld zuordnen)', async () => {
    let ctx: MatchEngineContextValue | null = null;
    render(<MatchEngineProvider><Probe onReady={(value) => { ctx = value; }} /></MatchEngineProvider>);
    await waitFor(() => expect(ctx?.accountId).toBe('tom'));
    const c = ctx as unknown as MatchEngineContextValue;
    await c.store.create('tom', CTX.matchId, CTX, 'T');
    await c.store.addPending('tom', CTX.matchId, ANPFIFF);
    await c.sender.kick(CTX.matchId);

    await waitFor(() => expect(append).toHaveBeenCalled());
    const options = append.mock.calls[0][2] as AppendOptions;
    expect(options.deviceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(options.deviceId).toBe(getDeviceId());
  });

  it('Brief A-34 L7: der Ausgang meldet Format 2 (Geräte-ID und Epoche), der Server nimmt jedes Format >= min_client_format (1) an', async () => {
    let ctx: MatchEngineContextValue | null = null;
    render(<MatchEngineProvider><Probe onReady={(value) => { ctx = value; }} /></MatchEngineProvider>);
    await waitFor(() => expect(ctx?.accountId).toBe('tom'));
    const c = ctx as unknown as MatchEngineContextValue;
    await c.store.create('tom', 'spiel-16', { ...CTX, matchId: 'spiel-16' }, 'T');
    await c.store.addPending('tom', 'spiel-16', { ...ANPFIFF, id: '55555555-5555-4555-8555-555555555555' });
    await c.sender.kick('spiel-16');
    await waitFor(() => expect(append).toHaveBeenCalled());
    expect((append.mock.calls[0][2] as AppendOptions).clientFormat).toBe(2);
  });
});
