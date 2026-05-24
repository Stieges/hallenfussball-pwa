/**
 * RealtimeService tests (HP-5f)
 *
 * Covers the connection lifecycle and visibility/network handling. The
 * service has no automatic backoff or reconnect-limit — that gap is
 * tracked as a finding (see docs/findings) and is intentionally not
 * exercised here. These tests are pure behaviour coverage on top of the
 * existing implementation, no production code is refactored.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

interface MockChannel {
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  name: string;
  statusCallback: ((status: string) => void) | null;
}

const hoisted = vi.hoisted(() => {
  const channels: MockChannel[] = [];

  function makeMockChannel(name: string): MockChannel {
    const channel: MockChannel = {
      name,
      on: vi.fn(() => channel),
      subscribe: vi.fn((cb: (status: string) => void) => {
        channel.statusCallback = cb;
        return channel;
      }),
      unsubscribe: vi.fn(() => Promise.resolve('ok')),
      statusCallback: null,
    };
    channels.push(channel);
    return channel;
  }

  const supabaseMock = {
    channel: vi.fn((name: string) => makeMockChannel(name)),
    removeChannel: vi.fn((ch: MockChannel) => {
      const unsubscribe = ch.unsubscribe as () => Promise<unknown>;
      void unsubscribe();
      return Promise.resolve('ok');
    }),
  };

  return { channels, supabaseMock };
});

const { channels, supabaseMock } = hoisted;

vi.mock('../../../lib/supabase', () => ({
  supabase: hoisted.supabaseMock,
  isSupabaseConfigured: true,
}));

import { RealtimeService } from '../RealtimeService';

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function resetMocks(): void {
  channels.length = 0;
  supabaseMock.channel.mockClear();
  supabaseMock.removeChannel.mockClear();
}

describe('RealtimeService — subscription lifecycle', () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates a channel and calls subscribe() on subscribeTournament', () => {
    const service = new RealtimeService();
    service.subscribeTournament({
      tournamentId: 't1',
      onMatchChange: vi.fn(),
    });

    expect(supabaseMock.channel).toHaveBeenCalledWith('tournament-t1');
    expect(channels).toHaveLength(1);
    expect(channels[0].subscribe).toHaveBeenCalledTimes(1);
    expect(service.isSubscribed('t1')).toBe(true);

    service.destroy();
  });

  it('unsubscribeTournament removes the channel and updates state', () => {
    const service = new RealtimeService();
    service.subscribeTournament({
      tournamentId: 't1',
      onMatchChange: vi.fn(),
    });

    service.unsubscribeTournament('t1');

    expect(supabaseMock.removeChannel).toHaveBeenCalledTimes(1);
    expect(service.isSubscribed('t1')).toBe(false);
    expect(service.getState().status).toBe('disconnected');

    service.destroy();
  });

  it('idempotence — subscribing same tournament twice removes the old channel first', () => {
    const service = new RealtimeService();
    service.subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn() });
    service.subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn() });

    expect(supabaseMock.channel).toHaveBeenCalledTimes(2);
    expect(supabaseMock.removeChannel).toHaveBeenCalledTimes(1);
    expect(service.isSubscribed('t1')).toBe(true);

    service.destroy();
  });

  it('unsubscribeAll tears down every active subscription', () => {
    const service = new RealtimeService();
    service.subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn() });
    service.subscribeTournament({ tournamentId: 't2', onMatchChange: vi.fn() });

    service.unsubscribeAll();

    expect(supabaseMock.removeChannel).toHaveBeenCalledTimes(2);
    expect(service.isSubscribed('t1')).toBe(false);
    expect(service.isSubscribed('t2')).toBe(false);

    service.destroy();
  });

  it('SUBSCRIBED status updates connection state and records lastConnectedAt', () => {
    const service = new RealtimeService();
    service.subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn() });

    channels[0].statusCallback?.('SUBSCRIBED');

    const state = service.getState();
    expect(state.status).toBe('connected');
    expect(state.lastConnectedAt).toBeInstanceOf(Date);

    service.destroy();
  });

  it('CHANNEL_ERROR status surfaces error to onError + flips state to error', () => {
    const service = new RealtimeService();
    const onError = vi.fn();
    service.subscribeTournament({
      tournamentId: 't1',
      onMatchChange: vi.fn(),
      onError,
    });

    channels[0].statusCallback?.('CHANNEL_ERROR');

    expect(onError).toHaveBeenCalledTimes(1);
    expect(service.getState().status).toBe('error');
    expect(service.getState().lastError).toBeInstanceOf(Error);

    service.destroy();
  });
});

describe('RealtimeService — pause/resume + visibility', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('pause() removes active channels and marks state as paused', () => {
    const service = new RealtimeService();
    service.subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn() });

    service.pause();

    expect(supabaseMock.removeChannel).toHaveBeenCalledTimes(1);
    expect(service.getState().isPaused).toBe(true);
    expect(service.getState().status).toBe('paused');

    service.destroy();
  });

  it('resume() recreates channels for previously subscribed tournaments', () => {
    const service = new RealtimeService();
    service.subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn() });
    service.subscribeTournament({ tournamentId: 't2', onMatchChange: vi.fn() });

    const channelsCreatedBeforePause = supabaseMock.channel.mock.calls.length;

    service.pause();
    service.resume();

    expect(supabaseMock.channel.mock.calls.length).toBe(
      channelsCreatedBeforePause + 2,
    );
    expect(service.getState().isPaused).toBe(false);

    service.destroy();
  });

  it('visibilitychange to hidden pauses, back to visible resumes', () => {
    const service = new RealtimeService();
    service.subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn() });

    const hiddenSpy = vi.spyOn(document, 'hidden', 'get');

    hiddenSpy.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(service.getState().isPaused).toBe(true);

    hiddenSpy.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(service.getState().isPaused).toBe(false);

    hiddenSpy.mockRestore();
    service.destroy();
  });
});

describe('RealtimeService — network handling + cleanup', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('window online event triggers a resubscribe', async () => {
    const service = new RealtimeService();
    service.subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn() });

    const channelsBefore = supabaseMock.channel.mock.calls.length;

    const onlineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    await flushPromises();

    expect(supabaseMock.channel.mock.calls.length).toBeGreaterThan(channelsBefore);

    onlineSpy.mockRestore();
    service.destroy();
  });

  it('destroy() removes all listeners and channels', () => {
    const removeDocSpy = vi.spyOn(document, 'removeEventListener');
    const removeWinSpy = vi.spyOn(window, 'removeEventListener');

    const service = new RealtimeService();
    service.subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn() });

    service.destroy();

    expect(removeDocSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
    expect(removeWinSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(service.isSubscribed('t1')).toBe(false);

    removeDocSpy.mockRestore();
    removeWinSpy.mockRestore();
  });
});
