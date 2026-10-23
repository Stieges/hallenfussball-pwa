/**
 * C-LIVE-KANAL-LEAVING-WIEDERVERWENDUNG (@FU-129, Bezug @FU-025): Kommt Olli in die App zurück, tritt das
 * Repository dem Live-Kanal frisch bei.
 *
 * supabase-js baut einen Kanal asynchron ab (`removeChannel` wartet auf den Server) und gibt unter
 * demselben Namen bis dahin den noch „leaving“ Kanal zurück; `.on()` darauf wirft. Der Fake unten verhält
 * sich so wie `RealtimeClient.channel()` aus realtime-js (gleicher Name -> gleicher Kanal, bis er
 * abgebaut ist; `.on()` nach dem Beitritt wirft).
 *
 * Gegenbeispiel: das erste Beitreten (nichts zum Abbauen) läuft wie bisher.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  type State = 'closed' | 'joined' | 'leaving';
  class FakeChannel {
    state: State = 'closed';
    constructor(public topic: string) {}
    on(): this {
      if (this.state !== 'closed') {
        throw new Error(`cannot add postgres_changes callbacks for ${this.topic} after subscribe()`);
      }
      return this;
    }
    subscribe(callback?: (status: string) => void): this {
      this.state = 'joined';
      callback?.('SUBSCRIBED');
      return this;
    }
  }
  const channels: FakeChannel[] = [];
  const supabaseMock = {
    channel: vi.fn((name: string) => {
      const topic = `realtime:${name}`;
      const existing = channels.find((c) => c.topic === topic);
      if (existing) {
        return existing;
      }
      const created = new FakeChannel(topic);
      channels.push(created);
      return created;
    }),
    removeChannel: vi.fn((channel: FakeChannel) => {
      channel.state = 'leaving';
      return new Promise<string>((resolve) => {
        setTimeout(() => {
          channels.splice(channels.indexOf(channel), 1);
          channel.state = 'closed';
          resolve('ok');
        }, 0);
      });
    }),
  };
  return { supabaseMock, channels };
});

vi.mock('../../../lib/supabase', () => ({
  supabase: hoisted.supabaseMock,
  isSupabaseConfigured: true,
}));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));

import { SupabaseLiveMatchRepository } from '../SupabaseLiveMatchRepository';

describe('C-LIVE-KANAL-LEAVING-WIEDERVERWENDUNG: frisches Beitreten nach Rückkehr (@FU-129)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    hoisted.channels.length = 0;
    hoisted.supabaseMock.channel.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('@FU-129 Rückkehr, solange der alte Kanal noch abgebaut wird: das Beitreten klappt und meldet SUBSCRIBED', () => {
    const repo = new SupabaseLiveMatchRepository();
    const first = vi.fn();
    const second = vi.fn();

    repo.subscribe('t1', { onStatusChange: first });
    expect(() => repo.subscribe('t1', { onStatusChange: second })).not.toThrow();

    expect(first).toHaveBeenCalledWith('SUBSCRIBED');
    expect(second).toHaveBeenCalledWith('SUBSCRIBED');
    const joined = hoisted.channels.filter((c) => c.state === 'joined');
    expect(joined).toHaveLength(1);
    expect(hoisted.channels.some((c) => c.state === 'leaving')).toBe(true);
  });

  it('@FU-129 nach dem Abbau tritt auch ein späteres Beitreten frisch bei, der alte Kanal bleibt nicht übrig', async () => {
    const repo = new SupabaseLiveMatchRepository();
    repo.subscribe('t1', {});
    repo.unsubscribe('t1');
    await vi.runAllTimersAsync();
    const status = vi.fn();

    repo.subscribe('t1', { onStatusChange: status });

    expect(status).toHaveBeenCalledWith('SUBSCRIBED');
    expect(hoisted.channels.filter((c) => c.state === 'joined')).toHaveLength(1);
  });

  it('Gegenbeispiel: das erste Beitreten (nichts abzubauen) meldet SUBSCRIBED', () => {
    const repo = new SupabaseLiveMatchRepository();
    const status = vi.fn();

    repo.subscribe('t1', { onStatusChange: status });

    expect(status).toHaveBeenCalledWith('SUBSCRIBED');
  });
});
