/**
 * A-10 Teil D (brief-A-10.md § 3 Teil D, § 8 Fall 13): Assistent Schritt 2 „Turnier zurücksetzen“
 * (`useTournamentWizard.handleResetTournament`) geht für ein Konto-Turnier über den Server (`reset_match_results`),
 * für den Gast lokal wie heute. Ohne Netz (L8): Hinweis, nichts geändert. @FU-090 (Server-Zwilling): HAS_ENTRIES →
 * „Spiel 7 hat Einträge – nur über Spielplan auf Anfang setzen“, nichts geändert.
 * Echte Spiel-Engine, echte DE-Texte, echter Toast; nur die Cloud-Schnittstelle ist ersetzt.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
const cloud = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: cloud.rpc } }));
vi.mock('../../../hooks/useRepository', () => ({ useRepository: () => ({}) }));

import { initRealDeI18n } from '../../../test/realDeI18n';
import { ToastProvider } from '../../../components/ui/Toast';
import { MatchEngineContext } from '../../match-engine/matchEngineContextInstance';
import { makeScheduleEngine, scheduleTournament, SPIEL_7, SPIEL_9, HALBFINALE_1, type ScheduleEngine } from '../../../test/scheduleEngineHarness';
import { useTournamentWizard } from '../../../hooks/useTournamentWizard';

await initRealDeI18n();

const BLOCKED_7 = 'Spiel 7 hat Einträge – nur über Spielplan auf Anfang setzen';
const OFFLINE = 'Zurücksetzen braucht eine Verbindung – nichts geändert';
const mitErgebnis = () => scheduleTournament({ [SPIEL_7]: { scoreA: 2, scoreB: 1, matchStatus: 'finished' } });
const net = { online: true };

describe('A-10 Assistent Schritt 2 „Turnier zurücksetzen“ über den Server (@FU-090, L1, L8)', () => {
  let h: ScheduleEngine;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ToastProvider><MatchEngineContext.Provider value={h.value}>{children}</MatchEngineContext.Provider></ToastProvider>
  );

  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    net.online = true;
    vi.stubGlobal('navigator', { ...navigator, get onLine() { return net.online; } });
    cloud.rpc.mockReset();
  });
  afterEach(() => {
    h.engine.stop();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const spiel7 = (result: { current: ReturnType<typeof useTournamentWizard> }) => result.current.formData.matches?.find((m) => m.id === SPIEL_7);

  it('L1 Konto-Turnier ohne Einträge → Rückfrage, reset_match_results mit allen Spielen, danach Formular zurückgesetzt', async () => {
    h = await makeScheduleEngine();
    cloud.rpc.mockResolvedValue({ data: { status: 'ok', reset: 1 }, error: null });
    const browserConfirm = vi.spyOn(window, 'confirm');
    const confirm = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useTournamentWizard(mitErgebnis(), confirm), { wrapper });

    act(() => { result.current.handleResetTournament(); });

    await vi.waitFor(() => expect(spiel7(result)?.matchStatus).toBe('scheduled'));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(browserConfirm).not.toHaveBeenCalled(); // @OB-017
    expect(cloud.rpc).toHaveBeenCalledWith('reset_match_results', { p_tournament_id: 'T', p_match_ids: [SPIEL_7, SPIEL_9, HALBFINALE_1] });
    expect(spiel7(result)).toMatchObject({ scoreA: undefined, scoreB: undefined, matchStatus: 'scheduled' });
  });

  it('Gegenbeispiel: Rückfrage abgelehnt → kein Server-Aufruf, nichts geändert', async () => {
    h = await makeScheduleEngine();
    const browserConfirm = vi.spyOn(window, 'confirm');
    const confirm = vi.fn().mockResolvedValue(false);
    const { result } = renderHook(() => useTournamentWizard(mitErgebnis(), confirm), { wrapper });

    act(() => { result.current.handleResetTournament(); });

    await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(browserConfirm).not.toHaveBeenCalled(); // @OB-017: nie ein Fenster des Browsers
    expect(cloud.rpc).not.toHaveBeenCalled();
    expect(spiel7(result)).toMatchObject({ scoreA: 2, matchStatus: 'finished' });
  });

  it('@FU-090 Server meldet HAS_ENTRIES → Text wörtlich, Formular unverändert', async () => {
    h = await makeScheduleEngine();
    cloud.rpc.mockResolvedValue({ data: { status: 'rejected', code: 'HAS_ENTRIES', matchIds: [SPIEL_7] }, error: null });
    const confirm = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useTournamentWizard(mitErgebnis(), confirm), { wrapper });

    act(() => { result.current.handleResetTournament(); });

    expect(await screen.findByText(BLOCKED_7)).toBeInTheDocument();
    expect(spiel7(result)).toMatchObject({ scoreA: 2, matchStatus: 'finished' });
  });

  it('L8 Konto-Turnier ohne Netz → Hinweis, kein Server-Aufruf, Formular unverändert', async () => {
    h = await makeScheduleEngine();
    net.online = false;
    const confirm = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useTournamentWizard(mitErgebnis(), confirm), { wrapper });

    act(() => { result.current.handleResetTournament(); });

    expect(await screen.findByText(OFFLINE)).toBeInTheDocument();
    expect(cloud.rpc).not.toHaveBeenCalled();
    expect(spiel7(result)).toMatchObject({ scoreA: 2, matchStatus: 'finished' });
  });

  it('Gegenbeispiel Gast → lokal wie heute, kein Server-Aufruf', async () => {
    h = await makeScheduleEngine('guest');
    const confirm = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useTournamentWizard(mitErgebnis(), confirm), { wrapper });

    act(() => { result.current.handleResetTournament(); });

    await vi.waitFor(() => expect(spiel7(result)?.matchStatus).toBe('scheduled'));
    expect(cloud.rpc).not.toHaveBeenCalled();
  });
});
