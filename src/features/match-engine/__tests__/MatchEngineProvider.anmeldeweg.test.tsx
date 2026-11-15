/**
 * @OB-087 Zeile 3 („Toms Sitzung ist abgelaufen, 3 Einträge warten“ → „Anmelden“): der Weg Cockpit → Anmeldeseite → Cockpit, soweit Vitest ihn
 * abdeckt. Echte MatchEngine/OutboxSender/LocalMatchStore (fake-indexeddb) UNTER einem Router, nur `useAuth`/`useRepositories` gemockt.
 * Belegt: (1) der Provider lebt über `/login` hinweg (keine zweite Engine, kein `stop`), das Wartende bleibt im Gerät;
 * (2) ein neues Token DESSELBEN Kontos hebt „Bitte neu anmelden“ auf und stößt den Ausgang an (`resumeAuth` → `kick`);
 * (3) Gegenbeispiel: ein anderes Konto führt nicht still weiter, die Engine wechselt das Konto.
 * Nicht in Vitest prüfbar: das tatsächliche Senden der 3 Einträge an den Server (echte Antwort; deckt `OutboxSender.errors.test.ts` Fall 8 am
 * Sender mit Prüfstand ab) und die echte Anmeldung (Supabase) – das bleibt Sache von Playwright/Prod-Probe.
 */
import 'fake-indexeddb/auto';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { MatchEngine, OutboxSender } from '../../../core/match/client';

const mockAuth: { user: { id: string; globalRole: string } | null; session: { token: string } | null } = {
  user: { id: 'user-1', globalRole: 'organizer' },
  session: { token: 'token-1' },
};
vi.mock('../../auth/hooks/useAuth', () => ({ useAuth: () => mockAuth }));
vi.mock('../../../core/contexts/RepositoryContext', () => ({ useRepositories: () => ({ supabaseLiveMatchRepo: null, tournamentRepository: {} }) }));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../../lib/supabase', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../lib/supabase')>()), isSupabaseConfigured: true }));

import { MatchEngineProvider } from '../MatchEngineProvider';
import { useMatchEngineContext } from '../useMatchEngineContext';

type EngineKontext = ReturnType<typeof useMatchEngineContext>;
const gesehen: { kontext: EngineKontext | null } = { kontext: null };

function Seite({ name }: { name: string }) {
  const kontext = useMatchEngineContext();
  const navigate = useNavigate();
  useEffect(() => { gesehen.kontext = kontext; }, [kontext]);
  return <button type="button" data-testid={`seite-${name}`} onClick={() => void navigate(name === 'cockpit' ? '/login' : '/tournament/t1/live?f=2')}>{name}</button>;
}

const baum = () => (
  <MemoryRouter initialEntries={['/tournament/t1/live?f=2']}>
    <MatchEngineProvider>
      <Routes>
        <Route path="/login" element={<Seite name="login" />} />
        <Route path="*" element={<Seite name="cockpit" />} />
      </Routes>
    </MatchEngineProvider>
  </MemoryRouter>
);

/** Setzt „Bitte neu anmelden“ (HTTP 42501 am Ausgang) am echten Sender; sonst ließe sich der Zustand nur über den Server herstellen. */
function verlangeAnmeldung(sender: OutboxSender): void {
  (sender as unknown as { book: { set: (teil: { authRequired: boolean }) => void } }).book.set({ authRequired: true });
}

describe('@OB-087 Zeile 3 – Cockpit → Anmeldung → Cockpit (Provider und Ausgang)', () => {
  beforeEach(() => {
    mockAuth.user = { id: 'user-1', globalRole: 'organizer' };
    mockAuth.session = { token: 'token-1' };
    gesehen.kontext = null;
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('derselbe Provider und dieselbe Engine überstehen den Weg über die Anmeldeseite; das neue Token hebt „Bitte neu anmelden“ auf und stößt den Ausgang an', async () => {
    const startSpy = vi.spyOn(MatchEngine.prototype, 'start');
    const stopSpy = vi.spyOn(MatchEngine.prototype, 'stop');
    const kickSpy = vi.spyOn(OutboxSender.prototype, 'kick');
    const { rerender } = render(baum());
    await waitFor(() => expect(startSpy).toHaveBeenCalledWith('user-1'));
    const engine = gesehen.kontext?.engine;
    const sender = gesehen.kontext!.sender;
    verlangeAnmeldung(sender);
    expect(sender.getStatus().authRequired).toBe(true);

    fireEvent.click(screen.getByTestId('seite-cockpit')); // „Anmelden“ → /login
    expect(screen.getByTestId('seite-login')).toBeInTheDocument();
    expect(gesehen.kontext?.engine).toBe(engine);
    expect(stopSpy).not.toHaveBeenCalled();
    kickSpy.mockClear();

    mockAuth.session = { token: 'token-2' }; // Anmeldung gelingt: neues Token desselben Kontos
    await act(async () => { rerender(baum()); });
    fireEvent.click(screen.getByTestId('seite-login')); // Rückkehr ins Cockpit
    expect(screen.getByTestId('seite-cockpit')).toBeInTheDocument();

    await waitFor(() => expect(sender.getStatus().authRequired).toBe(false));
    expect(kickSpy).toHaveBeenCalled();
    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(gesehen.kontext?.engine).toBe(engine);
  });

  it('Gegenbeispiel: dasselbe Token (keine Anmeldung) hebt „Bitte neu anmelden“ nicht auf', async () => {
    const startSpy = vi.spyOn(MatchEngine.prototype, 'start');
    const { rerender } = render(baum());
    await waitFor(() => expect(startSpy).toHaveBeenCalledWith('user-1'));
    const sender = gesehen.kontext!.sender;
    verlangeAnmeldung(sender);
    fireEvent.click(screen.getByTestId('seite-cockpit'));
    await act(async () => { rerender(baum()); });
    expect(sender.getStatus().authRequired).toBe(true);
  });

  it('Gegenbeispiel: meldet sich ein ANDERES Konto an, wechselt die Engine das Konto (stop, dann start des neuen) statt es still weiterzuführen', async () => {
    const startSpy = vi.spyOn(MatchEngine.prototype, 'start');
    const stopSpy = vi.spyOn(MatchEngine.prototype, 'stop');
    const { rerender } = render(baum());
    await waitFor(() => expect(startSpy).toHaveBeenCalledWith('user-1'));
    mockAuth.user = { id: 'user-2', globalRole: 'organizer' };
    mockAuth.session = { token: 'token-9' };
    await act(async () => { rerender(baum()); });
    await waitFor(() => expect(startSpy).toHaveBeenCalledWith('user-2'));
    expect(stopSpy).toHaveBeenCalled();
  });
});
