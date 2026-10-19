/**
 * RealtimeService – Neuabo nach Netzwechsel (@FU-102)
 *
 * Abgeleitet aus dem Szenario, nicht aus dem Code. Der Mock bildet das
 * geprüfte Verhalten von realtime-js 2.117.3 nach:
 *  - client.channel(topic) liefert einen vorhandenen Kanal gleichen Themas zurück,
 *    solange er nicht abgebaut ist (RealtimeClient.channel).
 *  - channel.on('postgres_changes') nach subscribe() wirft (RealtimeChannel.on).
 *  - removeChannel ist asynchron; erst nach dem Abbau wird der Kanal ENTFERNT, und
 *    zwar über das Thema (RealtimeClient._remove) -- ein später fertiger Abbau
 *    entfernt damit auch einen neueren Kanal gleichen Themas (stiller toter Kanal).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

interface FakeChannel {
  topic: string;
  subscribed: boolean;
  removed: boolean;
  handlers: Array<{ table: string; cb: (payload: unknown) => void }>;
  on: (type: string, filter: { table?: string }, cb: (payload: unknown) => void) => FakeChannel;
  subscribe: (cb: (status: string) => void) => FakeChannel;
}

const hoisted = vi.hoisted(() => {
  const state = {
    list: [] as FakeChannel[],
    created: [] as FakeChannel[],
    pending: [] as Array<() => void>,
    deferRemoval: false,
    events: [] as string[],
    onThrows: 0,
  };

  const client = {
    channel: vi.fn((name: string): FakeChannel => {
      const topic = `realtime:${name}`;
      const existing = state.list.find((c) => c.topic === topic);
      if (existing) { return existing; }
      const ch: FakeChannel = {
        topic,
        subscribed: false,
        removed: false,
        handlers: [],
        on(type, filter, cb) {
          if (ch.subscribed && type === 'postgres_changes') {
            state.onThrows += 1;
            throw new Error(`cannot add \`${type}\` callbacks for ${topic} after \`subscribe()\`.`);
          }
          if (type === 'postgres_changes') { ch.handlers.push({ table: filter.table ?? '', cb }); }
          return ch;
        },
        subscribe(cb) {
          ch.subscribed = true;
          cb('SUBSCRIBED');
          return ch;
        },
      };
      state.list.push(ch);
      state.created.push(ch);
      state.events.push('create');
      return ch;
    }),
    removeChannel: vi.fn((ch: FakeChannel): Promise<string> => {
      state.events.push('remove');
      const finish = (): string => {
        ch.removed = true;
        state.list = state.list.filter((c) => c.topic !== ch.topic);
        return 'ok';
      };
      if (!state.deferRemoval) { return Promise.resolve(finish()); }
      return new Promise((resolve) => {
        state.pending.push(() => resolve(finish()));
      });
    }),
  };

  return { state, client };
});

const { state, client } = hoisted;

vi.mock('../../../lib/supabase', () => ({
  supabase: hoisted.client,
  isSupabaseConfigured: true,
}));

import { RealtimeService } from '../RealtimeService';

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

async function releaseRemovals(): Promise<void> {
  while (state.pending.length > 0) {
    state.pending.shift()?.();
    await flush();
  }
  await flush();
}

function live(topic: string): FakeChannel[] {
  return state.list.filter((c) => c.topic === `realtime:${topic}` && !c.removed);
}

function goOnline(): void {
  window.dispatchEvent(new Event('online'));
}

function setHidden(hidden: boolean): void {
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(hidden);
  document.dispatchEvent(new Event('visibilitychange'));
}

let uncaught: unknown[] = [];
const onError = (e: ErrorEvent): void => { uncaught.push(e.error ?? e.message); };
const onRejection = (e: PromiseRejectionEvent): void => { uncaught.push(e.reason); };

describe('RealtimeService – Neuabo (@FU-102)', () => {
  let service: RealtimeService;

  beforeEach(() => {
    state.list = [];
    state.created = [];
    state.pending = [];
    state.events = [];
    state.onThrows = 0;
    state.deferRemoval = false;
    client.channel.mockClear();
    client.removeChannel.mockClear();
    uncaught = [];
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    service = new RealtimeService();
  });

  afterEach(() => {
    // @FU-102: nie darf `.on()` auf einem schon abonnierten Kanal landen (= der Sentry-Wurf)
    expect(state.onThrows).toBe(0);
    service.destroy();
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    vi.restoreAllMocks();
  });

  it('@FU-102 Netzrückkehr baut den alten Kanal ab, bevor ein neuer angelegt wird; danach genau ein Kanal', async () => {
    service.subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn() });
    state.events = [];

    goOnline();
    await flush();

    expect(state.events).toEqual(['remove', 'create']);
    expect(live('tournament-t1')).toHaveLength(1);
    expect(live('tournament-t1')[0].subscribed).toBe(true);
    expect(uncaught).toEqual([]);
  });

  it('@FU-102 Abbau noch nicht fertig, Netz kommt zurück: kein Wurf, neuer Kanal erst nach dem Abbau', async () => {
    service.subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn() });
    state.deferRemoval = true;

    expect(() => goOnline()).not.toThrow();
    await flush();
    expect(uncaught).toEqual([]);
    expect(state.created).toHaveLength(1); // noch kein zweiter Kanal

    await releaseRemovals();

    expect(live('tournament-t1')).toHaveLength(1);
    expect(live('tournament-t1')[0]).toBe(state.created[state.created.length - 1]);
    expect(live('tournament-t1')[0].subscribed).toBe(true);
    expect(uncaught).toEqual([]);
  });

  it('@FU-102 mehrfach schnell Vorder-/Hintergrund und online: am Ende genau ein lebender Kanal, keiner tot', async () => {
    service.subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn() });
    state.deferRemoval = true;

    for (let i = 0; i < 3; i++) {
      setHidden(true);
      setHidden(false);
      goOnline();
    }
    goOnline();
    await flush();
    await releaseRemovals();

    expect(uncaught).toEqual([]);
    expect(live('tournament-t1')).toHaveLength(1);
    expect(live('tournament-t1')[0].subscribed).toBe(true);
    // jeder erzeugte Kanal ausser dem letzten wurde abgebaut
    const notRemoved = state.created.filter((c) => !c.removed);
    expect(notRemoved).toHaveLength(1);
  });

  it('@FU-102 Wettlauf mit sofort fertigem Abbau: mehrfach online hintereinander ergibt genau einen Kanal', async () => {
    service.subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn() });
    goOnline();
    goOnline();
    goOnline();
    await flush();
    await releaseRemovals();

    expect(uncaught).toEqual([]);
    expect(live('tournament-t1')).toHaveLength(1);
  });

  it('@FU-102 eine Änderung nach der Rückkehr erreicht den Abonnenten', async () => {
    const onMatchChange = vi.fn();
    service.subscribeTournament({ tournamentId: 't1', onMatchChange });
    state.deferRemoval = true;
    setHidden(true);
    setHidden(false);
    goOnline();
    await releaseRemovals();

    const channel = live('tournament-t1')[0];
    const handler = channel.handlers.find((h) => h.table === 'matches');
    expect(handler).toBeDefined();
    handler?.cb({ eventType: 'UPDATE', new: { id: 'm12' }, old: {} });

    expect(onMatchChange).toHaveBeenCalledTimes(1);
    expect(onMatchChange.mock.calls[0][0]).toMatchObject({ table: 'matches', eventType: 'UPDATE' });
  });

  it('@FU-102 Gegenbeispiel: Abmelden baut ab und legt auch bei späterem online keinen neuen Kanal an', async () => {
    service.subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn() });
    state.deferRemoval = true;

    service.unsubscribeTournament('t1');
    goOnline();
    await releaseRemovals();

    expect(live('tournament-t1')).toHaveLength(0);
    expect(state.created).toHaveLength(1);
    expect(service.isSubscribed('t1')).toBe(false);
  });

  it('@FU-102 Gegenbeispiel: Abmelden während ausstehendem Neuabo (Abbau läuft noch) legt keinen Kanal an', async () => {
    service.subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn() });
    state.deferRemoval = true;

    setHidden(true);
    setHidden(false); // Neuabo wartet auf den Abbau
    service.unsubscribeTournament('t1');
    await releaseRemovals();

    expect(live('tournament-t1')).toHaveLength(0);
    expect(state.created).toHaveLength(1);
  });

  it('@FU-102 Gegenbeispiel: Tab bleibt im Hintergrund -- nach dem Abbau entsteht kein Kanal', async () => {
    service.subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn() });
    state.deferRemoval = true;

    setHidden(true);
    await releaseRemovals();

    expect(live('tournament-t1')).toHaveLength(0);
    expect(state.created).toHaveLength(1);
  });

  it('@FU-102 destroy() während wartendem Neuabo: nach dem Abbau entsteht kein Kanal, nichts bleibt abonniert', async () => {
    service.subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn() });
    state.deferRemoval = true;

    goOnline(); // Neuabo wartet auf den Abbau
    service.destroy();
    await releaseRemovals();

    expect(live('tournament-t1')).toHaveLength(0);
    expect(state.created).toHaveLength(1);
    expect(service.getState().subscribedTournaments.size).toBe(0);
  });

  it('@FU-102 unsubscribeAll() während wartendem Neuabo: kein neuer Kanal', async () => {
    service.subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn() });
    service.subscribeTournament({ tournamentId: 't2', onMatchChange: vi.fn() });
    state.deferRemoval = true;

    goOnline();
    service.unsubscribeAll();
    await releaseRemovals();

    expect(state.list.filter((c) => !c.removed)).toHaveLength(0);
    expect(state.created).toHaveLength(2);
    expect(service.getState().subscribedTournaments.size).toBe(0);
  });

  it('@FU-102 unsubscribeAll()/destroy() während einer Pause: danach legt resume() keinen Kanal an', async () => {
    service.subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn() });
    service.pause();
    await flush();

    service.unsubscribeAll();
    service.resume();
    await releaseRemovals();

    expect(live('tournament-t1')).toHaveLength(0);
    expect(state.created).toHaveLength(1);
    expect(service.getState().subscribedTournaments.size).toBe(0);
  });

  it('@FU-025 verzögerte Neuanlage wirft: onError und Status error statt stiller Ablehnung (Abfrage-Ausweg)', async () => {
    const onErrorCb = vi.fn();
    const onStatusChange = vi.fn();
    service.subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn(), onError: onErrorCb, onStatusChange });
    state.deferRemoval = true;

    const original = client.channel.getMockImplementation();
    client.channel.mockImplementation((name: string) => {
      if (!original) { throw new Error('mock fehlt'); }
      const ch = original(name);
      ch.on = () => { throw new Error('on wirft'); };
      return ch;
    });
    const rejections: unknown[] = [];
    const onRej = (reason: unknown): void => { rejections.push(reason); };
    process.on('unhandledRejection', onRej);

    goOnline();
    await releaseRemovals();
    await flush();
    process.off('unhandledRejection', onRej);

    expect(rejections).toEqual([]);
    expect(onErrorCb).toHaveBeenCalledTimes(1);
    expect(onErrorCb.mock.calls[0][0].message).toContain('on wirft');
    expect(service.getState().status).toBe('error');
    expect(onStatusChange).toHaveBeenLastCalledWith('error');
    if (original) { client.channel.mockImplementation(original); }
  });

  it('@FU-025 Gegenbeispiel: Kanal-Fehler nach dem Neuabo führt weiter zu onError (Abfrage-Ausweg)', async () => {
    const onError2 = vi.fn();
    const onStatusChange = vi.fn();
    service.subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn(), onError: onError2, onStatusChange });

    const statusCbs: Array<(status: string) => void> = [];
    const original = client.channel.getMockImplementation();
    client.channel.mockImplementation((name: string) => {
      if (!original) { throw new Error('mock fehlt'); }
      const ch = original(name);
      const sub = ch.subscribe;
      ch.subscribe = (cb) => { statusCbs.push(cb); return sub(cb); };
      return ch;
    });

    goOnline();
    await flush();
    expect(statusCbs).toHaveLength(1);
    statusCbs[0]('CHANNEL_ERROR');

    expect(onError2).toHaveBeenCalledTimes(1);
    expect(service.getState().status).toBe('error');
    expect(onStatusChange).toHaveBeenLastCalledWith('error');
  });
});
