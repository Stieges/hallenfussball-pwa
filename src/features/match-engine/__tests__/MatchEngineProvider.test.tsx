/**
 * MatchEngineProvider (C3a-1, Teil 1.2): Auth-Ereignisse und Kontowechsel.
 * Echte MatchEngine/OutboxSender/LocalMatchStore (fake-indexeddb), nur `useAuth`/
 * `useRepositories` sind gemockt.
 */
import 'fake-indexeddb/auto';
import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MatchEngine, ClockSync } from '../../../core/match/client';
import { OutboxSender } from '../../../core/match/client';

const mockAuth: { user: { id: string; globalRole: string } | null; session: { token: string } | null } = {
  user: { id: 'user-1', globalRole: 'organizer' },
  session: { token: 'token-1' },
};
vi.mock('../../auth/hooks/useAuth', () => ({ useAuth: () => mockAuth }));

const mockRepositories = { supabaseLiveMatchRepo: null as unknown };
vi.mock('../../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => mockRepositories,
}));

import { MatchEngineProvider } from '../MatchEngineProvider';
import { useMatchEngineContext } from '../useMatchEngineContext';

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
