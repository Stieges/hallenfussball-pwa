/**
 * A-06k (@FU-025): SupabaseLiveMatchRepository.subscribe meldet den Kanal-Zustand ueber
 * `onStatusChange` (SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT / CLOSED). Der Fake-Kanal merkt sich
 * den Status-Callback aus `.subscribe(...)` und laesst den Test die Zustaende nacheinander melden.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  let statusCallback: ((status: string, err?: Error) => void) | null = null;

  const channelApi = {
    on: vi.fn(() => channelApi),
    subscribe: vi.fn((cb?: (status: string, err?: Error) => void) => {
      statusCallback = cb ?? null;
      return channelApi;
    }),
  };
  const channelMock = vi.fn(() => channelApi);
  const supabaseMock = { channel: channelMock, from: vi.fn(), removeChannel: vi.fn() };

  return {
    channelMock,
    channelApi,
    supabaseMock,
    emitStatus: (status: string, err?: Error) => statusCallback?.(status, err),
  };
});

vi.mock('../../../lib/supabase', () => ({
  supabase: hoisted.supabaseMock,
  isSupabaseConfigured: true,
}));

vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: vi.fn(),
}));

import { SupabaseLiveMatchRepository } from '../SupabaseLiveMatchRepository';

describe('SupabaseLiveMatchRepository.subscribe — onStatusChange (A-06k, @FU-025)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('meldet alle vier Kanal-Zustaende in der Reihenfolge, in der sie eintreten', () => {
    const repo = new SupabaseLiveMatchRepository();
    const onStatusChange = vi.fn();

    repo.subscribe('tour-1', { onStatusChange });

    hoisted.emitStatus('SUBSCRIBED');
    hoisted.emitStatus('CHANNEL_ERROR', new Error('boom'));
    hoisted.emitStatus('TIMED_OUT');
    hoisted.emitStatus('CLOSED');

    expect(onStatusChange.mock.calls.map((call) => call[0])).toEqual([
      'SUBSCRIBED',
      'CHANNEL_ERROR',
      'TIMED_OUT',
      'CLOSED',
    ]);
  });

  it('ruft bei CHANNEL_ERROR zusaetzlich onError auf (bestehendes Verhalten bleibt)', () => {
    const repo = new SupabaseLiveMatchRepository();
    const onError = vi.fn();
    const onStatusChange = vi.fn();

    repo.subscribe('tour-1', { onError, onStatusChange });
    hoisted.emitStatus('CHANNEL_ERROR');

    expect(onStatusChange).toHaveBeenCalledWith('CHANNEL_ERROR');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: ohne onStatusChange laeuft subscribe unveraendert weiter (kein Wurf)', () => {
    const repo = new SupabaseLiveMatchRepository();

    expect(() => {
      repo.subscribe('tour-1', { onMatchChange: vi.fn() });
      hoisted.emitStatus('CLOSED');
    }).not.toThrow();
  });
});
