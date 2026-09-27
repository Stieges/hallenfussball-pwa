/**
 * MatchEngineProvider (C3a-1, Teil 1.2): Auth-Ereignisse und Kontowechsel.
 * Echte MatchEngine/OutboxSender/LocalMatchStore (fake-indexeddb), nur `useAuth`/
 * `useRepositories` sind gemockt.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MatchEngine } from '../../../core/match/client';
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
});
