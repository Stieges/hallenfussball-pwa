/**
 * MatchEngineProvider (C3a-1, Teil 1.2): Auth-Ereignisse und Kontowechsel.
 * Echte MatchEngine/OutboxSender/LocalMatchStore (fake-indexeddb), nur `useAuth`/
 * `useRepositories` sind gemockt.
 */
import 'fake-indexeddb/auto';
import { StrictMode, useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { MatchEngine, ClockSync } from '../../../core/match/client';
import { OutboxSender } from '../../../core/match/client';

const mockAuth: { user: { id: string; globalRole: string } | null; session: { token: string } | null } = {
  user: { id: 'user-1', globalRole: 'organizer' },
  session: { token: 'token-1' },
};
vi.mock('../../auth/hooks/useAuth', () => ({ useAuth: () => mockAuth }));

const mockRepositories: { supabaseLiveMatchRepo: unknown; tournamentRepository: unknown } = { supabaseLiveMatchRepo: null, tournamentRepository: {} };
vi.mock('../../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => mockRepositories,
}));

vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
import { captureFeatureError } from '../../../lib/sentry';
import { MatchEngineProvider } from '../MatchEngineProvider';
import { useMatchEngineContext } from '../useMatchEngineContext';
import { useResyncNow } from '../useResyncNow';

function Probe({ onReady }: { onReady: (ctx: ReturnType<typeof useMatchEngineContext>) => void }) {
  const ctx = useMatchEngineContext();
  onReady(ctx);
  return null;
}

/** Wartet, bis der zuletzt aufgezeichnete Aufruf des Spys TATSAECHLICH aufgeloest ist
 * (nicht nur aufgerufen wurde) -- vermeidet ein wackliges festes Timeout. */
async function settleLastCall(spy: { mock: { results: { value: unknown }[] } }): Promise<void> {
  const last = spy.mock.results.at(-1);
  if (last) {
    await last.value;
  }
}

describe('MatchEngineProvider', () => {
  beforeEach(() => {
    mockAuth.user = { id: 'user-1', globalRole: 'organizer' };
    mockAuth.session = { token: 'token-1' };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('startet die MatchEngine mit dem abgeleiteten Konto beim ersten Rendern', async () => {
    const startSpy = vi.spyOn(MatchEngine.prototype, 'start');
    render(
      <MatchEngineProvider>
        <Probe onReady={() => undefined} />
      </MatchEngineProvider>,
    );

    await waitFor(() => expect(startSpy).toHaveBeenCalledWith('user-1'));
  });

  it('Kontowechsel: stop() des alten, start() des neuen Kontos', async () => {
    const startSpy = vi.spyOn(MatchEngine.prototype, 'start');
    const stopSpy = vi.spyOn(MatchEngine.prototype, 'stop');
    const { rerender } = render(
      <MatchEngineProvider>
        <Probe onReady={() => undefined} />
      </MatchEngineProvider>,
    );
    await waitFor(() => expect(startSpy).toHaveBeenCalledWith('user-1'));
    await settleLastCall(startSpy);

    mockAuth.user = { id: 'user-2', globalRole: 'organizer' };
    rerender(
      <MatchEngineProvider>
        <Probe onReady={() => undefined} />
      </MatchEngineProvider>,
    );

    await waitFor(() => expect(stopSpy).toHaveBeenCalled());
    await waitFor(() => expect(startSpy).toHaveBeenCalledWith('user-2'));
  });

  it('m4: ein schneller Kontowechsel ruft stop() fuer das ALTE Konto zuverlaessig auf, auch wenn dessen start() noch nicht aufgeloest hat', async () => {
    // Ruft die ECHTE Implementierung durch (setzt `accountId` also sofort, synchron, wie im
    // echten Code) -- nur das AEUSSERE Promise des ERSTEN Aufrufs bleibt kontrolliert haengen,
    // damit der Effekt fuer 'user-2' garantiert VOR dessen Aufloesung feuert.
    const originalStart = MatchEngine.prototype.start;
    const resolveFirstStartRef: { current: (() => void) | null } = { current: null };
    let firstCallSeen = false;
    const startSpy = vi.spyOn(MatchEngine.prototype, 'start').mockImplementation(function (
      this: MatchEngine,
      accountId: string,
    ) {
      const real = originalStart.call(this, accountId);
      if (firstCallSeen) {
        return real;
      }
      firstCallSeen = true;
      return new Promise<void>((resolve) => {
        resolveFirstStartRef.current = () => { void real.then(resolve); };
      });
    });
    const stopSpy = vi.spyOn(MatchEngine.prototype, 'stop');
    const { rerender } = render(
      <MatchEngineProvider>
        <Probe onReady={() => undefined} />
      </MatchEngineProvider>,
    );
    await waitFor(() => expect(startSpy).toHaveBeenCalledWith('user-1'));
    expect(stopSpy).not.toHaveBeenCalled();

    // Kontowechsel WAEHREND start('user-1') noch haengt (kein settleLastCall hier).
    mockAuth.user = { id: 'user-2', globalRole: 'organizer' };
    rerender(
      <MatchEngineProvider>
        <Probe onReady={() => undefined} />
      </MatchEngineProvider>,
    );

    // stop() muss SOFORT (synchron im Effekt) erkennen, dass 'user-1' der Vorgaenger war --
    // unabhaengig davon, ob dessen start()-Promise schon aufgeloest hat.
    await waitFor(() => expect(stopSpy).toHaveBeenCalled());
    await waitFor(() => expect(startSpy).toHaveBeenCalledWith('user-2'));
    resolveFirstStartRef.current?.();
    startSpy.mockRestore();
  });

  it('SIGNED_OUT (kein User mehr) loescht nichts, faehrt als Gast weiter', async () => {
    const startSpy = vi.spyOn(MatchEngine.prototype, 'start');
    const stopSpy = vi.spyOn(MatchEngine.prototype, 'stop');
    const { rerender } = render(
      <MatchEngineProvider>
        <Probe onReady={() => undefined} />
      </MatchEngineProvider>,
    );
    await waitFor(() => expect(startSpy).toHaveBeenCalledWith('user-1'));
    await settleLastCall(startSpy);
    expect(stopSpy).not.toHaveBeenCalled();

    mockAuth.user = null;
    mockAuth.session = null;
    rerender(
      <MatchEngineProvider>
        <Probe onReady={() => undefined} />
      </MatchEngineProvider>,
    );

    // stop() wird aufgerufen (Kontowechsel auf 'guest'), aber KEIN Store-Aufruf loescht Daten --
    // das ist durch MatchEngine.stop() (siehe MatchEngine.test.ts) bereits erhaerte.
    await waitFor(() => expect(stopSpy).toHaveBeenCalled());
  });

  it('gleiches Konto, neue Session (TOKEN_REFRESHED) -> sender.resumeAuth()', async () => {
    const resumeAuthSpy = vi.spyOn(OutboxSender.prototype, 'resumeAuth');
    const startSpy = vi.spyOn(MatchEngine.prototype, 'start');
    const { rerender } = render(
      <MatchEngineProvider>
        <Probe onReady={() => undefined} />
      </MatchEngineProvider>,
    );
    await waitFor(() => expect(startSpy).toHaveBeenCalledWith('user-1'));
    await settleLastCall(startSpy);

    mockAuth.session = { token: 'token-2' };
    rerender(
      <MatchEngineProvider>
        <Probe onReady={() => undefined} />
      </MatchEngineProvider>,
    );

    await waitFor(() => expect(resumeAuthSpy).toHaveBeenCalled());
    expect(startSpy).toHaveBeenCalledTimes(1); // kein weiterer Kontowechsel ausgeloest
  });

  it('W9: misst die Uhr SOFORT beim Start (nicht erst nach 60s)', async () => {
    const syncSpy = vi.spyOn(ClockSync.prototype, 'sync');
    render(
      <MatchEngineProvider>
        <Probe onReady={() => undefined} />
      </MatchEngineProvider>,
    );
    await waitFor(() => expect(syncSpy).toHaveBeenCalled());
  });

  it('I4: "online" misst neu, stoesst den Ausgang an UND laedt geladene Engine-Spiele nach', async () => {
    const syncSpy = vi.spyOn(ClockSync.prototype, 'sync');
    const kickSpy = vi.spyOn(OutboxSender.prototype, 'kick');
    const catchUpLoadedSpy = vi.spyOn(MatchEngine.prototype, 'catchUpLoaded').mockResolvedValue(undefined);
    render(
      <MatchEngineProvider>
        <Probe onReady={() => undefined} />
      </MatchEngineProvider>,
    );
    await waitFor(() => expect(syncSpy).toHaveBeenCalled());
    syncSpy.mockClear();
    kickSpy.mockClear();
    catchUpLoadedSpy.mockClear();

    window.dispatchEvent(new Event('online'));

    await waitFor(() => expect(syncSpy).toHaveBeenCalled());
    await waitFor(() => expect(kickSpy).toHaveBeenCalled());
    await waitFor(() => expect(catchUpLoadedSpy).toHaveBeenCalled());
  });

  it('I7/SIGNED_OUT: die IndexedDB-Kopie des alten Kontos bleibt nach dem Wechsel auf Gast erhalten', async () => {
    const startSpy = vi.spyOn(MatchEngine.prototype, 'start');
    let ctx: ReturnType<typeof useMatchEngineContext> | null = null;
    const { rerender } = render(
      <MatchEngineProvider>
        <Probe onReady={(value) => { ctx = value; }} />
      </MatchEngineProvider>,
    );
    await waitFor(() => expect(startSpy).toHaveBeenCalledWith('user-1'));
    await settleLastCall(startSpy);
    expect(ctx).not.toBeNull();
    await ctx!.engine.ensureMatch('m-signed-out', { matchId: 'm-signed-out', teamAId: 'teama', teamBId: 'teamb' });
    expect(await ctx!.store.load('user-1', 'm-signed-out')).not.toBeNull();

    mockAuth.user = null;
    mockAuth.session = null;
    rerender(
      <MatchEngineProvider>
        <Probe onReady={(value) => { ctx = value; }} />
      </MatchEngineProvider>,
    );
    await waitFor(() => expect(startSpy).toHaveBeenCalledWith('guest'));

    // Die Kopie des ALTEN Kontos ('user-1') ist weiterhin in der IndexedDB vorhanden -- `stop()`
    // loescht nichts, nur der Sender-Speicher (Warteschlangen im RAM) wechselt.
    expect(await ctx!.store.load('user-1', 'm-signed-out')).not.toBeNull();
  });

  it('m3: der Kontowechsel liefert ein NEUES Kontext-Objekt mit dem neuen accountId (Kopien-Cache-Hooks bauen neu auf)', async () => {
    const startSpy = vi.spyOn(MatchEngine.prototype, 'start');
    const contexts: NonNullable<ReturnType<typeof useMatchEngineContext>>[] = [];
    const { rerender } = render(
      <MatchEngineProvider>
        <Probe onReady={(value) => value && contexts.push(value)} />
      </MatchEngineProvider>,
    );
    await waitFor(() => expect(startSpy).toHaveBeenCalledWith('user-1'));
    const firstContext = contexts.at(-1)!;
    expect(firstContext.accountId).toBe('user-1');

    mockAuth.user = { id: 'user-2', globalRole: 'organizer' };
    mockAuth.session = { token: 'token-2' };
    rerender(
      <MatchEngineProvider>
        <Probe onReady={(value) => value && contexts.push(value)} />
      </MatchEngineProvider>,
    );
    await waitFor(() => expect(startSpy).toHaveBeenCalledWith('user-2'));
    const secondContext = contexts.at(-1)!;

    expect(secondContext.accountId).toBe('user-2');
    expect(secondContext).not.toBe(firstContext);
    // `bundle` (Engine/Sender/Store/Uhr) bleibt dieselbe Instanz -- nur das Kontext-Objekt selbst
    // ist neu (accountId geaendert).
    expect(secondContext.engine).toBe(firstContext.engine);
  });

  it('N2-m4: StrictMode-Doppellauf DESSELBEN Kontos ruft start() nur EINMAL auf (previousAccountRef ist bereits nach dem ersten Durchlauf gesetzt)', async () => {
    const startSpy = vi.spyOn(MatchEngine.prototype, 'start');
    render(
      <StrictMode>
        <MatchEngineProvider>
          <Probe onReady={() => undefined} />
        </MatchEngineProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(startSpy).toHaveBeenCalledWith('user-1'));
    await settleLastCall(startSpy);

    // `previousAccountRef.current` wird SYNCHRON im ersten Effekt-Durchlauf gesetzt -- der zweite
    // (StrictMode-)Durchlauf sieht `previousTarget === accountId` und kehrt vor dem `start()`-Aufruf
    // zurueck. `start()` laeuft deshalb nur EINMAL, nicht zweimal (der bisherige Kommentar an dieser
    // Stelle behauptete das Gegenteil).
    expect(startSpy).toHaveBeenCalledTimes(1);
  });
});

/** A-06g: Sichtbarkeit (`resyncNow`) und Wiederaufnahme nach Anmeldung (`resumeAfterAuth`). */
function fakeQueue(resume: () => Promise<void> = () => Promise.resolve()) {
  return { processIfDue: vi.fn(() => Promise.resolve()), resumeAfterAuth: vi.fn(resume) };
}

/** Laesst den Mount (Engine-Start, Anmelde-Wiederaufnahme per setTimeout 0) vollstaendig ablaufen. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  });
}

/** Fake-Timer weiterdrehen OHNE `act` (act nutzt selbst setTimeout und wuerde dann haengen). */
async function flushFakeTimers(): Promise<void> {
  vi.advanceTimersByTime(0);
  await Promise.resolve();
  await Promise.resolve();
}

function setVisibility(value: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value });
}

function Tree({ onReady }: { onReady?: (ctx: ReturnType<typeof useMatchEngineContext>) => void }) {
  return (
    <MatchEngineProvider>
      <Probe onReady={onReady ?? (() => undefined)} />
    </MatchEngineProvider>
  );
}

describe('MatchEngineProvider: resyncNow und Wiederaufnahme (A-06g)', () => {
  let queue: ReturnType<typeof fakeQueue>;

  beforeEach(() => {
    mockAuth.user = { id: 'user-1', globalRole: 'organizer' };
    mockAuth.session = { token: 'token-1' };
    queue = fakeQueue();
    mockRepositories.tournamentRepository = { mutationQueue: queue };
    vi.mocked(captureFeatureError).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, 'visibilityState');
    mockRepositories.tournamentRepository = {};
  });

  it('V1: sichtbar + visibilitychange -> kick und processIfDue je 1x', async () => {
    const { unmount } = render(<Tree />);
    await settle();
    const kickSpy = vi.spyOn(OutboxSender.prototype, 'kick');
    queue.processIfDue.mockClear();
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(kickSpy).toHaveBeenCalledTimes(1));
    expect(queue.processIfDue).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('V2 Gegenbeispiel: hidden -> nichts', async () => {
    const { unmount } = render(<Tree />);
    await settle();
    const kickSpy = vi.spyOn(OutboxSender.prototype, 'kick');
    queue.processIfDue.mockClear();
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await act(async () => { await Promise.resolve(); });
    expect(kickSpy).not.toHaveBeenCalled();
    expect(queue.processIfDue).not.toHaveBeenCalled();
    unmount();
  });

  it('V3 Gegenbeispiel: Gast -> nichts', async () => {
    mockAuth.user = { id: 'user-1', globalRole: 'guest' };
    const { unmount } = render(<Tree />);
    await settle();
    const kickSpy = vi.spyOn(OutboxSender.prototype, 'kick');
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await act(async () => { await Promise.resolve(); });
    expect(kickSpy).not.toHaveBeenCalled();
    expect(queue.processIfDue).not.toHaveBeenCalled();
    unmount();
  });

  it('V4 Gegenbeispiel: nach Unmount -> nichts', async () => {
    const { unmount } = render(<Tree />);
    await settle();
    unmount();
    queue.processIfDue.mockClear();
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await act(async () => { await Promise.resolve(); });
    expect(queue.processIfDue).not.toHaveBeenCalled();
  });

  it('V5: ohne Provider loest useResyncNow() auf, ohne Wurf', async () => {
    const seen: Array<() => Promise<void>> = [];
    function Bare({ onReady }: { onReady: (fn: () => Promise<void>) => void }) {
      const resync = useResyncNow();
      useEffect(() => {
        onReady(resync);
      }, [resync, onReady]);
      return null;
    }
    render(<Bare onReady={(fn) => { seen.push(fn); }} />);
    expect(seen).toHaveLength(1);
    await expect(seen[0]()).resolves.toBeUndefined();
  });

  it('R1: neues Session-Token -> resumeAuth UND resumeAfterAuth je 1x (nach dem Timer)', async () => {
    const { rerender } = render(<Tree />);
    await settle();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    queue.resumeAfterAuth.mockClear();
    const resumeAuthSpy = vi.spyOn(OutboxSender.prototype, 'resumeAuth');
    mockAuth.session = { token: 'token-2' };
    rerender(<Tree />);
    expect(resumeAuthSpy).toHaveBeenCalledTimes(1);
    await flushFakeTimers();
    expect(queue.resumeAfterAuth).toHaveBeenCalledTimes(1);
  });

  it('R2: Abmelden -> resumeAuth 0x und resumeAfterAuth 0x', async () => {
    const { rerender } = render(<Tree />);
    await settle();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    queue.resumeAfterAuth.mockClear();
    const resumeAuthSpy = vi.spyOn(OutboxSender.prototype, 'resumeAuth');
    mockAuth.session = null;
    rerender(<Tree />);
    await flushFakeTimers();
    expect(resumeAuthSpy).not.toHaveBeenCalled();
    expect(queue.resumeAfterAuth).not.toHaveBeenCalled();
  });

  it('RACE 1: haengendes resumeAfterAuth blockiert ein zweites Anmelde-Ereignis nicht', async () => {
    queue = fakeQueue(() => new Promise<void>(() => undefined));
    mockRepositories.tournamentRepository = { mutationQueue: queue };
    const { rerender } = render(<Tree />);
    await settle();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    queue.resumeAfterAuth.mockClear();
    mockAuth.session = { token: 'token-2' };
    rerender(<Tree />);
    await flushFakeTimers();
    mockAuth.session = { token: 'token-3' };
    rerender(<Tree />);
    await flushFakeTimers();
    expect(queue.resumeAfterAuth).toHaveBeenCalledTimes(2);
  });

  it('RACE 2: Unmount vor dem Timer -> resumeAfterAuth wird nicht mehr aufgerufen', async () => {
    const { rerender, unmount } = render(<Tree />);
    await settle();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    queue.resumeAfterAuth.mockClear();
    mockAuth.session = { token: 'token-2' };
    rerender(<Tree />);
    unmount();
    await flushFakeTimers();
    expect(queue.resumeAfterAuth).not.toHaveBeenCalled();
  });

  it('RACE 3: resumeAfterAuth lehnt ab -> Fehler gemeldet, keine unbehandelte Ablehnung', async () => {
    queue = fakeQueue(() => Promise.reject(new Error('Anmeldung abgelaufen')));
    mockRepositories.tournamentRepository = { mutationQueue: queue };
    const { rerender } = render(<Tree />);
    await settle();
    vi.mocked(captureFeatureError).mockClear();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    mockAuth.session = { token: 'token-2' };
    rerender(<Tree />);
    await flushFakeTimers();
    await act(async () => { await Promise.resolve(); });
    expect(captureFeatureError).toHaveBeenCalledTimes(1);
  });
});
