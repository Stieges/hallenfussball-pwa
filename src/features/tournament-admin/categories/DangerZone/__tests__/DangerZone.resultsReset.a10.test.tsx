/**
 * A-10 Teil D (brief-A-10.md § 3 Teil D, § 8 Fall 13, § 10): „Ergebnisse zurücksetzen“ in den Einstellungen geht für ein
 * Konto-Turnier über den Server (`reset_match_results`), für den Gast lokal wie heute.
 *
 * @FU-090 (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`): „Gegeben Spiel 7 im ‚Live-Cup‘ hat 5 Einträge · Wenn
 * Olli <Aktion> wählt · Dann führt die App es nicht aus und zeigt ‚Spiel 7 hat Einträge – nur über Spielplan auf Anfang
 * setzen‘ · Und Spiel 7 behält alle 5 Einträge“ – hier der Fall, dass nur der Server die Einträge kennt (HAS_ENTRIES).
 * L1 (ohne Einträge zurücksetzen), L8 (ohne Netz: Hinweis, nichts geändert), @HE-042 („nur Turnierleitung“).
 * Echte Spiel-Engine (fake-indexeddb), echte DE-Texte, echter Toast; nur die Cloud-Schnittstelle ist ersetzt.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.unmock('i18next');
vi.unmock('react-i18next');
const cloud = vi.hoisted(() => ({ rpc: vi.fn() }));
const sentry = vi.hoisted(() => ({ captureFeatureError: vi.fn() }));
vi.mock('../../../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: cloud.rpc } }));
vi.mock('../../../../../lib/sentry', () => sentry);
vi.mock('../../../../auth/hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock('../../../../auth/hooks/useMyTournamentRole', () => ({ useMyTournamentRole: () => ({ role: 'owner', isLoading: false }) }));

import { initRealDeI18n } from '../../../../../test/realDeI18n';
import { ToastProvider } from '../../../../../components/ui/Toast';
import { MatchEngineContext } from '../../../../match-engine/matchEngineContextInstance';
import { makeScheduleEngine, scheduleTournament, SPIEL_7, SPIEL_9, HALBFINALE_1, type ScheduleEngine } from '../../../../../test/scheduleEngineHarness';
import { DangerZoneCategory } from '../index';
import type { Tournament } from '../../../../../types/tournament';

await initRealDeI18n();

const BLOCKED_7 = 'Spiel 7 hat Einträge – nur über Spielplan auf Anfang setzen';
const OFFLINE = 'Zurücksetzen braucht eine Verbindung – nichts geändert';
const FAILED = 'Zurücksetzen gerade nicht möglich – nichts geändert';
const LEAD_ONLY = 'nur Turnierleitung';

const net = { online: true };

function renderDangerZone(h: ScheduleEngine) {
  const onLocalTournamentUpdate = vi.fn();
  const onTournamentUpdate = vi.fn();
  render(
    <ToastProvider>
      <MatchEngineContext.Provider value={h.value}>
        <DangerZoneCategory
          tournamentId="T"
          tournament={scheduleTournament({ [SPIEL_7]: { scoreA: 2, scoreB: 1, matchStatus: 'finished' }, [SPIEL_9]: { scoreA: 3, scoreB: 1, matchStatus: 'finished' } })}
          onTournamentUpdate={onTournamentUpdate}
          onLocalTournamentUpdate={onLocalTournamentUpdate}
        />
      </MatchEngineContext.Provider>
    </ToastProvider>,
  );
  return { onLocalTournamentUpdate, onTournamentUpdate };
}

async function resetResults(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Spielplan zurücksetzen/i }));
  const dialog = await screen.findByRole('dialog');
  await user.type(within(dialog).getByRole('textbox'), 'ZURÜCKSETZEN');
  await user.click(within(dialog).getByRole('button', { name: /Spielplan zurücksetzen/i }));
}

describe('A-10 DangerZone „Ergebnisse zurücksetzen“ über den Server (@FU-090, L1, L8)', () => {
  let h: ScheduleEngine | undefined;

  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    net.online = true;
    vi.stubGlobal('navigator', { ...navigator, get onLine() { return net.online; } });
    cloud.rpc.mockReset();
    sentry.captureFeatureError.mockReset();
  });
  afterEach(() => {
    h?.engine.stop();
    h = undefined;
    vi.unstubAllGlobals();
  });

  it('L1 Konto-Turnier ohne Einträge → reset_match_results mit ALLEN Spielen, danach lokal zurückgesetzt, kein Voll-Speichern', async () => {
    h = await makeScheduleEngine();
    cloud.rpc.mockResolvedValue({ data: { status: 'ok', reset: 2 }, error: null });
    const user = userEvent.setup();
    const { onLocalTournamentUpdate, onTournamentUpdate } = renderDangerZone(h);

    await resetResults(user);

    await vi.waitFor(() => expect(onLocalTournamentUpdate).toHaveBeenCalledTimes(1));
    expect(cloud.rpc).toHaveBeenCalledTimes(1);
    expect(cloud.rpc).toHaveBeenCalledWith('reset_match_results', { p_tournament_id: 'T', p_match_ids: [SPIEL_7, SPIEL_9, HALBFINALE_1] });
    const local = onLocalTournamentUpdate.mock.calls[0][0] as Tournament;
    for (const match of local.matches) {
      expect(match).toMatchObject({ matchStatus: 'scheduled', scoreA: undefined, scoreB: undefined, finishedAt: undefined });
    }
    expect(onTournamentUpdate).not.toHaveBeenCalled();
  });

  it('@FU-090 Server meldet HAS_ENTRIES (Einträge eines anderen Geräts) → Text wörtlich, lokal nichts geändert', async () => {
    h = await makeScheduleEngine();
    cloud.rpc.mockResolvedValue({ data: { status: 'rejected', code: 'HAS_ENTRIES', matchIds: [SPIEL_7] }, error: null });
    const user = userEvent.setup();
    const { onLocalTournamentUpdate } = renderDangerZone(h);

    await resetResults(user);

    expect(await screen.findByText(BLOCKED_7)).toBeInTheDocument();
    expect(onLocalTournamentUpdate).not.toHaveBeenCalled();
  });

  it('L8 Konto-Turnier ohne Netz → Hinweis, kein Server-Aufruf, lokal nichts geändert', async () => {
    h = await makeScheduleEngine();
    net.online = false;
    const user = userEvent.setup();
    const { onLocalTournamentUpdate } = renderDangerZone(h);

    await resetResults(user);

    expect(await screen.findByText(OFFLINE)).toBeInTheDocument();
    expect(cloud.rpc).not.toHaveBeenCalled();
    expect(onLocalTournamentUpdate).not.toHaveBeenCalled();
  });

  it('@HE-042 Server lehnt ab (42501) → „nur Turnierleitung“, lokal nichts geändert', async () => {
    h = await makeScheduleEngine();
    cloud.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'reset_match_results: nur Turnierleitung' } });
    const user = userEvent.setup();
    const { onLocalTournamentUpdate } = renderDangerZone(h);

    await resetResults(user);

    expect(await screen.findByText(LEAD_ONLY)).toBeInTheDocument();
    expect(onLocalTournamentUpdate).not.toHaveBeenCalled();
    expect(sentry.captureFeatureError).not.toHaveBeenCalled();
  });

  it('Funktion fehlt am Server (vor F2b, PGRST202) → „gerade nicht möglich“ + Meldung, lokal nichts geändert', async () => {
    h = await makeScheduleEngine();
    cloud.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    const user = userEvent.setup();
    const { onLocalTournamentUpdate } = renderDangerZone(h);

    await resetResults(user);

    expect(await screen.findByText(FAILED)).toBeInTheDocument();
    expect(onLocalTournamentUpdate).not.toHaveBeenCalled();
    expect(sentry.captureFeatureError).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel Gast → lokal wie heute, kein Server-Aufruf (auch ohne Netz)', async () => {
    h = await makeScheduleEngine('guest');
    net.online = false;
    const user = userEvent.setup();
    const { onLocalTournamentUpdate } = renderDangerZone(h);

    await resetResults(user);

    await vi.waitFor(() => expect(onLocalTournamentUpdate).toHaveBeenCalledTimes(1));
    expect(cloud.rpc).not.toHaveBeenCalled();
    expect(screen.queryByText(OFFLINE)).not.toBeInTheDocument();
  });
});
