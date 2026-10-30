/**
 * R5 PR 1 – Änderungssignal (Zone 1 „Änderungssignal“, F2): öffentlicher Kanal `display:<turnier>`, Ereignis
 * `changed`, Inhalt wird nie gelesen; ein Kanal je Turnier, auch wenn zwei Zuhörer da sind; ein neuer Beitritt wartet,
 * bis der alte Kanal entfernt ist (C-LIVE-KANAL-LEAVING-WIEDERVERWENDUNG).
 */
import { describe, it, expect, vi } from 'vitest';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { displaySignalTopic, subscribeDisplaySignal, type DisplaySignalClient } from '../displaySignal';

interface FakeChannel {
  topic: string;
  params: unknown;
  broadcast: (() => void) | null;
  status: ((s: string) => void) | null;
}

function fakeClient() {
  const channels: FakeChannel[] = [];
  let release: (() => void) | null = null;
  const client: DisplaySignalClient = {
    channel: vi.fn((topic: string, params: { config: { private: boolean } }) => {
      const fake: FakeChannel = { topic, params, broadcast: null, status: null };
      channels.push(fake);
      const api = {
        on: (_type: string, filter: { event: string }, cb: () => void) => { if (filter.event === 'changed') { fake.broadcast = cb; } return api; },
        subscribe: (cb: (s: string) => void) => { fake.status = cb; return api; },
      };
      return api as unknown as RealtimeChannel;
    }),
    removeChannel: vi.fn(() => new Promise<unknown>((resolve) => { release = () => resolve('ok'); })),
  };
  return { client, channels, release: () => release?.() };
}

const flush = () => new Promise<void>((r) => { setTimeout(r, 0); });

describe('subscribeDisplaySignal', () => {
  it('öffentlicher Kanal display:<turnier>, Ereignis changed -> Zuhörer wird gerufen', async () => {
    const { client, channels } = fakeClient();
    const onSignal = vi.fn();
    const off = subscribeDisplaySignal('t-1', onSignal, client);
    await flush();
    expect(channels).toHaveLength(1);
    expect(channels[0]).toMatchObject({ topic: displaySignalTopic('t-1'), params: { config: { private: false } } });
    expect(displaySignalTopic('t-1')).toBe('display:t-1');
    channels[0].broadcast?.();
    expect(onSignal).toHaveBeenCalledTimes(1);
    off();
  });

  it('nach dem (Wieder-)Beitritt einmal melden (Änderungen während der Trennung)', async () => {
    const { client, channels } = fakeClient();
    const onSignal = vi.fn();
    const off = subscribeDisplaySignal('t-2', onSignal, client);
    await flush();
    channels[0].status?.('SUBSCRIBED');
    expect(onSignal).toHaveBeenCalledTimes(1);
    channels[0].status?.('CHANNEL_ERROR');
    expect(onSignal).toHaveBeenCalledTimes(1);
    off();
  });

  it('zwei Zuhörer, ein Kanal; erst der letzte meldet ab', async () => {
    const { client, channels } = fakeClient();
    const a = vi.fn(); const b = vi.fn();
    const offA = subscribeDisplaySignal('t-3', a, client);
    const offB = subscribeDisplaySignal('t-3', b, client);
    await flush();
    expect(channels).toHaveLength(1);
    channels[0].broadcast?.();
    expect([a.mock.calls.length, b.mock.calls.length]).toEqual([1, 1]);
    offA();
    expect(client.removeChannel).not.toHaveBeenCalled();
    offB();
    expect(client.removeChannel).toHaveBeenCalledTimes(1);
  });

  it('An-Ab-An (StrictMode) baut genau einen Kanal', async () => {
    const { client, channels } = fakeClient();
    const off = subscribeDisplaySignal('t-4', vi.fn(), client);
    off();
    const off2 = subscribeDisplaySignal('t-4', vi.fn(), client);
    await flush();
    expect(channels).toHaveLength(1);
    off2();
  });

  it('neuer Beitritt wartet, bis der alte Kanal entfernt ist', async () => {
    const { client, channels, release } = fakeClient();
    const off = subscribeDisplaySignal('t-5', vi.fn(), client);
    await flush();
    off();
    const onSignal = vi.fn();
    const off2 = subscribeDisplaySignal('t-5', onSignal, client);
    await flush();
    expect(channels).toHaveLength(1);
    release();
    await flush();
    expect(channels).toHaveLength(2);
    channels[1].broadcast?.();
    expect(onSignal).toHaveBeenCalledTimes(1);
    off2();
  });

  it('ohne Supabase (Offline-Build) passiert nichts', () => {
    const off = subscribeDisplaySignal('t-6', vi.fn(), null);
    expect(off).toBeTypeOf('function');
    off();
  });

  it('Kanal-Aufbau wirft -> kein Absturz (Rückfall-Takt bleibt)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const client: DisplaySignalClient = {
      channel: () => { throw new Error('kein Realtime'); },
      removeChannel: vi.fn(() => Promise.resolve('ok')),
    };
    const off = subscribeDisplaySignal('t-7', vi.fn(), client);
    await flush();
    expect(warn).toHaveBeenCalled();
    off();
    warn.mockRestore();
  });
});
